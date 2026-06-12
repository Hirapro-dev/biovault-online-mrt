import { redirect } from "next/navigation";

// /archive/register への直接アクセスはグループA登録ページへ転送
export default function ArchiveRegisterPage() {
  redirect("/archive/register/a");
}
