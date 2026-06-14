import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getArchiveMemberId } from "@/lib/archive-auth";

// 視聴時間の加算記録（再生中に定期送信 + sendBeacon）
export async function POST(request: NextRequest) {
  try {
    const memberId = getArchiveMemberId();
    if (!memberId) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const { video_id, seconds, play_log_id } = (await request.json()) as {
      video_id?: string;
      seconds?: number;
      play_log_id?: string;
    };

    if (!video_id || typeof seconds !== "number" || seconds <= 0 || seconds > 3600) {
      return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const addSeconds = Math.round(seconds);

    // ① 会員×動画の合計視聴時間（ユニーク集計：録画配信ログ用）
    const { data: view } = await supabase
      .from("archive_views")
      .select("id, total_watch_seconds")
      .eq("member_id", memberId)
      .eq("video_id", video_id)
      .maybeSingle();

    if (!view) {
      return NextResponse.json({ error: "視聴記録が見つかりません" }, { status: 404 });
    }

    await supabase
      .from("archive_views")
      .update({
        total_watch_seconds: (view.total_watch_seconds ?? 0) + addSeconds,
      })
      .eq("id", view.id);

    // ② 再生1回ごとの視聴時間（再生履歴：動画詳細の履歴表示用）
    if (play_log_id) {
      const { data: log } = await supabase
        .from("archive_play_logs")
        .select("id, watch_seconds")
        .eq("id", play_log_id)
        .eq("member_id", memberId)
        .maybeSingle();
      if (log) {
        await supabase
          .from("archive_play_logs")
          .update({ watch_seconds: (log.watch_seconds ?? 0) + addSeconds })
          .eq("id", log.id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Watch time error:", err);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}
