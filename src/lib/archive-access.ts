// 録画配信の視聴期限ロジック
// 動画ごとの初回再生から一定時間で視聴不可になる（回数制限ではなく時間制限）

// 初回再生からの視聴可能時間（時間）
export const ACCESS_WINDOW_HOURS = 72;

const WINDOW_MS = ACCESS_WINDOW_HOURS * 60 * 60 * 1000;

// 初回再生時刻から視聴期限（締切）を算出する
export function calcAccessDeadline(firstViewedAt: string | Date): Date {
  const start = new Date(firstViewedAt).getTime();
  return new Date(start + WINDOW_MS);
}

// 初回再生時刻を基準に、現在が視聴期限を過ぎているか判定する
// firstViewedAt が無い（未再生）の場合は false（まだ視聴可能）
export function isAccessExpired(
  firstViewedAt: string | Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (!firstViewedAt) return false;
  return now.getTime() > calcAccessDeadline(firstViewedAt).getTime();
}
