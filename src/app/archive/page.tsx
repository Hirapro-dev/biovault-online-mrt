import { redirect } from "next/navigation";

// 動画一覧ページは廃止。/archive への直接アクセスはログインページへ誘導
export default function ArchiveIndexPage() {
  redirect("/archive/login");
}
