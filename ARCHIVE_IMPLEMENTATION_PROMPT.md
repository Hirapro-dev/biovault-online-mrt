# 録画配信システム実装依頼

## プロジェクト概要

Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Supabase + Cloudflare R2 で構築されたライブ配信プラットフォームに、録画配信システムを追加実装してください。

## 技術スタック

- Next.js 14 (App Router) / TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (PostgreSQL + Auth + Realtime)
- Cloudflare R2（動画ストレージ）
- Vercel（デプロイ先）

---

## 既存構造の把握（触らないこと）

- `/src/app/login/` — 既存ログイン（変更禁止）
- `/src/app/admin/` — 既存管理画面（メニュー追加のみ許可）
- `/src/app/watch/` — 既存ライブ視聴（変更禁止）
- `/src/lib/supabase/` — 既存Supabaseクライアント（流用可）

---

## 実装スコープ

### ユーザー側：新規ルート

| ルート | 内容 |
|---|---|
| `/archive/register` | 機密保持契約 + 登録フォーム |
| `/archive/thanks` | ID/PW発行・表示ページ |
| `/archive/login` | 録画配信専用ログイン |
| `/archive` | 視聴可能な動画一覧 |
| `/archive/[slug]` | 録画視聴ページ |

### 管理者側：追加ルート

| ルート | 内容 |
|---|---|
| `/admin/archive/members` | 会員一覧 |
| `/admin/archive/videos` | 動画管理（アップロード・公開期間設定） |
| `/admin/archive/videos/[id]` | 動画詳細・アクセスログ |
| `/admin/archive/logs` | 全体視聴ログ |

---

## DBテーブル定義（Supabase）

`supabase/archive-setup.sql` として作成してください。

```sql
-- 録画配信会員
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
  expires_at TIMESTAMPTZ,               -- 公開終了日時
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 視聴ログ（会員×動画ごと）
CREATE TABLE archive_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT NOT NULL REFERENCES archive_members(member_id),
  video_id UUID NOT NULL REFERENCES archive_videos(id),
  view_count INTEGER NOT NULL DEFAULT 0, -- 累計再生回数（上限3回）
  total_watch_seconds INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, video_id)
);

-- サービス設定（視聴ページURLなど管理画面で変更可能な設定値）
CREATE TABLE archive_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初期設定
INSERT INTO archive_settings (key, value) VALUES
  ('watch_page_url', 'https://example.com/archive');
```

---

## 各機能の詳細仕様

### 登録フォーム（`/archive/register`）

フォーム項目：

- 氏名（漢字）
- 氏名（かな）
- 電話番号
- メールアドレス
- 住所
- 機密保持同意チェックボックス（契約全文を表示した上で同意）

送信後の処理：

1. `member_id` 生成: 苗字のかなをローマ字変換 + ランダム4桁数字（例: `yamada4821`）
2. `password`: 電話番号の下8桁（ハイフン除去後）
3. Supabaseの `archive_members` テーブルにINSERT
4. `/archive/thanks` にリダイレクト（IDとPWをsearchParamsで渡す）

### サンクスページ（`/archive/thanks`）

- 発行されたIDとパスワードを大きく表示
- 「コピー」ボタン
- `archive_settings` の `watch_page_url` から取得した視聴ページURLへのリンクを表示

### ログイン（`/archive/login`）

- `member_id` + `password` で認証
- セッションをhttpOnlyクッキーに保存
- 認証後は `/archive` にリダイレクト

### 動画一覧（`/archive`）

- 要認証（未ログインは `/archive/login` へリダイレクト）
- `published_at` 〜 `expires_at` の期間内の動画のみ表示
- 各動画カードに残り視聴回数を表示（`3 - view_count`）

### 視聴ページ（`/archive/[slug]`）

- 要認証
- 公開期限チェック（期限外はアクセス不可のメッセージ表示）
- 再生ボタン押下時に `/api/archive/play-check` へPOST
  - 視聴回数が3未満 → R2署名付きURL（有効期限2時間）を返却 + `view_count` をインクリメント
  - 視聴回数が3以上 → 403「視聴回数の上限（3回）に達しました」
- 動画プレーヤーはHTML5 `<video>` タグを使用
- 残り視聴回数をUIに常時表示

### R2署名付きURL生成（`/api/archive/play-check`）

```typescript
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})
// 有効期限: 7200秒（2時間）
```

### 動画アップロード（`/admin/archive/videos/new`）

マルチパートアップロード対応（100MB以上の動画）

アップロードフロー：

1. フロントから `/api/archive/upload-url` にPOST（ファイル名・サイズを送信）
2. サーバーがR2のPresigned URLを生成して返却
3. フロントが直接R2にPUT（進捗バー表示）
4. 完了後に `archive_videos` テーブルに登録

設定項目：タイトル・スラッグ（自動生成+手動修正可）・説明・公開開始日時・公開終了日時・サムネイル

### 管理画面：動画詳細（`/admin/archive/videos/[id]`）

表示内容：

- 動画情報（タイトル・公開期間・視聴回数合計）
- 会員別視聴ログ一覧（会員名・視聴回数・最終視聴日時・合計視聴時間）

### 管理画面：全体ログ（`/admin/archive/logs`）

表示内容：

- 日付・会員名・動画タイトル・視聴回数・視聴時間のテーブル
- 会員でフィルター・動画でフィルター
- CSV出力ボタン

---

## 環境変数（`.env.local` に追加）

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=biovault-archive
```

---

## 追加パッケージ（インストール必要）

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

---

## コーディング規約

- すべてのコメントは日本語
- `any` を使わず明示的な型付け
- APIルートは `src/app/api/` 配下に `route.ts` で実装
- コンポーネントは shadcn/ui のパターンに揃える
- 既存ファイルは指示された範囲のみ変更すること

---

## 実装順序

1. `supabase/archive-setup.sql` — テーブル作成SQL
2. `src/types/index.ts` — 型定義の追加
3. ユーザー側フロー（`register` → `thanks` → `login` → `archive` → `archive/[slug]`）
4. APIルート（`play-check` / `upload-url`）
5. 管理画面（`members` / `videos` / `logs`）
6. 既存の管理画面サイドバーに録画配信メニューを追加

---

確認なしで全部やりきってください。途中で止まらないで。
