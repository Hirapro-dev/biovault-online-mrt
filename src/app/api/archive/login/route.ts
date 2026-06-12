import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  ARCHIVE_SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/archive-auth";

// 録画配信会員のログイン
export async function POST(request: NextRequest) {
  try {
    const { member_id, password } = (await request.json()) as {
      member_id?: string;
      password?: string;
    };

    if (!member_id?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: "IDとパスワードを入力してください" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const { data: member, error } = await supabase
      .from("archive_members")
      .select("member_id, password, name, is_active, member_group")
      .eq("member_id", member_id.trim())
      .single();

    if (error || !member || member.password !== password.trim()) {
      return NextResponse.json(
        { error: "IDまたはパスワードが正しくありません" },
        { status: 401 }
      );
    }

    if (!member.is_active) {
      return NextResponse.json(
        { error: "このアカウントは現在無効です" },
        { status: 403 }
      );
    }

    // ログイン後の遷移先（会員の流入元グループに対応する視聴ページURL）を取得
    // グループ別URL → 旧共通URL → デフォルトの順でフォールバック
    const groupKey = member.member_group === "b" ? "watch_page_url_b" : "watch_page_url_a";
    const { data: settings } = await supabase
      .from("archive_settings")
      .select("key, value")
      .in("key", [groupKey, "watch_page_url"]);
    const settingMap: Record<string, string> = {};
    (settings as { key: string; value: string }[] | null)?.forEach((s) => {
      settingMap[s.key] = s.value;
    });
    const redirectUrl =
      settingMap[groupKey] || settingMap["watch_page_url"] || "/archive";

    // セッションクッキーを発行
    const token = createSessionToken(member.member_id);
    const response = NextResponse.json({
      member_id: member.member_id,
      name: member.name,
      redirect_url: redirectUrl,
    });
    response.cookies.set(ARCHIVE_SESSION_COOKIE, token, sessionCookieOptions);
    return response;
  } catch (err) {
    console.error("Archive login error:", err);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}

// ログアウト
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ARCHIVE_SESSION_COOKIE, "", {
    ...sessionCookieOptions,
    maxAge: 0,
  });
  return response;
}
