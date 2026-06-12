import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getArchiveMemberId, isAdminSession } from "@/lib/archive-auth";
import { createPlaybackUrl } from "@/lib/r2";

// 再生前チェック：視聴回数の確認 → 署名付きURL発行 + 回数カウントアップ
export async function POST(request: NextRequest) {
  try {
    // 認証チェック（会員 or 管理者）
    const memberId = getArchiveMemberId();
    const isAdmin = !memberId && (await isAdminSession());
    if (!memberId && !isAdmin) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const { video_id } = (await request.json()) as { video_id?: string };
    if (!video_id) {
      return NextResponse.json({ error: "video_id が必要です" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // 動画の存在・公開期間チェック
    const { data: video, error: videoError } = await supabase
      .from("archive_videos")
      .select("id, r2_key, published_at, expires_at, max_views, is_active")
      .eq("id", video_id)
      .single();

    if (videoError || !video || !video.is_active) {
      return NextResponse.json({ error: "動画が見つかりません" }, { status: 404 });
    }

    const now = new Date();
    // 公開期間チェック（管理者は期間外でも確認用に再生可能）
    if (!isAdmin) {
      if (video.published_at && new Date(video.published_at) > now) {
        return NextResponse.json({ error: "この動画はまだ公開されていません" }, { status: 403 });
      }
      if (video.expires_at && new Date(video.expires_at) < now) {
        return NextResponse.json({ error: "この動画の公開期間は終了しました" }, { status: 403 });
      }
    }

    // 管理者は回数を消費せずに再生可能
    if (isAdmin) {
      const playbackUrl = await createPlaybackUrl(video.r2_key);
      return NextResponse.json({ url: playbackUrl, remaining: video.max_views });
    }

    // 視聴回数チェック
    const { data: view } = await supabase
      .from("archive_views")
      .select("id, view_count")
      .eq("member_id", memberId)
      .eq("video_id", video_id)
      .maybeSingle();

    const currentCount = view?.view_count ?? 0;
    if (currentCount >= video.max_views) {
      return NextResponse.json(
        { error: "現在この動画はご視聴いただけません", remaining: 0 },
        { status: 403 }
      );
    }

    // 視聴回数をインクリメント（レコードがなければ作成）
    const nowIso = now.toISOString();
    if (view) {
      const { error: updateError } = await supabase
        .from("archive_views")
        .update({ view_count: currentCount + 1, last_viewed_at: nowIso })
        .eq("id", view.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase.from("archive_views").insert({
        member_id: memberId,
        video_id,
        view_count: 1,
        last_viewed_at: nowIso,
      });
      if (insertError) throw insertError;
    }

    // 再生履歴を記録
    await supabase.from("archive_play_logs").insert({
      member_id: memberId,
      video_id,
    });

    // R2署名付きURL（有効期限2時間）を発行
    const playbackUrl = await createPlaybackUrl(video.r2_key);

    return NextResponse.json({
      url: playbackUrl,
      remaining: video.max_views - currentCount - 1,
    });
  } catch (err) {
    console.error("Play check error:", err);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}
