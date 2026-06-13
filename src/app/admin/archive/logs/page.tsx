"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ArchiveView } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ARCHIVE_GROUP_LABELS } from "@/lib/archive-group";
import { Download } from "lucide-react";

// 結合済みの視聴ログ行
interface LogRow extends ArchiveView {
  archive_members: { name: string } | null;
  archive_videos: { title: string; allowed_groups: ("a" | "b")[] | null } | null;
}

// 動画の公開対象グループを表示名（植田版・上田版）に変換
function formatAllowedGroups(groups: ("a" | "b")[] | null | undefined): string {
  if (!groups || groups.length === 0) return "—";
  return groups.map((g) => ARCHIVE_GROUP_LABELS[g]).join("・");
}

// 秒数を「○時間○分」形式に変換
function formatSeconds(seconds: number | null): string {
  const s = seconds ?? 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}時間${m}分`;
  if (m > 0) return `${m}分`;
  return `${s}秒`;
}

// 管理画面：録画配信 全体視聴ログ
export default function ArchiveLogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [memberFilter, setMemberFilter] = useState("all");
  const [videoFilter, setVideoFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      const supabase = createClient();
      const { data } = await supabase
        .from("archive_views")
        .select("*, archive_members(name), archive_videos(title, allowed_groups)")
        .order("last_viewed_at", { ascending: false });
      setLogs((data as LogRow[]) || []);
      setIsLoading(false);
    }
    fetchLogs();
  }, []);

  // フィルター候補
  const memberOptions = useMemo(
    () => Array.from(new Set(logs.map((l) => l.member_id))).sort(),
    [logs]
  );
  const videoOptions = useMemo(
    () =>
      Array.from(
        new Map(logs.map((l) => [l.video_id, l.archive_videos?.title || l.video_id]))
      ),
    [logs]
  );

  const filtered = logs.filter(
    (l) =>
      (memberFilter === "all" || l.member_id === memberFilter) &&
      (videoFilter === "all" || l.video_id === videoFilter)
  );

  // CSV出力
  const handleExportCsv = () => {
    const header = "視聴ID,会員名,動画タイトル,公開対象,再生回数,合計視聴時間(秒),最終視聴日時";
    const rows = filtered.map((l) =>
      [
        l.member_id,
        l.archive_members?.name || "",
        `"${(l.archive_videos?.title || "").replace(/"/g, '""')}"`,
        formatAllowedGroups(l.archive_videos?.allowed_groups),
        l.view_count,
        l.total_watch_seconds ?? 0,
        l.last_viewed_at ? new Date(l.last_viewed_at).toLocaleString("ja-JP") : "",
      ].join(",")
    );
    const csv = "﻿" + [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `archive_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectClass =
    "h-9 rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">録画配信 視聴ログ</h1>
        <Button variant="outline" onClick={handleExportCsv} className="gap-2">
          <Download className="h-4 w-4" />
          CSV出力
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            視聴記録（{filtered.length}件）
          </CardTitle>
          {/* フィルター */}
          <div className="flex flex-wrap gap-3">
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className={selectClass}
            >
              <option value="all">すべての会員</option>
              {memberOptions.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            <select
              value={videoFilter}
              onChange={(e) => setVideoFilter(e.target.value)}
              className={selectClass}
            >
              <option value="all">すべての動画</option>
              {videoOptions.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-muted-foreground">読み込み中...</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              視聴記録がありません
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-2 py-2">視聴ID</th>
                    <th className="px-2 py-2">会員名</th>
                    <th className="px-2 py-2">動画</th>
                    <th className="px-2 py-2">公開対象</th>
                    <th className="px-2 py-2">再生回数</th>
                    <th className="px-2 py-2">合計視聴時間</th>
                    <th className="px-2 py-2">最終視聴日時</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr key={l.id} className="border-b hover:bg-muted/50">
                      <td className="px-2 py-2 font-mono">{l.member_id}</td>
                      <td className="px-2 py-2">{l.archive_members?.name || "—"}</td>
                      <td className="px-2 py-2">{l.archive_videos?.title || "—"}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                        {formatAllowedGroups(l.archive_videos?.allowed_groups)}
                      </td>
                      <td className="px-2 py-2">{l.view_count}回</td>
                      <td className="px-2 py-2">{formatSeconds(l.total_watch_seconds)}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                        {l.last_viewed_at
                          ? new Date(l.last_viewed_at).toLocaleString("ja-JP")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
