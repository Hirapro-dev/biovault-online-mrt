import { createServiceRoleClient } from "@/lib/supabase/server";
import { ThanksCard } from "./thanks-card";

export const dynamic = "force-dynamic";

// 録画配信：登録完了（ID/PW表示）ページ
export default async function ArchiveThanksPage({
  searchParams,
}: {
  searchParams: { id?: string; pw?: string };
}) {
  // id にはログインID（メールアドレス）が渡される
  const loginId = searchParams.id || "";
  const password = searchParams.pw || "";

  const supabase = createServiceRoleClient();

  // 登録した会員の流入元グループをメールアドレスから取得
  let groupKey = "watch_page_url_a";
  if (loginId) {
    const { data: member } = await supabase
      .from("archive_members")
      .select("member_group")
      .eq("email", loginId.toLowerCase())
      .maybeSingle();
    if (member?.member_group === "b") groupKey = "watch_page_url_b";
  }

  // グループ別URL → 旧共通URL → デフォルトの順でフォールバック
  const { data: settings } = await supabase
    .from("archive_settings")
    .select("key, value")
    .in("key", [groupKey, "watch_page_url"]);
  const settingMap: Record<string, string> = {};
  (settings as { key: string; value: string }[] | null)?.forEach((s) => {
    settingMap[s.key] = s.value;
  });

  const watchPageUrl: string =
    settingMap[groupKey] || settingMap["watch_page_url"] || "/archive/login";

  return (
    <ThanksCard memberId={loginId} password={password} watchPageUrl={watchPageUrl} />
  );
}
