"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { ArchiveBackground } from "../archive-background";

// 録画配信：会員ログインページ
export default function ArchiveLoginPage() {
  const router = useRouter();
  const [memberId, setMemberId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/archive/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, password }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "ログインに失敗しました");

      // 管理画面で設定した動画視聴ページURLへ遷移（外部URLにも対応）
      const url: string = result.redirect_url || "/archive";
      if (/^https?:\/\//.test(url)) {
        window.location.href = url;
      } else {
        router.push(url);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-[#050a0e] px-4 py-8">
      <ArchiveBackground />
      <div className="relative z-10 w-full max-w-md">
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-teal-400/40 via-cyan-400/20 to-teal-400/30" />
        <div className="relative rounded-2xl bg-[#050a0e]/95 px-6 py-8 shadow-2xl sm:px-12 sm:py-12">
          <div className="mb-6 flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="MRT" className="mb-3 h-8 w-auto object-contain" />
            <h1 className="bg-gradient-to-r from-teal-200 via-cyan-100 to-teal-200 bg-clip-text text-xl font-bold tracking-wide text-transparent">
              録画配信 ログイン
            </h1>
            <p className="mt-4 text-sm tracking-wide text-slate-400">
              発行されたIDとパスワードを入力してください
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-xs font-medium uppercase tracking-widest text-white">
                視聴ID
              </label>
              <Input
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                placeholder="例: yamada1234"
                className="h-12 border-0 bg-[#0d1520] text-center font-mono text-lg tracking-widest text-white placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-teal-500/40"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium uppercase tracking-widest text-white">
                パスワード
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="電話番号下8桁"
                  className="h-12 border-0 bg-[#0d1520] pr-12 text-center font-mono text-lg tracking-widest text-white placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-teal-500/40"
                />
                {/* パスワード表示/非表示トグル */}
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-300"
                  tabIndex={-1}
                  aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-center text-sm text-red-400">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="h-12 w-full bg-gradient-to-r from-teal-600 via-cyan-500 to-teal-600 text-base font-semibold text-white hover:from-teal-500 hover:via-cyan-400 hover:to-teal-500"
              disabled={isLoading || !memberId.trim() || !password.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  認証中...
                </>
              ) : (
                "ログイン"
              )}
            </Button>
          </form>
        </div>
      </div>

      <p className="mt-6 text-center text-[10px] text-white/40">
        © MRT inc. All rights reserved.
      </p>
    </div>
  );
}
