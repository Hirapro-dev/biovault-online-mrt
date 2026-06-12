"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";

// XHRでPUTし、進捗を返すヘルパー（fetchは進捗が取れないため）
function putWithProgress(
  url: string,
  body: Blob,
  contentType: string | null,
  onProgress: (loaded: number) => void
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (contentType) xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // マルチパート完了に必要なETagを返す
        resolve(xhr.getResponseHeader("ETag"));
      } else {
        reject(new Error(`アップロード失敗 (HTTP ${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("アップロード中に通信エラーが発生しました"));
    xhr.send(body);
  });
}

// 管理画面：動画アップロードページ
export default function ArchiveVideoNewPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxViews, setMaxViews] = useState("3");
  const [file, setFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // タイトル入力時にスラッグを自動生成（手動修正可）
  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slug || slug === slugify(title)) {
      setSlug(slugify(value));
    }
  };

  function slugify(value: string): string {
    const ascii = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    // 日本語タイトル等でASCIIが残らない場合はタイムスタンプベース
    return ascii || `video-${Date.now()}`;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("動画ファイルを選択してください");
      return;
    }
    setIsUploading(true);
    setError(null);
    setProgress(0);

    let r2Key = "";
    let uploadId: string | null = null;

    try {
      // 1. アップロードURLを取得
      const initRes = await fetch("/api/archive/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "init",
          file_name: file.name,
          file_size: file.size,
          content_type: file.type || "video/mp4",
        }),
      });
      const init = await initRes.json();
      if (!initRes.ok) throw new Error(init.error || "アップロードURLの取得に失敗しました");
      r2Key = init.r2_key;

      // 2. R2へ直接アップロード
      if (init.mode === "simple") {
        // 単一PUT
        await putWithProgress(init.url, file, file.type || "video/mp4", (loaded) =>
          setProgress(Math.round((loaded / file.size) * 100))
        );
      } else {
        // マルチパート：パートごとに分割PUT
        uploadId = init.upload_id;
        const partSize: number = init.part_size;
        const partUrls: string[] = init.part_urls;
        const parts: { ETag: string; PartNumber: number }[] = [];
        let uploadedBytes = 0;

        for (let i = 0; i < partUrls.length; i++) {
          const start = i * partSize;
          const chunk = file.slice(start, Math.min(start + partSize, file.size));
          const etag = await putWithProgress(partUrls[i], chunk, null, (loaded) =>
            setProgress(Math.round(((uploadedBytes + loaded) / file.size) * 100))
          );
          uploadedBytes += chunk.size;
          if (!etag) throw new Error("ETagが取得できませんでした（R2のCORS設定でETagの公開が必要です）");
          parts.push({ ETag: etag, PartNumber: i + 1 });
        }

        // 3. マルチパート完了
        const completeRes = await fetch("/api/archive/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "complete",
            r2_key: r2Key,
            upload_id: uploadId,
            parts,
          }),
        });
        if (!completeRes.ok) {
          const result = await completeRes.json();
          throw new Error(result.error || "アップロードの完了処理に失敗しました");
        }
        uploadId = null;
      }

      // 4. サムネイルがあればアップロード（小さいので単一PUT）
      let thumbnailR2Key: string | null = null;
      if (thumbnailFile) {
        const thumbRes = await fetch("/api/archive/upload-url", {
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
        const thumbInit = await thumbRes.json();
        if (!thumbRes.ok) throw new Error(thumbInit.error || "サムネイルURLの取得に失敗しました");
        await putWithProgress(
          thumbInit.url,
          thumbnailFile,
          thumbnailFile.type || "image/jpeg",
          () => {}
        );
        thumbnailR2Key = thumbInit.r2_key;
      }

      // 5. DBに動画情報を登録
      const supabase = createClient();
      const { error: insertError } = await supabase.from("archive_videos").insert({
        slug: slug.trim(),
        title: title.trim(),
        description: description.trim() || null,
        r2_key: r2Key,
        thumbnail_r2_key: thumbnailR2Key,
        published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        max_views: parseInt(maxViews, 10) || 3,
      });
      if (insertError) {
        throw new Error(
          insertError.code === "23505"
            ? "このスラッグは既に使われています"
            : "動画情報の登録に失敗しました"
        );
      }

      toast({ title: "動画をアップロードしました" });
      router.push("/admin/archive/videos");
    } catch (err) {
      // マルチパートが中途半端な場合は中断処理
      if (uploadId && r2Key) {
        fetch("/api/archive/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "abort", r2_key: r2Key, upload_id: uploadId }),
        }).catch(() => {});
      }
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
      setIsUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">動画アップロード</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">動画情報</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">タイトル *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug">スラッグ（URL用） *</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="例: seminar-2026-06"
                pattern="[a-z0-9\-]+"
                required
              />
              <p className="text-xs text-muted-foreground">
                視聴URL: /archive/{slug || "（スラッグ）"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">説明</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="publishedAt">公開開始日時</Label>
                <Input
                  id="publishedAt"
                  type="datetime-local"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">未設定の場合は即時公開</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expiresAt">公開終了日時</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">未設定の場合は無期限</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxViews">1会員あたりの視聴回数上限</Label>
              <Input
                id="maxViews"
                type="number"
                min="1"
                value={maxViews}
                onChange={(e) => setMaxViews(e.target.value)}
                className="max-w-[120px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="file">動画ファイル *</Label>
              <Input
                id="file"
                type="file"
                accept="video/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
              {file && (
                <p className="text-xs text-muted-foreground">
                  {file.name}（{(file.size / 1024 / 1024).toFixed(1)} MB）
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="thumbnail">サムネイル画像（任意）</Label>
              <Input
                id="thumbnail"
                type="file"
                accept="image/*"
                onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground">
                JPG/PNG推奨。動画一覧と再生前の画面に表示されます
              </p>
            </div>

            {/* 進捗バー */}
            {isUploading && (
              <div className="space-y-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  アップロード中... {progress}%
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" disabled={isUploading} className="w-full gap-2">
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  アップロード中...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  アップロードして登録
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
