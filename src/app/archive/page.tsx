import { redirect } from "next/navigation";
import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getArchiveMemberId, isAdminSession } from "@/lib/archive-auth";
import { createPlaybackUrl } from "@/lib/r2";
import { ArchiveHeader } from "./[slug]/archive-header";
import type { ArchiveVideo } from "@/types";

export const dynamic = "force-dynamic";

// ログイン済み会員のグループに合った動画のみ一覧表示
export default async function ArchiveIndexPage() {
  const memberId = getArchiveMemberId();
  const isAdmin = !memberId && (await isAdminSession());
  if (!memberId && !isAdmin) redirect("/archive/login");

  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();

  let memberName: string | null = null;
  let memberGroup: "a" | "b" | null = null;

  if (memberId) {
    const { data: member } = await supabase
      .from("archive_members")
      .select("name, member_group")
      .eq("member_id", memberId)
      .maybeSingle();
    memberName = member?.name ?? null;
    memberGroup = member?.member_group ?? "a";
  }

  // 動画取得：管理者は全件、会員は自分のグループが allowed_groups に含まれるものだけ
  let query = supabase
    .from("archive_videos")
    .select("*")
    .eq("is_active", true)
    .or(`published_at.is.null,published_at.lte.${now}`)
    .or(`expires_at.is.null,expires_at.gte.${now}`)
    .order("created_at", { ascending: false });

  if (!isAdmin && memberGroup) {
    query = query.contains("allowed_groups", [memberGroup]);
  }

  const { data: videos } = await query;
  const list = (videos ?? []) as ArchiveVideo[];

  // サムネイルの署名付きURLを取得
  const thumbnailUrls: Record<string, string> = {};
  await Promise.all(
    list
      .filter((v) => v.thumbnail_r2_key)
      .map(async (v) => {
        try {
          thumbnailUrls[v.id] = await createPlaybackUrl(v.thumbnail_r2_key!);
        } catch {
          // 取得失敗はスキップ
        }
      })
  );

  return (
    <div className="relative min-h-screen">
      <div className="relative z-10">
        <ArchiveHeader memberName={memberName} />
      </div>
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-10">
        <h1 className="mb-8 bg-gradient-to-r from-teal-200 via-cyan-100 to-teal-200 bg-clip-text text-xl font-bold tracking-wide text-transparent sm:text-2xl">
          録画配信 一覧
        </h1>

        {list.length === 0 ? (
          <div className="rounded-xl border border-teal-500/10 bg-teal-500/5 p-12 text-center text-slate-400">
            現在ご視聴可能な動画はありません
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {list.map((v) => (
              <Link
                key={v.id}
                href={`/archive/${v.slug}`}
                className="group relative overflow-hidden rounded-xl border border-teal-500/15 bg-[#0d1520]/80 transition hover:border-teal-400/40 hover:bg-[#0d1520]"
              >
                {/* サムネイル */}
                <div className="aspect-video w-full overflow-hidden bg-[#050a0e]">
                  {thumbnailUrls[v.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnailUrls[v.id]}
                      alt={v.title}
                      className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <svg className="h-12 w-12 text-teal-500/30" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  )}
                </div>
                {/* 情報 */}
                <div className="p-4">
                  <h2 className="text-sm font-semibold text-white group-hover:text-teal-200">
                    {v.title}
                  </h2>
                  {v.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {v.description}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-teal-400/70">視聴する →</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        <p className="mt-12 text-center text-[10px] text-white/40">
          © MRT inc. All rights reserved.
        </p>
      </div>
    </div>
  );
}
