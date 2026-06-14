-- ============================================
-- ログインIDをメールアドレス、パスワードを利用者設定に変更する対応
-- Supabase SQL Editor で実行してください
-- ============================================

-- メールアドレスをログインIDとして使うため、一意制約（大文字小文字を無視）を追加
-- ※既存データに重複メールがある場合は、先に重複を解消してから実行してください
CREATE UNIQUE INDEX IF NOT EXISTS archive_members_email_unique
  ON archive_members (lower(email));

-- ※ password 列・member_id 列の構造変更は不要（パスワードは利用者設定値を格納、
--   member_id は内部の紐付け用IDとして引き続き自動生成）
