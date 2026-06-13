"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Loader2, AlertCircle } from "lucide-react";
import { ACCESS_WINDOW_HOURS } from "@/lib/archive-access";

// 視聴期限を「YYYY年M月D日 HH:MM」形式で表示
function formatDeadline(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 録画配信：動画プレーヤー（初回再生から72時間の視聴期限付き）
export function ArchivePlayer({
  videoId,
  initialExpired,
  initialDeadline,
  thumbnailUrl,
}: {
  videoId: string;
  initialExpired: boolean; // 既に視聴期限が切れているか
  initialDeadline: string | null; // 視聴期限（初回再生済みの場合）
  thumbnailUrl?: string | null;
}) {
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [expired, setExpired] = useState(initialExpired);
  const [deadline, setDeadline] = useState<string | null>(initialDeadline);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 視聴時間の計測（30秒ごと + 離脱時に送信）
  const watchedSecondsRef = useRef(0);

  useEffect(() => {
    if (!playbackUrl) return;

    // 再生中のみ秒数を加算するタイマー
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused && !video.ended) {
        watchedSecondsRef.current += 1;
      }
    }, 1000);

    const flushWatchTime = (useBeacon: boolean) => {
      const seconds = watchedSecondsRef.current;
      if (seconds <= 0) return;
      watchedSecondsRef.current = 0;

      const payload = JSON.stringify({ video_id: videoId, seconds });
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/archive/watch-time",
          new Blob([payload], { type: "application/json" })
        );
      } else {
        fetch("/api/archive/watch-time", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    };

    // 30秒ごとにサーバーへ送信
    const flushInterval = setInterval(() => {
      flushWatchTime(false);
    }, 30000);

    const handleUnload = () => flushWatchTime(true);
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flushWatchTime(true);
    };

    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      clearInterval(flushInterval);
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
      flushWatchTime(false);
    };
  }, [playbackUrl, videoId]);

  // 再生ボタン押下 → 回数チェック + 署名付きURL取得
  const handlePlay = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/archive/play-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: videoId }),
      });
      const result = await res.json();
      if (!res.ok) {
        if (result.expired) setExpired(true);
        throw new Error(result.error || "再生できませんでした");
      }

      setPlaybackUrl(result.url);
      if (typeof result.expiresAt === "string") setDeadline(result.expiresAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "再生できませんでした");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {playbackUrl ? (
        <video
          ref={videoRef}
          src={playbackUrl}
          controls
          autoPlay
          poster={thumbnailUrl || undefined}
          controlsList="nodownload"
          onContextMenu={(e) => e.preventDefault()}
          className="aspect-video w-full rounded-xl bg-black"
        />
      ) : (
        <div
          className="relative flex aspect-video w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-xl border border-teal-500/15 bg-[#0d1520]/60 bg-cover bg-center"
          style={thumbnailUrl ? { backgroundImage: `url(${thumbnailUrl})` } : undefined}
        >
          {/* サムネイルの上に暗めのオーバーレイ（ボタンの視認性確保） */}
          {thumbnailUrl && <div className="absolute inset-0 bg-black/60" />}
          <div className="relative z-10 flex flex-col items-center gap-4 px-4 text-center">
            {!expired ? (
              <>
                <Button
                  onClick={handlePlay}
                  disabled={isLoading}
                  className="h-14 gap-2 bg-gradient-to-r from-teal-600 via-cyan-500 to-teal-600 px-8 text-base font-semibold text-white hover:from-teal-500 hover:via-cyan-400 hover:to-teal-500"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      準備中...
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5" />
                      再生する
                    </>
                  )}
                </Button>
                {/* 視聴期限の案内（初回再生前 / 再生済み） */}
                {deadline ? (
                  <p className="text-sm text-amber-300">
                    視聴期限：{formatDeadline(deadline)} まで
                  </p>
                ) : (
                  <p className="text-sm text-slate-300">
                    再生開始から{ACCESS_WINDOW_HOURS}時間ご視聴いただけます
                  </p>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-red-400">
                <AlertCircle className="h-8 w-8" />
                <p className="text-base">
                  視聴可能期間（初回再生から{ACCESS_WINDOW_HOURS}時間）が終了しました
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 再生中も視聴期限を表示 */}
      {playbackUrl && deadline && (
        <p className="mt-3 text-center text-sm text-amber-300">
          視聴期限：{formatDeadline(deadline)} まで
        </p>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-center text-base text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
