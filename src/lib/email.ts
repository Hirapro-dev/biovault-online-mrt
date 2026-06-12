/**
 * Amazon SES によるメール送信
 * 環境変数:
 *   SES_REGION              SESのリージョン（例: ap-northeast-1）
 *   SES_ACCESS_KEY_ID       SES送信用のIAMアクセスキー
 *   SES_SECRET_ACCESS_KEY   SES送信用のIAMシークレットキー
 *   MAIL_FROM               送信元アドレス（例: no-reply@mrt.co.jp）
 *   MAIL_FROM_NAME          送信元表示名（任意・例: BioVault録画配信）
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
  html: string;
  text: string;
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

  try {
    await getSesClient().send(
      new SendEmailCommand({
        Source: source,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: html, Charset: "UTF-8" },
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
  memberId: string;
  password: string;
  watchPageUrl: string;
}

// 録画配信 登録完了の自動返信メールを送信
export async function sendRegistrationEmail(
  params: RegistrationMailParams
): Promise<boolean> {
  const { to, name, memberId, password, watchPageUrl } = params;
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

  const html = `<!DOCTYPE html>
<html lang="ja">
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Hiragino Sans','Yu Gothic',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:linear-gradient(90deg,#0d9488,#06b6d4);padding:24px 32px;">
              <p style="margin:0;color:#ffffff;font-size:18px;font-weight:bold;">録画配信 視聴登録完了</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#0f172a;">${name} 様</p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.8;color:#334155;">
                この度は録画配信の視聴登録をいただき、誠にありがとうございます。<br>
                以下のID・パスワードでログインのうえご視聴いただけます。
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;margin-bottom:24px;">
                <tr><td style="padding:16px 20px;">
                  <p style="margin:0 0 4px;font-size:11px;color:#64748b;letter-spacing:1px;">ログインID</p>
                  <p style="margin:0 0 14px;font-size:18px;font-weight:bold;color:#0f766e;font-family:monospace;">${memberId}</p>
                  <p style="margin:0 0 4px;font-size:11px;color:#64748b;letter-spacing:1px;">パスワード</p>
                  <p style="margin:0;font-size:18px;font-weight:bold;color:#0f766e;font-family:monospace;">${password}</p>
                </td></tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr><td align="center">
                  <a href="${watchPageUrl}" style="display:inline-block;background:linear-gradient(90deg,#0d9488,#06b6d4);color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 32px;border-radius:8px;">視聴ページへ進む</a>
                </td></tr>
              </table>

              <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#b45309;">ご注意事項</p>
                <ul style="margin:0;padding-left:18px;font-size:12px;line-height:1.9;color:#78350f;">
                  <li>本配信に含まれる情報は機密情報です。視聴者本人以外への開示・漏えいは禁止されています。</li>
                  <li>動画の録画・スクリーンショット・複製は禁止されています。</li>
                  <li>ID・パスワードは大切に保管し、第三者と共有しないでください。</li>
                </ul>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#0f172a;padding:16px 32px;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">本メールは送信専用です。ご返信いただいてもお答えできかねます。</p>
              <p style="margin:4px 0 0;font-size:11px;color:#64748b;">© MRT inc. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return sendEmail({ to, subject, html, text });
}
