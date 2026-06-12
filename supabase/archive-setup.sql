-- ============================================
-- 録画配信システム DB Setup
-- Supabase SQL Editor で実行してください
-- ============================================

-- 録画配信会員（機密保持同意者）
CREATE TABLE archive_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT UNIQUE NOT NULL,        -- 苗字(ローマ字) + ランダム4桁数字 例: yamada1234
  password TEXT NOT NULL,                -- 電話番号下8桁
  name TEXT NOT NULL,
  name_kana TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL,
  confidentiality_agreed BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 録画動画
CREATE TABLE archive_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  r2_key TEXT NOT NULL,                  -- R2上のオブジェクトキー
  duration_seconds INTEGER,
  thumbnail_r2_key TEXT,
  published_at TIMESTAMPTZ,              -- 公開開始日時
  expires_at TIMESTAMPTZ,                -- 公開終了日時
  max_views INTEGER NOT NULL DEFAULT 3,  -- 1会員あたりの視聴回数上限
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 視聴ログ（会員×動画ごとの集計）
CREATE TABLE archive_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT NOT NULL REFERENCES archive_members(member_id),
  video_id UUID NOT NULL REFERENCES archive_videos(id) ON DELETE CASCADE,
  view_count INTEGER NOT NULL DEFAULT 0, -- 累計再生回数（上限はarchive_videos.max_views）
  total_watch_seconds INTEGER DEFAULT 0, -- 合計視聴時間（秒）
  last_viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, video_id)
);

-- 再生履歴（1回の再生ごとの記録）
CREATE TABLE archive_play_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT NOT NULL REFERENCES archive_members(member_id),
  video_id UUID NOT NULL REFERENCES archive_videos(id) ON DELETE CASCADE,
  played_at TIMESTAMPTZ DEFAULT NOW()
);

-- サービス設定（サンクスページに表示する視聴ページURLなど）
CREATE TABLE archive_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初期設定（視聴ページURL：管理画面で変更可能）
INSERT INTO archive_settings (key, value) VALUES
  ('watch_page_url', '/archive/login');

-- インデックス
CREATE INDEX idx_archive_views_video ON archive_views(video_id);
CREATE INDEX idx_archive_views_member ON archive_views(member_id);
CREATE INDEX idx_archive_play_logs_video ON archive_play_logs(video_id);

-- ============================================
-- RLS（行レベルセキュリティ）
-- ユーザー側の読み書きはすべてサーバーAPI（service_role）経由のため
-- anonからの直接アクセスは全て拒否し、管理者（authenticated）のみ参照可
-- ============================================

ALTER TABLE archive_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive_play_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive_settings ENABLE ROW LEVEL SECURITY;

-- 管理者（Supabase Authでログイン済み）はすべて操作可能
CREATE POLICY "admin all on archive_members" ON archive_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin all on archive_videos" ON archive_videos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin all on archive_views" ON archive_views
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin all on archive_play_logs" ON archive_play_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin all on archive_settings" ON archive_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
