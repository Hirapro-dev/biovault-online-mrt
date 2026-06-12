/**
 * 録画配信会員のセッション管理
 * HMAC署名付きのhttpOnlyクッキーで認証状態を保持する
 */
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ARCHIVE_SESSION_COOKIE = "archive_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7日間

// 署名用シークレット（専用の環境変数がなければサービスロールキーを流用）
function getSecret(): string {
  return (
    process.env.ARCHIVE_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

/**
 * セッショントークンを生成（member_id.有効期限.署名）
 */
export function createSessionToken(memberId: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const payload = `${memberId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * セッショントークンを検証し、有効ならmember_idを返す
 */
export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return null;

  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  const expected = sign(payload);

  // タイミング攻撃対策の比較
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  const [memberId, expiresAtStr] = payload.split(".");
  const expiresAt = parseInt(expiresAtStr, 10);
  if (!memberId || isNaN(expiresAt)) return null;
  if (Math.floor(Date.now() / 1000) > expiresAt) return null;

  return memberId;
}

/**
 * Server Component / Route Handler からログイン中のmember_idを取得
 */
export function getArchiveMemberId(): string | null {
  const token = cookies().get(ARCHIVE_SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/**
 * 管理者（Supabase Auth + admin_users）としてログイン中かを判定
 * 管理者は録画視聴ページを会員ログインなしで閲覧できる
 */
export async function isAdminSession(): Promise<boolean> {
  // 循環インポート回避のため動的インポート
  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
  const supabase = createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return false;

  const { data: admin } = await supabase
    .from("admin_users")
    .select("id")
    .eq("user_id", session.user.id)
    .single();
  return !!admin;
}

/**
 * セッションクッキーのオプション
 */
export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
};
