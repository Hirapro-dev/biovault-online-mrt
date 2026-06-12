-- ============================================
-- グループA/B出し分け対応マイグレーション
-- Supabase SQL Editor で実行してください
-- ============================================

-- archive_members にグループカラムを追加（既存会員はデフォルトでグループa）
ALTER TABLE archive_members
  ADD COLUMN IF NOT EXISTS member_group TEXT NOT NULL DEFAULT 'a'
    CHECK (member_group IN ('a', 'b'));

-- archive_videos に視聴可能グループ配列カラムを追加（既存動画はA/B両方）
ALTER TABLE archive_videos
  ADD COLUMN IF NOT EXISTS allowed_groups TEXT[] NOT NULL DEFAULT ARRAY['a','b'];
