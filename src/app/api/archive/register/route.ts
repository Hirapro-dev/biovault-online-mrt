import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { generateViewerId } from "@/lib/utils/kana-to-romaji";
import { sendRegistrationEmail, sendAdminNotificationEmail } from "@/lib/email";
import { archiveGroupLabel } from "@/lib/archive-group";

// 録画配信会員の登録
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, name_kana, phone, email, address, viewer_id, confidentiality_agreed, member_group } =
      body as {
        name?: string;
        name_kana?: string;
        phone?: string;
        email?: string;
        address?: string;
        viewer_id?: string;
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
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: "メールアドレスを正しく入力してください" }, { status: 400 });
    }
    if (!address?.trim()) {
      return NextResponse.json({ error: "住所を入力してください" }, { status: 400 });
    }
    if (confidentiality_agreed !== true) {
      return NextResponse.json({ error: "機密保持契約への同意が必要です" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // 視聴ID: 苗字ローマ字 + 電話下4桁（クライアント生成値を優先、無ければサーバーで再生成）
    const memberId =
      viewer_id?.trim() || generateViewerId(name_kana, phoneDigits);
    if (!memberId) {
      return NextResponse.json(
        { error: "視聴IDを生成できませんでした。ふりがな・電話番号をご確認ください" },
        { status: 400 }
      );
    }

    // 同一IDの重複チェック（同姓 + 電話下4桁が一致するケース）
    const { data: existing } = await supabase
      .from("archive_members")
      .select("id")
      .eq("member_id", memberId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: "この視聴IDは既に登録されています（既にご登録済みの可能性があります）" },
        { status: 409 }
      );
    }

    // パスワード: 電話番号の下8桁
    const password = phoneDigits.slice(-8);

    const { error: insertError } = await supabase.from("archive_members").insert({
      member_id: memberId,
      password,
      name: name.trim(),
      name_kana: name_kana.trim(),
      phone: phone!.trim(),
      email: email.trim(),
      address: address.trim(),
      confidentiality_agreed: true,
      member_group: member_group === "b" ? "b" : "a",
    });

    if (insertError) {
      console.error("Archive register insert error:", insertError);
      return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 });
    }

    // 登録完了の自動返信メールを送信（会員の流入元グループに応じた視聴ページURLを案内）
    // メール送信の失敗は登録自体の成否に影響させない
    try {
      const group = member_group === "b" ? "b" : "a";
      const groupKey = group === "b" ? "watch_page_url_b" : "watch_page_url_a";
      const { data: settings } = await supabase
        .from("archive_settings")
        .select("key, value")
        .in("key", [groupKey, "watch_page_url"]);
      const settingMap: Record<string, string> = {};
      (settings as { key: string; value: string }[] | null)?.forEach((s) => {
        settingMap[s.key] = s.value;
      });
      const watchPageUrl =
        settingMap[groupKey] ||
        settingMap["watch_page_url"] ||
        `${process.env.NEXT_PUBLIC_APP_URL || ""}/archive/login`;

      // 会員への自動返信と管理者への通知を並行送信
      await Promise.all([
        sendRegistrationEmail({
          to: email.trim(),
          name: name.trim(),
          memberId,
          password,
          watchPageUrl,
        }),
        sendAdminNotificationEmail({
          name: name.trim(),
          nameKana: name_kana.trim(),
          phone: phone!.trim(),
          email: email.trim(),
          address: address.trim(),
          memberId,
          groupLabel: archiveGroupLabel(group),
        }),
      ]);
    } catch (mailErr) {
      console.error("登録メールの送信処理でエラー:", mailErr);
    }

    return NextResponse.json({ member_id: memberId, password });
  } catch (err) {
    console.error("Archive register error:", err);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}
