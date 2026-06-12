import { redirect, notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getArchiveMemberId, isAdminSession } from "@/lib/archive-auth";
import { createPlaybackUrl } from "@/lib/r2";
import type { ArchiveVideo } from "@/types";
import { ArchivePlayer } from "./archive-player";
import { ArchiveHeader } from "./archive-header";
import { ArchiveBackground } from "../archive-background";

export const dynamic = "force-dynamic";

// 録画配信：視聴ページ
export default async function ArchiveWatchPage({
  params,
}: {
  params: { slug: string };
}) {
  // 会員ログイン or 管理者ログインのどちらかでアクセス可能
  const memberId = getArchiveMemberId();
  const isAdmin = !memberId && (await isAdminSession());
  if (!memberId && !isAdmin) redirect(`/archive/login`);

  const supabase = createServiceRoleClient();

  // ヘッダー表示用に会員名を取得（管理者は名前なし）
  let memberName: string | null = null;
  if (memberId) {
    const { data: member } = await supabase
      .from("archive_members")
      .select("name")
      .eq("member_id", memberId)
      .maybeSingle();
    memberName = member?.name ?? null;
  }

  const { data: video } = await supabase
    .from("archive_videos")
    .select("*")
    .eq("slug", params.slug)
    .eq("is_active", true)
    .single();

  if (!video) notFound();
  const v = video as ArchiveVideo;

  // 公開期間チェック
  const now = new Date();
  const notYetPublished = v.published_at && new Date(v.published_at) > now;
  const expired = v.expires_at && new Date(v.expires_at) < now;

  // 自分の視聴回数を取得（管理者は回数制限なし）
  const { data: view } = memberId
    ? await supabase
        .from("archive_views")
        .select("view_count")
        .eq("member_id", memberId)
        .eq("video_id", v.id)
        .maybeSingle()
    : { data: null };

  const remaining = isAdmin
    ? v.max_views
    : Math.max(0, v.max_views - (view?.view_count ?? 0));

  // サムネイルの署名付きURL（再生前の表示用）
  let thumbnailUrl: string | null = null;
  if (v.thumbnail_r2_key) {
    try {
      thumbnailUrl = await createPlaybackUrl(v.thumbnail_r2_key);
    } catch {
      // 取得失敗時はサムネイルなしで表示
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050a0e]">
      <ArchiveBackground />
      <div className="relative z-10">
        <ArchiveHeader memberName={memberName} />
      </div>
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-2 bg-gradient-to-r from-teal-200 via-cyan-100 to-teal-200 bg-clip-text text-xl font-bold tracking-wide text-transparent sm:text-2xl">
          {v.title}
        </h1>
        {v.description && (
          <p className="mb-6 text-sm text-slate-400">{v.description}</p>
        )}

        {notYetPublished ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-12 text-center text-amber-300">
            この動画はまだ公開されていません
            {v.published_at && (
              <p className="mt-2 text-sm text-slate-400">
                公開開始: {new Date(v.published_at).toLocaleString("ja-JP")}
              </p>
            )}
          </div>
        ) : expired ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-12 text-center text-red-400">
            この動画の公開期間は終了しました
          </div>
        ) : (
          <ArchivePlayer
            videoId={v.id}
            initialRemaining={remaining}
            thumbnailUrl={thumbnailUrl}
          />
        )}

        <p className="mt-10 text-center text-[10px] text-white/40">
          © MRT inc. All rights reserved.
        </p>
      </div>
    </div>
  );
}
