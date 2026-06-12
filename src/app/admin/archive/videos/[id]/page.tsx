"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ArchiveVideo, ArchiveView } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Trash2, Copy, Check, ExternalLink } from "lucide-react";
import Link from "next/link";

// 会員情報付きの視聴ログ
interface ViewWithMember extends ArchiveView {
  archive_members: { name: string; name_kana: string } | null;
}

// datetime-local用のフォーマット変換
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 秒数を「○時間○分○秒」に変換
function formatSeconds(seconds: number | null): string {
  const s = seconds ?? 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}時間${m}分`;
  if (m > 0) return `${m}分${sec}秒`;
  return `${sec}秒`;
}

// 管理画面：動画詳細・編集・視聴ログ
export default function ArchiveVideoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [video, setVideo] = useState<ArchiveVideo | null>(null);
  const [views, setViews] = useState<ViewWithMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  // 編集フォーム
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxViews, setMaxViews] = useState("3");
  const [allowedGroups, setAllowedGroups] = useState<("a" | "b")[]>(["a", "b"]);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [{ data: videoData }, { data: viewData }] = await Promise.all([
      supabase.from("archive_videos").select("*").eq("id", params.id).single(),
      supabase
        .from("archive_views")
        .select("*, archive_members(name, name_kana)")
        .eq("video_id", params.id)
        .order("last_viewed_at", { ascending: false }),
    ]);

    if (videoData) {
      const v = videoData as ArchiveVideo;
      setVideo(v);
      setTitle(v.title);
      setDescription(v.description || "");
      setPublishedAt(toLocalInputValue(v.published_at));
      setExpiresAt(toLocalInputValue(v.expires_at));
      setMaxViews(String(v.max_views));
      setAllowedGroups((v.allowed_groups ?? ["a", "b"]) as ("a" | "b")[]);
    }
    setViews((viewData as ViewWithMember[]) || []);
    setIsLoading(false);
  }, [params.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 動画情報の保存（サムネイル差し替えにも対応）
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 新しいサムネイルが選択されていればR2へアップロード
      let thumbnailR2Key: string | undefined;
      if (thumbnailFile) {
        const initRes = await fetch("/api/archive/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "init",
            kind: "thumbnail",
            file_name: thumbnailFile.name,
            file_size: thumbnailFile.size,
            content_type: thumbnailFile.type || "image/jpeg",
          }),
        });
        const init = await initRes.json();
        if (!initRes.ok) throw new Error(init.error || "サムネイルURLの取得に失敗しました");

        const putRes = await fetch(init.url, {
          method: "PUT",
          headers: { "Content-Type": thumbnailFile.type || "image/jpeg" },
          body: thumbnailFile,
        });
        if (!putRes.ok) throw new Error("サムネイルのアップロードに失敗しました");
        thumbnailR2Key = init.r2_key;
      }

      const supabase = createClient();
      const { error } = await supabase
        .from("archive_videos")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          max_views: parseInt(maxViews, 10) || 3,
          allowed_groups: allowedGroups,
          ...(thumbnailR2Key ? { thumbnail_r2_key: thumbnailR2Key } : {}),
        })
        .eq("id", params.id);
      if (error) throw new Error("保存に失敗しました");

      toast({ title: "動画情報を保存しました" });
      setThumbnailFile(null);
      fetchData();
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "保存に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 動画の削除（DBレコードのみ。R2上のファイルは残る）
  const handleDelete = async () => {
    if (!confirm("この動画を削除しますか？視聴ログも削除されます。")) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("archive_videos")
      .delete()
      .eq("id", params.id);
    if (error) {
      toast({ title: "削除に失敗しました", variant: "destructive" });
    } else {
      toast({ title: "動画を削除しました" });
      router.push("/admin/archive/videos");
    }
  };

  if (isLoading) {
    return <p className="py-8 text-center text-muted-foreground">読み込み中...</p>;
  }
  if (!video) {
    return <p className="py-8 text-center text-muted-foreground">動画が見つかりません</p>;
  }

  const totalViews = views.reduce((sum, v) => sum + v.view_count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/archive/videos">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{video.title}</h1>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-2">
          <Trash2 className="h-4 w-4" />
          削除
        </Button>
      </div>

      {/* サマリー */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">視聴会員数</p>
            <p className="text-2xl font-bold">{views.length}名</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">合計再生回数</p>
            <p className="text-2xl font-bold">{totalViews}回</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">視聴URL</p>
            <div className="flex items-center gap-1">
              {/* クリックで視聴ページを新しいタブで開く（管理者ログイン中は会員ログイン不要） */}
              <a
                href={`/archive/${video.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-mono text-sm text-primary hover:underline"
              >
                /archive/{video.slug}
                <ExternalLink className="h-3 w-3" />
              </a>
              {/* フルURLをコピー */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}/archive/${video.slug}`
                  );
                  setUrlCopied(true);
                  toast({ title: "視聴URLをコピーしました" });
                  setTimeout(() => setUrlCopied(false), 2000);
                }}
              >
                {urlCopied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 編集フォーム */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">動画情報の編集</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>タイトル</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>説明</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>公開開始日時</Label>
              <Input
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>公開終了日時</Label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>視聴回数上限</Label>
              <Input
                type="number"
                min="1"
                value={maxViews}
                onChange={(e) => setMaxViews(e.target.value)}
              />
            </div>
          </div>
          {/* 視聴可能グループ */}
          <div className="space-y-2">
            <Label>視聴可能グループ</Label>
            <div className="flex gap-4">
              {(["a", "b"] as const).map((g) => (
                <label key={g} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={allowedGroups.includes(g)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAllowedGroups((prev) => [...prev, g]);
                      } else {
                        setAllowedGroups((prev) => prev.filter((x) => x !== g));
                      }
                    }}
                    className="h-4 w-4 rounded border-border"
                  />
                  グループ {g.toUpperCase()}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              選択したグループの会員のみ視聴できます
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>サムネイル画像</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-muted-foreground">
              {video.thumbnail_r2_key
                ? "設定済み（新しい画像を選択すると差し替わります）"
                : "未設定（画像を選択して保存するとサムネイルが設定されます）"}
            </p>
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? "保存中..." : "保存"}
          </Button>
        </CardContent>
      </Card>

      {/* 会員別視聴ログ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">会員別視聴ログ</CardTitle>
        </CardHeader>
        <CardContent>
          {views.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              まだ視聴されていません
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-2 py-2">視聴ID</th>
                    <th className="px-2 py-2">氏名</th>
                    <th className="px-2 py-2">再生回数</th>
                    <th className="px-2 py-2">合計視聴時間</th>
                    <th className="px-2 py-2">最終視聴日時</th>
                  </tr>
                </thead>
                <tbody>
                  {views.map((v) => (
                    <tr key={v.id} className="border-b hover:bg-muted/50">
                      <td className="px-2 py-2 font-mono">{v.member_id}</td>
                      <td className="px-2 py-2">{v.archive_members?.name || "—"}</td>
                      <td className="px-2 py-2">
                        {v.view_count} / {video.max_views}回
                      </td>
                      <td className="px-2 py-2">{formatSeconds(v.total_watch_seconds)}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                        {v.last_viewed_at
                          ? new Date(v.last_viewed_at).toLocaleString("ja-JP")
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
