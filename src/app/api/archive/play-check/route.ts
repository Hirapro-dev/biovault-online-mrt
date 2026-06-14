import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getArchiveMemberId, isAdminSession } from "@/lib/archive-auth";
import { createPlaybackUrl } from "@/lib/r2";
import { calcAccessDeadline, isAccessExpired } from "@/lib/archive-access";

// 再生前チェック：視聴期限（初回再生から72時間）の確認 → 署名付きURL発行
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
      .select("id, r2_key, published_at, expires_at, is_active")
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

    // 管理者は視聴期限なしで再生可能
    if (isAdmin) {
      const playbackUrl = await createPlaybackUrl(video.r2_key);
      return NextResponse.json({ url: playbackUrl, expiresAt: null });
    }

    // 会員の存在確認（削除済み会員の古いセッション対策）
    const { data: memberRow } = await supabase
      .from("archive_members")
      .select("member_id")
      .eq("member_id", memberId)
      .maybeSingle();
    if (!memberRow) {
      return NextResponse.json(
        { error: "セッションが無効です。お手数ですが再度ログインしてください", relogin: true },
        { status: 401 }
      );
    }

    // 視聴期限チェック（初回再生から72時間）
    const { data: view } = await supabase
      .from("archive_views")
      .select("id, view_count, first_viewed_at")
      .eq("member_id", memberId)
      .eq("video_id", video_id)
      .maybeSingle();

    // 既に初回再生済みで、72時間を過ぎている場合は視聴不可
    if (view?.first_viewed_at && isAccessExpired(view.first_viewed_at, now)) {
      return NextResponse.json(
        { error: "視聴可能期間（初回再生から72時間）が終了しました", expired: true },
        { status: 403 }
      );
    }

    const nowIso = now.toISOString();
    // 初回再生時刻：既存があれば維持、無ければ今回を初回とする
    const firstViewedAt = view?.first_viewed_at ?? nowIso;

    if (view) {
      const { error: updateError } = await supabase
        .from("archive_views")
        .update({
          view_count: (view.view_count ?? 0) + 1,
          last_viewed_at: nowIso,
          // 初回再生時刻が未設定の場合のみ記録（既存は変更しない）
          ...(view.first_viewed_at ? {} : { first_viewed_at: nowIso }),
        })
        .eq("id", view.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase.from("archive_views").insert({
        member_id: memberId,
        video_id,
        view_count: 1,
        last_viewed_at: nowIso,
        first_viewed_at: nowIso,
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
      // 視聴期限（初回再生 + 72時間）をクライアントに通知
      expiresAt: calcAccessDeadline(firstViewedAt).toISOString(),
    });
  } catch (err) {
    console.error("Play check error:", err);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}
