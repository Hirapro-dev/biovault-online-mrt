import { NextResponse } from "next/server";
import { buildRegistrationEmailHtml } from "@/lib/email";

// 登録完了メールのプレビュー（サンプルデータでHTMLを表示）
// ブラウザで /api/archive/email-preview を開くと見た目を確認できる
export async function GET() {
  const html = buildRegistrationEmailHtml({
    name: "山田 太郎",
    loginId: "tanaka0001@example.com",
    password: "Xy7k9mPq",
    watchPageUrl: "https://bvlive.mrt.co.jp/archive/login",
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
