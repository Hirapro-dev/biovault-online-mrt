// 顧客（管理者が登録、IDを発行）
export interface Customer {
  id: string;
  customer_id: string;
  name: string;
  name_kana: string | null;
  phone: string | null;
  email: string | null;
  memo: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// スケジュール（配信予定）
export interface Schedule {
  id: string;
  title: string;
  speaker: string | null;
  description: string | null;
  slug: string;
  scheduled_start: string;
  scheduled_end: string | null;
  auto_end_hours: number;
  actual_start: string | null;
  actual_end: string | null;
  zoom_meeting_number: string | null;
  zoom_password: string | null;
  waiting_image_url: string;
  ended_image_url: string;
  is_test_live: boolean;
  status: StreamStatus;
  created_at: string;
  updated_at: string;
}

// 視聴アクセスログ
export interface ViewerAccessLog {
  id: string;
  schedule_id: string;
  customer_id: string;
  accessed_at: string;
}

// 視聴セッション
export interface ViewerSession {
  id: string;
  schedule_id: string;
  customer_id: string;
  joined_at: string;
  left_at: string | null;
  duration_seconds: number | null;
  is_active: boolean;
}

// チャットメッセージ
export interface ChatMessage {
  id: string;
  schedule_id: string;
  customer_id: string;
  display_name: string;
  content: string;
  status: "pending" | "approved" | "rejected" | "deleted";
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
}

export type StreamStatus = "upcoming" | "live" | "ended";

// ============================================
// 録画配信システム
// ============================================

// 録画配信会員（機密保持同意者）
export interface ArchiveMember {
  id: string;
  member_id: string; // 苗字(ローマ字) + ランダム4桁数字
  password: string; // 電話番号下8桁
  name: string;
  name_kana: string;
  phone: string;
  email: string;
  address: string;
  confidentiality_agreed: boolean;
  is_active: boolean;
  created_at: string;
}

// 録画動画
export interface ArchiveVideo {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  r2_key: string;
  duration_seconds: number | null;
  thumbnail_r2_key: string | null;
  published_at: string | null;
  expires_at: string | null;
  max_views: number;
  is_active: boolean;
  created_at: string;
}

// 視聴ログ（会員×動画ごとの集計）
export interface ArchiveView {
  id: string;
  member_id: string;
  video_id: string;
  view_count: number;
  total_watch_seconds: number | null;
  last_viewed_at: string | null;
  created_at: string;
}

// 再生履歴（1回の再生ごと）
export interface ArchivePlayLog {
  id: string;
  member_id: string;
  video_id: string;
  played_at: string;
}
