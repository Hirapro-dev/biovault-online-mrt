import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { generateViewerId } from "@/lib/utils/kana-to-romaji";
import { sendRegistrationEmail, sendAdminNotificationEmail } from "@/lib/email";
import { archiveGroupLabel } from "@/lib/archive-group";

// 保存住所「〒1234567 東京都...」を郵便番号と住所に分解する
// 先頭の「〒+数字」を郵便番号として切り出し、残りを住所とする
function splitAddress(full: string): { zipCode: string; address: string } {
  const m = full.match(/^〒?\s*(\d{3}-?\d{4}|\d{7})\s*(.*)$/);
  if (m) {
    return { zipCode: m[1], address: m[2].trim() };
  }
  return { zipCode: "", address: full };
}

// 録画配信会員の登録
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, name_kana, phone, email, address, password, confidentiality_agreed, member_group } =
      body as {
        name?: string;
        name_kana?: string;
        phone?: string;
        email?: string;
        address?: string;
        password?: string;
        confidentiality_agreed?: boolean;
        member_group?: "a" | "b";
      };

    // バリデーション
    if (!name?.trim()) {
      return NextResponse.json({ error: "氏名を入力してください" }, { status: 400 });
    }
    if (!name_kana?.trim()) {
      return NextResponse.json({ error: "ふりがなを入力してください" }, { status: 400 });
    }
    const phoneDigits = (phone || "").replace(/[^0-9]/g, "");
    if (phoneDigits.length < 8) {
      return NextResponse.json({ error: "電話番号を正しく入力してください" }, { status: 400 });
    }
    const emailNormalized = (email || "").trim().toLowerCase();
    if (!emailNormalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized)) {
      return NextResponse.json({ error: "メールアドレスを正しく入力してください" }, { status: 400 });
    }
    if (!address?.trim()) {
      return NextResponse.json({ error: "住所を入力してください" }, { status: 400 });
    }
    // パスワード：6文字以上の半角英数字
    const pw = (password || "").trim();
    if (!/^[A-Za-z0-9]{6,}$/.test(pw)) {
      return NextResponse.json(
        { error: "パスワードは6文字以上の半角英数字で入力してください" },
        { status: 400 }
      );
    }
    if (confidentiality_agreed !== true) {
      return NextResponse.json({ error: "機密保持契約への同意が必要です" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // メールアドレス（ログインID）の重複チェック
    const { data: existingEmail } = await supabase
      .from("archive_members")
      .select("id")
      .eq("email", emailNormalized)
      .maybeSingle();
    if (existingEmail) {
      return NextResponse.json(
        { error: "このメールアドレスは既に登録されています" },
        { status: 409 }
      );
    }

    // 内部ID（視聴ログ等の紐付け用）を生成。衝突したらランダム数字を付けて一意化する
    let memberId = generateViewerId(name_kana, phoneDigits) || `bv${phoneDigits.slice(-4)}`;
    for (let i = 0; i < 5; i++) {
      const { data: dup } = await supabase
        .from("archive_members")
        .select("id")
        .eq("member_id", memberId)
        .maybeSingle();
      if (!dup) break;
      memberId = `${memberId}${Math.floor(Math.random() * 10)}`;
    }

    const { error: insertError } = await supabase.from("archive_members").insert({
      member_id: memberId,
      password: pw,
      name: name.trim(),
      name_kana: name_kana.trim(),
      phone: phone!.trim(),
      email: emailNormalized,
      address: address.trim(),
      confidentiality_agreed: true,
      member_group: member_group === "b" ? "b" : "a",
    });

    if (insertError) {
      console.error("Archive register insert error:", insertError);
      return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 });
    }

    // 登録完了の自動返信メールを送信
    // メール送信の失敗は登録自体の成否に影響させない
    try {
      const group = member_group === "b" ? "b" : "a";
      // 「視聴ページへ進む」の遷移先はログインページに固定（メールは絶対URLが必要）
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bvlive.mrt.co.jp";
      const watchPageUrl = `${appUrl}/archive/login`;

      // 会員への自動返信と管理者への通知を並行送信
      // ログインIDはメールアドレス、パスワードは利用者が設定したもの
      await Promise.all([
        sendRegistrationEmail({
          to: emailNormalized,
          name: name.trim(),
          loginId: emailNormalized,
          password: pw,
          watchPageUrl,
        }),
        sendAdminNotificationEmail({
          name: name.trim(),
          nameKana: name_kana.trim(),
          phone: phone!.trim(),
          email: emailNormalized,
          // 保存住所「〒1234567 東京都...」を郵便番号と住所に分解
          ...splitAddress(address.trim()),
          memberId,
          groupLabel: archiveGroupLabel(group),
        }),
      ]);
    } catch (mailErr) {
      console.error("登録メールの送信処理でエラー:", mailErr);
    }

    // ログインID（メール）とパスワードを返す（サンクスページ表示用）
    return NextResponse.json({ login_id: emailNormalized, password: pw });
  } catch (err) {
    console.error("Archive register error:", err);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}
