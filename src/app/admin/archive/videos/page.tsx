"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { ArchiveVideo } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save } from "lucide-react";

// 公開状態の判定
function getVideoStatus(video: ArchiveVideo): {
  label: string;
  variant: "default" | "secondary" | "destructive";
} {
  const now = new Date();
  if (!video.is_active) return { label: "無効", variant: "destructive" };
  if (video.published_at && new Date(video.published_at) > now)
    return { label: "公開前", variant: "secondary" };
  if (video.expires_at && new Date(video.expires_at) < now)
    return { label: "期限切れ", variant: "destructive" };
  return { label: "公開中", variant: "default" };
}

// 管理画面：録画配信 動画管理
export default function ArchiveVideosPage() {
  const { toast } = useToast();
  const [videos, setVideos] = useState<ArchiveVideo[]>([]);
  const [watchPageUrl, setWatchPageUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingUrl, setIsSavingUrl] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const [{ data: videoData }, { data: setting }] = await Promise.all([
        supabase
          .from("archive_videos")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("archive_settings")
          .select("value")
          .eq("key", "watch_page_url")
          .single(),
      ]);
      setVideos((videoData as ArchiveVideo[]) || []);
      setWatchPageUrl(setting?.value || "");
      setIsLoading(false);
    }
    fetchData();
  }, []);

  // サンクスページに表示する視聴ページURLを保存
  const handleSaveUrl = async () => {
    setIsSavingUrl(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("archive_settings")
      .update({ value: watchPageUrl, updated_at: new Date().toISOString() })
      .eq("key", "watch_page_url");
    setIsSavingUrl(false);
    if (error) {
      toast({ title: "保存に失敗しました", variant: "destructive" });
    } else {
      toast({ title: "視聴ページURLを保存しました" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">録画配信 動画管理</h1>
        <Link href="/admin/archive/videos/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            動画をアップロード
          </Button>
        </Link>
      </div>

      {/* 視聴ページURL設定（ログイン後の遷移先・サンクスページ共通） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">動画視聴ページURL</CardTitle>
          <p className="text-xs text-muted-foreground">
            ログイン後の遷移先、およびサンクスページの「視聴ページへ進む」ボタンの遷移先に使われます。
          </p>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={watchPageUrl}
            onChange={(e) => setWatchPageUrl(e.target.value)}
            placeholder="https://bvlive.mrt.co.jp/archive/00001 など"
          />
          <Button onClick={handleSaveUrl} disabled={isSavingUrl} className="gap-2">
            <Save className="h-4 w-4" />
            保存
          </Button>
        </CardContent>
      </Card>

      {/* 動画一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">動画一覧（{videos.length}件）</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-muted-foreground">読み込み中...</p>
          ) : videos.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              動画がまだありません
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-2 py-2">タイトル</th>
                    <th className="px-2 py-2">スラッグ</th>
                    <th className="px-2 py-2">状態</th>
                    <th className="px-2 py-2">公開開始</th>
                    <th className="px-2 py-2">公開終了</th>
                    <th className="px-2 py-2">上限回数</th>
                  </tr>
                </thead>
                <tbody>
                  {videos.map((video) => {
                    const status = getVideoStatus(video);
                    return (
                      <tr key={video.id} className="border-b hover:bg-muted/50">
                        <td className="px-2 py-2">
                          <Link
                            href={`/admin/archive/videos/${video.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {video.title}
                          </Link>
                        </td>
                        <td className="px-2 py-2 font-mono text-muted-foreground">
                          {video.slug}
                        </td>
                        <td className="px-2 py-2">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                          {video.published_at
                            ? new Date(video.published_at).toLocaleString("ja-JP")
                            : "即時"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                          {video.expires_at
                            ? new Date(video.expires_at).toLocaleString("ja-JP")
                            : "無期限"}
                        </td>
                        <td className="px-2 py-2">{video.max_views}回</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
