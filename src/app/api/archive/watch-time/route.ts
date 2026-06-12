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

    const { video_id, seconds } = (await request.json()) as {
      video_id?: string;
      seconds?: number;
    };

    if (!video_id || typeof seconds !== "number" || seconds <= 0 || seconds > 3600) {
      return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
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
        total_watch_seconds: (view.total_watch_seconds ?? 0) + Math.round(seconds),
      })
      .eq("id", view.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Watch time error:", err);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}
