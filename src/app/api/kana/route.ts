import { NextRequest, NextResponse } from "next/server";

// 漢字氏名 → ひらがな変換（Yahoo! ルビ振りAPI / JLP V2）
// 環境変数 YAHOO_APP_ID に Yahoo!デベロッパーネットワークの Client ID を設定してください
// 取得: https://e.developer.yahoo.co.jp/register （無料・登録制）
export async function POST(request: NextRequest) {
  try {
    const { text } = (await request.json()) as { text?: string };
    const q = (text || "").trim();
    if (!q) {
      return NextResponse.json({ kana: "" });
    }

    const appId = process.env.YAHOO_APP_ID;
    if (!appId) {
      // 未設定時は変換せず空を返す（手入力にフォールバック）
      return NextResponse.json({ kana: "", configured: false });
    }

    const res = await fetch(
      "https://jlp.yahooapis.jp/FuriganaService/V2/furigana",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": `Yahoo AppID: ${appId}`,
        },
        body: JSON.stringify({
          id: "1",
          jsonrpc: "2.0",
          method: "jlp.furiganaservice.furigana",
          params: { q, grade: 1 },
        }),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ kana: "" });
    }

    const data = (await res.json()) as {
      result?: { word?: { surface: string; furigana?: string }[] };
    };
    // 各語の furigana（無ければ surface）を連結
    const kana =
      data.result?.word
        ?.map((w) => w.furigana ?? w.surface)
        .join("") ?? "";

    return NextResponse.json({ kana });
  } catch (err) {
    console.error("kana convert error:", err);
    return NextResponse.json({ kana: "" });
  }
}
