/**
 * Amazon SES によるメール送信
 * 環境変数:
 *   SES_REGION              SESのリージョン（例: ap-northeast-1）
 *   SES_ACCESS_KEY_ID       SES送信用のIAMアクセスキー
 *   SES_SECRET_ACCESS_KEY   SES送信用のIAMシークレットキー
 *   MAIL_FROM               送信元アドレス（例: no-reply@mrt.co.jp）
 *   MAIL_FROM_NAME          送信元表示名（任意・例: BioVault録画配信）
 *   MAIL_ADMIN_TO           管理者通知メールの宛先（カンマ区切りで複数可）
 */
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

let cachedClient: SESClient | null = null;

function getSesClient(): SESClient {
  if (cachedClient) return cachedClient;
  cachedClient = new SESClient({
    region: process.env.SES_REGION || "ap-northeast-1",
    credentials: {
      accessKeyId: process.env.SES_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.SES_SECRET_ACCESS_KEY || "",
    },
  });
  return cachedClient;
}

// SESの送信設定が揃っているか
export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.SES_ACCESS_KEY_ID &&
      process.env.SES_SECRET_ACCESS_KEY &&
      process.env.MAIL_FROM
  );
}

interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string; // 省略時はテキストのみのメール
}

// メール送信（SES未設定時は false を返して呼び出し側で握りつぶす）
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailParams): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn("SESが未設定のためメール送信をスキップしました");
    return false;
  }

  const fromName = process.env.MAIL_FROM_NAME || "BioVault録画配信";
  const fromAddress = process.env.MAIL_FROM!;
  // 表示名に日本語を含むためRFC 2047形式でエンコード
  const source = `=?UTF-8?B?${Buffer.from(fromName).toString("base64")}?= <${fromAddress}>`;
  // 宛先はカンマ区切りで複数指定に対応
  const toAddresses = to
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  try {
    await getSesClient().send(
      new SendEmailCommand({
        Source: source,
        Destination: { ToAddresses: toAddresses },
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            // htmlがある場合のみHTMLパートを付与
            ...(html ? { Html: { Data: html, Charset: "UTF-8" } } : {}),
            Text: { Data: text, Charset: "UTF-8" },
          },
        },
      })
    );
    return true;
  } catch (err) {
    console.error("メール送信に失敗しました:", err);
    return false;
  }
}

interface RegistrationMailParams {
  to: string;
  name: string;
  loginId: string; // ログインID（メールアドレス）
  password: string;
  watchPageUrl: string;
}

