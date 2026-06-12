"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Loader2, AlertCircle } from "lucide-react";

// 録画配信：動画プレーヤー（再生回数制限付き）
export function ArchivePlayer({
  videoId,
  initialRemaining,
  thumbnailUrl,
}: {
  videoId: string;
  initialRemaining: number;
  thumbnailUrl?: string | null;
}) {
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(initialRemaining);
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
        if (typeof result.remaining === "number") setRemaining(result.remaining);
        throw new Error(result.error || "再生できませんでした");
      }

      setPlaybackUrl(result.url);
      setRemaining(result.remaining);
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
          <div className="relative z-10 flex flex-col items-center gap-4">
            {remaining > 0 ? (
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
            ) : (
              <div className="flex flex-col items-center gap-2 text-red-400">
                <AlertCircle className="h-8 w-8" />
                <p className="text-base">現在この動画はご視聴いただけません</p>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-center text-base text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
