// 録画配信の会員グループ（流入元）の表示名を一元管理
export type ArchiveGroup = "a" | "b";

export const ARCHIVE_GROUPS: ArchiveGroup[] = ["a", "b"];

// グループ → 表示名
export const ARCHIVE_GROUP_LABELS: Record<ArchiveGroup, string> = {
  a: "植田版",
  b: "上田版",
};

// 表示名を取得（未設定時はグループaの表示名にフォールバック）
export function archiveGroupLabel(group: string | null | undefined): string {
  if (group === "b") return ARCHIVE_GROUP_LABELS.b;
  return ARCHIVE_GROUP_LABELS.a;
}
