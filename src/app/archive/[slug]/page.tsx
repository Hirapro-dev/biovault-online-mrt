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
          <p className="mb-6 text-base text-slate-400">{v.description}</p>
        )}

        {notYetPublished ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-12 text-center text-amber-300">
            この動画はまだ公開されていません
            {v.published_at && (
              <p className="mt-2 text-base text-slate-400">
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

        {/* 注意事項 */}
        <div className="mt-10 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-amber-300">
            <span>⚠</span> 注意事項
          </h2>
          <ul className="space-y-2 text-sm leading-relaxed text-slate-300">
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-amber-400">•</span>
              本動画に含まれる情報は機密情報です。視聴者本人以外への開示・漏えいは一切禁止されています。
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-amber-400">•</span>
              動画の録画・スクリーンショット・複製・複写は、事前に書面による承諾を得た場合を除き禁止されています。
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-amber-400">•</span>
              取得した機密情報は、株式会社MRTとの取引目的の範囲内でのみ使用し、他の目的への転用は禁止されています。
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-amber-400">•</span>
              本契約に違反した場合、情報の使用差止めおよび損害賠償請求の対象となります。
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-amber-400">•</span>
              機密保持義務は本契約終了後も、当該情報が秘密である限り継続して有効です。
            </li>
          </ul>
        </div>

        {/* 機密保持契約全文（アコーディオン） */}
        <details className="mt-4 rounded-xl border border-teal-500/15 bg-[#0d1520]/60">
          <summary className="cursor-pointer select-none list-none px-5 py-4 text-sm font-semibold text-teal-300 hover:text-teal-200 [&::-webkit-details-marker]:hidden [&::marker]:hidden">
            <span className="flex items-center justify-between">
              <span>機密保持契約 全文を確認する</span>
              <span className="text-slate-500">▼</span>
            </span>
          </summary>
          <div className="border-t border-teal-500/10 px-5 py-4 text-sm leading-relaxed text-slate-400">
            <p className="mb-3">株式会社MRT（以下「甲」という。）と録画配信視聴者（以下「乙」という。）は，乙が甲から開示された情報（以下「機密情報」という。）の取扱いについて次のとおり契約（以下「本契約」という。）を締結する。</p>
            <p className="mb-1 font-semibold text-slate-300">第１条（機密情報）</p>
            <p className="mb-3">本契約において機密情報とは，甲が乙に対して，書面，口頭，電子メールその他方法を問わず開示した技術上または営業上の情報をいう。ただし，次の各号の一に該当する情報については，機密情報に含まれない。<br />・甲から開示を受けた時点で既に公知であった情報<br />・乙が正当な権限を有する第三者から機密保持義務を負うことなく取得した情報<br />・甲から開示を受けた後，乙の責に帰すべき事由によらないで公知になった情報</p>
            <p className="mb-1 font-semibold text-slate-300">第２条（秘密保持義務）</p>
            <p className="mb-3">乙は，機密情報を第三者に開示し，または漏えいしてはならない。ただし，次の各号の一に該当する場合は，この限りでない。<br />（１）乙が機密情報の開示につき事前の甲から書面による同意を受けた場合<br />（２）乙が法令上の義務に基づいて裁判所，官公庁その他の公的機関に機密情報を開示する場合<br />乙は，前項第１号または第２号に基づいて機密情報を開示するに先立ち，当該開示を受ける者が甲に対し本契約と同等の機密保持義務負うことを確約する書面を，甲に提出しなければならない。<br />乙は，第１項第１号または第２号に基づいて機密情報を第三者に開示した場合であっても，当該第三者による機密情報の管理利用その他の取扱いについて責任を負う。</p>
            <p className="mb-1 font-semibold text-slate-300">第３条（使用目的）</p>
            <p className="mb-3">乙は，機密情報を，甲と乙の取引に必要な範囲のみに使用し、これ以外の目的に使用してはならない。</p>
            <p className="mb-1 font-semibold text-slate-300">第４条（複製）</p>
            <p className="mb-3">乙は，書面による甲の承諾を事前に受けることなく，機密情報を複製または複写してはならない。</p>
            <p className="mb-1 font-semibold text-slate-300">第５条（差止請求，損害賠償等）</p>
            <p className="mb-3">甲は，乙が本契約に違反した場合，乙に対して，機密情報の使用を差し止めることができる。<br />乙は，本契約に違反して甲に損害を与えた場合，損害の拡大防止のため適切な措置を採るとともに，その損害を賠償しなければならない。</p>
            <p className="mb-1 font-semibold text-slate-300">第６条（知的財産権）</p>
            <p className="mb-3">相手方への秘密情報の開示は、機密情報に含まれる開示者又は第三者のいかなる知的財産権も受領者に移転し又は許諾するものではないことを確認する。</p>
            <p className="mb-1 font-semibold text-slate-300">第７条（契約上の地位移転等の禁止）</p>
            <p className="mb-3">甲及び乙は、本契約上の地位並びに本契約から生じる権利及び義務を相手方の事前の書面による承諾を得ずに、第三者に譲渡もしくは移転し又は第三者のための担保に供する等の一切の処分をしてはならない。</p>
            <p className="mb-1 font-semibold text-slate-300">第８条（有効期間）</p>
            <p className="mb-3">本契約に基づく機密保持義務は、本契約終了後も、機密情報が秘密である間は、存続するものとする。</p>
            <p className="mb-1 font-semibold text-slate-300">第９条（専属的合意管轄裁判所）</p>
            <p className="mb-3">本契約に関する紛争については，日本国法に準拠し、甲の指定する裁判所を第一審の専属的合意管轄裁判所とする。</p>
            <p className="mb-1 font-semibold text-slate-300">第10条（返還・廃棄）</p>
            <p className="mb-3">甲の請求があった場合，乙は機密情報及びその複製物を直ちに返還又は廃棄し，その旨を甲に通知する。</p>
            <p className="text-slate-300">以上、乙が当社所定の機密保持締結画面において「機密保持契約に同意する」にチェックを入れた上で、「登録する」ボタンを押下した時点で、本契約は成立する。</p>
          </div>
        </details>

        <p className="mt-8 text-center text-[10px] text-white/40">
          © MRT inc. All rights reserved.
        </p>
      </div>
    </div>
  );
}
