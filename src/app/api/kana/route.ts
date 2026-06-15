import { NextRequest, NextResponse } from "next/server";

// 漢字氏名 → ひらがな変換（gooラボ ひらがな化API）
// 環境変数 GOO_API_APP_ID に gooラボの アプリケーションID を設定してください
// 取得: https://labs.goo.ne.jp/apiusage/ （無料・登録制）
export async function POST(request: NextRequest) {
  try {
    const { text } = (await request.json()) as { text?: string };
    const sentence = (text || "").trim();
    if (!sentence) {
      return NextResponse.json({ kana: "" });
    }

    const appId = process.env.GOO_API_APP_ID;
    if (!appId) {
      // 未設定時は変換せず空を返す（手入力にフォールバック）
      return NextResponse.json({ kana: "", configured: false });
    }

    const res = await fetch("https://labs.goo.ne.jp/api/hiragana", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: appId,
        sentence,
        output_type: "hiragana",
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ kana: "" });
    }
    const data = (await res.json()) as { converted?: string };
    return NextResponse.json({ kana: data.converted ?? "" });
  } catch (err) {
    console.error("kana convert error:", err);
    return NextResponse.json({ kana: "" });
  }
}