// 登録完了メールのHTMLを生成（プレビューでも再利用）
export function buildRegistrationEmailHtml(params: {
  name: string;
  loginId: string;
  password: string;
  watchPageUrl: string;
}): string {
  const { name, loginId, password, watchPageUrl } = params;
  const memberId = loginId;
  // メール内の画像・ボタンは絶対URLが必要
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bvlive.mrt.co.jp";
  const personImg = `${baseUrl}/nagashima_black03.png`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  /* スマホ表示時は「人物画像 → カード」の縦積みに切り替え */
  @media only screen and (max-width:480px) {
    .bv-2col { display:none !important; max-height:0 !important; overflow:hidden !important; }
    .bv-stack { display:block !important; max-height:none !important; overflow:visible !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#eef0f4;font-family:'Hiragino Sans','Yu Gothic',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f4;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">
          <!-- ヘッダー（グラデーション） -->
          <tr>
            <td style="background:#5b2be0;background:linear-gradient(90deg,#5b2be0,#2bb8d8);padding:28px 36px;">
              <p style="margin:0;color:#ffffff;font-size:26px;font-weight:bold;font-family:Georgia,serif;">BioVault</p>
              <p style="margin:6px 0 0;color:#e7e9ff;font-size:12px;letter-spacing:0.3em;">Membership Service</p>
            </td>
          </tr>
          <!-- 本文 -->
          <tr>
            <td style="padding:32px 36px 8px;">
              <p style="margin:0 0 18px;font-size:20px;font-weight:bold;color:#0f172a;">${name} 様</p>
              <p style="margin:0 0 8px;font-size:15px;line-height:1.9;color:#334155;">BioVault メンバーシップへようこそ。</p>
              <p style="margin:0;font-size:15px;line-height:1.9;color:#334155;">会員アカウントが発行されました。以下の情報でログインしてください。</p>
            </td>
          </tr>
          <!-- PC：カード（左）＋ 人物画像（右）の横並び -->
          <tr class="bv-2col">
            <td style="padding:8px 28px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle" width="56%" style="padding:0 8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4fb;border-radius:12px;">
                      <tr><td style="padding:20px 24px;">
                        <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">ログインID</p>
                        <p style="margin:0 0 16px;font-size:18px;font-weight:bold;color:#1d4ed8;font-family:'Courier New',monospace;letter-spacing:1px;">${memberId}</p>
                        <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">パスワード</p>
                        <p style="margin:0;font-size:18px;font-weight:bold;color:#1d4ed8;font-family:'Courier New',monospace;letter-spacing:1px;">${password}</p>
                      </td></tr>
                    </table>
                  </td>
                  <td valign="bottom" width="44%" align="center" style="padding:0 8px;">
                    <img src="${personImg}" alt="" width="200" style="display:block;width:200px;max-width:100%;height:auto;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- スマホ：人物画像 → カード の縦積み（既定は非表示、メディアクエリで表示） -->
          <tr class="bv-stack" style="display:none;max-height:0;overflow:hidden;">
            <td style="padding:8px 28px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td align="center" style="padding:0 0 8px;">
                  <img src="${personImg}" alt="" width="200" style="display:block;width:200px;max-width:70%;height:auto;" />
                </td></tr>
                <tr><td>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4fb;border-radius:12px;">
                    <tr><td style="padding:20px 24px;">
                      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">ログインID</p>
                      <p style="margin:0 0 16px;font-size:18px;font-weight:bold;color:#1d4ed8;font-family:'Courier New',monospace;letter-spacing:1px;">${memberId}</p>
                      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">パスワード</p>
                      <p style="margin:0;font-size:18px;font-weight:bold;color:#1d4ed8;font-family:'Courier New',monospace;letter-spacing:1px;">${password}</p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </td>
          </tr>
          <!-- ボタン -->
          <tr>
            <td align="center" style="padding:24px 36px 8px;">
              <a href="${watchPageUrl}" style="display:inline-block;background:#5b2be0;background:linear-gradient(90deg,#5b2be0,#2bb8d8);color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;padding:16px 56px;border-radius:999px;">ログインページへ</a>
            </td>
          </tr>
          <!-- 注意事項 -->
          <tr>
            <td style="padding:16px 36px 28px;">
              <p style="margin:0 0 6px;font-size:13px;line-height:1.8;color:#64748b;">※ 初回ログイン後、パスワードの変更をお願いいたします。</p>
              <p style="margin:0;font-size:13px;line-height:1.8;color:#64748b;">※ ログイン情報は第三者に知られないよう大切に管理してください。</p>
            </td>
          </tr>
          <!-- フッター -->
          <tr>
            <td style="border-top:1px solid #e5e7eb;padding:24px 36px 28px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:#64748b;">BioVault（株式会社MRT）</p>
              <p style="margin:0 0 12px;font-size:13px;color:#64748b;">TEL: 0120-325-699 ／ MAIL: info@biovault.jp</p>
              <p style="margin:0;font-size:12px;color:#aab2c0;">© ${new Date().getFullYear()} MRT Inc. All Rights Reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// 録画配信 登録完了の自動返信メールを送信
export async function sendRegistrationEmail(
  params: RegistrationMailParams
): Promise<boolean> {
  const { to, name, loginId, password, watchPageUrl } = params;
  const memberId = loginId;
  const subject = "【MRT】録画配信 視聴登録完了のお知らせ";

  const text = `${name} 様

この度は録画配信の視聴登録をいただき、誠にありがとうございます。
以下のID・パスワードでログインのうえご視聴いただけます。

──────────────────────
■ ログインID： ${memberId}
■ パスワード： ${password}
■ 視聴ページ： ${watchPageUrl}
──────────────────────

【ご注意事項】
・本配信に含まれる情報は機密情報です。視聴者本人以外への開示・漏えいは禁止されています。
・動画の録画・スクリーンショット・複製は禁止されています。
・ID・パスワードは大切に保管し、第三者と共有しないでください。

本メールは送信専用です。ご返信いただいてもお答えできかねます。

────────────────────────
株式会社MRT
────────────────────────`;

  const html = buildRegistrationEmailHtml({ name, loginId, password, watchPageUrl });

  return sendEmail({ to, subject, html, text });
}

interface AdminNotificationParams {
  name: string;
  nameKana: string;
  phone: string;
  email: string;
  zipCode: string; // 郵便番号
  address: string; // 郵便番号を除いた住所
  memberId: string;
  groupLabel: string; // 流入元の表示名（植田版 / 上田版）
}

// 管理者へ新規登録の通知メールを送信（テキストのみ）
// 宛先は環境変数 MAIL_ADMIN_TO（カンマ区切りで複数可）
export async function sendAdminNotificationEmail(
  params: AdminNotificationParams
): Promise<boolean> {
  // 管理者通知の宛先（環境変数があれば優先、無ければ既定の宛先に送信）
  const DEFAULT_ADMIN_TO = [
    "bvlive-app@mrt.co.jp",
    "y3awtd-hirayama-p@hdbronze.htdb.jp",
    "mailmagazine.entry@gmail.com",
  ].join(",");
  const adminTo = process.env.MAIL_ADMIN_TO || DEFAULT_ADMIN_TO;

  const { name, nameKana, phone, email, zipCode, address, memberId, groupLabel } = params;
  const subject = `【録画配信】新規登録: ${name} 様（${groupLabel}）`;

  const text = `録画配信に新しい会員登録がありました。

BioVaultLive配信録画視聴機密保持ページ

──────────────────────
■ 流入元　： ${groupLabel}
■ 視聴ID　： ${memberId}
■ 氏名　　： ${name}
■ ふりがな： ${nameKana}
■ 電話番号： ${phone}
■ メール　： ${email}
■ 郵便番号： ${zipCode || "（未入力）"}
■ 住所　　： ${address || "（未入力）"}
■ 機密保持： 同意チェックあり
──────────────────────

会員一覧: 管理画面 → 録画配信 会員一覧 でご確認いただけます。`;

  return sendEmail({ to: adminTo, subject, text });
}
