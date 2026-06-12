import { createServiceRoleClient } from "@/lib/supabase/server";
import { ThanksCard } from "./thanks-card";

export const dynamic = "force-dynamic";

// 録画配信：登録完了（ID/PW表示）ページ
export default async function ArchiveThanksPage({
  searchParams,
}: {
  searchParams: { id?: string; pw?: string };
}) {
  const memberId = searchParams.id || "";
  const password = searchParams.pw || "";

  // 管理画面で設定された視聴ページURLを取得
  const supabase = createServiceRoleClient();
  const { data: setting } = await supabase
    .from("archive_settings")
    .select("value")
    .eq("key", "watch_page_url")
    .single();

  const watchPageUrl: string = setting?.value || "/archive/login";

  return (
    <ThanksCard memberId={memberId} password={password} watchPageUrl={watchPageUrl} />
  );
}
