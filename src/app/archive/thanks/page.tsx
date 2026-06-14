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

  // 「視聴ページへ進む」の遷移先はログインページに固定
  return (
    <ThanksCard
      memberId={loginId}
      password={password}
      watchPageUrl="/archive/login"
    />
  );
}
