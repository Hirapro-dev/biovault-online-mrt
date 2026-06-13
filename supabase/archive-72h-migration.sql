-- ============================================
-- 視聴制限を「回数」から「初回再生から72時間」に変更するマイグレーション
-- Supabase SQL Editor で実行してください
-- ============================================

-- archive_views に初回再生時刻カラムを追加
ALTER TABLE archive_views
  ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMPTZ;

-- 既存レコードは作成時刻（＝初回再生時刻）で補完
UPDATE archive_views
  SET first_viewed_at = created_at
  WHERE first_viewed_at IS NULL;

-- ※ archive_videos.max_views は今後使用しません（残しても無害。削除する場合は下記をコメント解除）
-- ALTER TABLE archive_videos DROP COLUMN IF EXISTS max_views;
