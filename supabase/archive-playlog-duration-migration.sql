-- ============================================
-- 再生1回ごとの視聴時間を記録するためのマイグレーション
-- Supabase SQL Editor で実行してください
-- ============================================

-- 再生履歴（archive_play_logs）に、その再生での視聴時間（秒）を追加
ALTER TABLE archive_play_logs
  ADD COLUMN IF NOT EXISTS watch_seconds INTEGER NOT NULL DEFAULT 0;

-- 履歴一覧の表示用インデックス（動画ごと・新しい順）
CREATE INDEX IF NOT EXISTS idx_archive_play_logs_video_played
  ON archive_play_logs (video_id, played_at DESC);
