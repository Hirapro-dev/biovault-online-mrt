"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Eye, EyeOff } from "lucide-react";

// 録画配信：会員ログインページ
export default function ArchiveLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
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
        body: JSON.stringify({ email, password }),
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
    <div className="relative min-h-screen w-full overflow-hidden text-white">
      {/* 背景動画（元のログイン背景を踏襲） */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster="/video-bg.png"
        className="pointer-events-none fixed inset-0 h-full w-full object-cover"
      >
        <source src="/login-bg.mp4" type="video/mp4" />
      </video>
      <div className="pointer-events-none fixed inset-0 bg-black/40" />

      {/* 人物画像（右側に大きめ配置・縁を背景に溶け込ませる） */}
      <div className="pointer-events-none absolute right-0 top-0 h-[48vh] w-[66%] sm:w-[54%] lg:h-full lg:w-[48%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/nagashima_black02.png"
          alt=""
          className="h-full w-full object-cover object-top lg:object-bottom"
        />
        {/* 左端を背景に溶け込ませる */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#050a0e] via-[#050a0e]/30 to-transparent" />
        {/* 下端を背景／フォームへ繋ぐ */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#050a0e] to-transparent" />
      </div>

      {/* コンテンツ：左カラム */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col justify-start px-6 pb-12 pt-[34vh] sm:px-10 lg:justify-center lg:px-16 lg:pt-12">
        <div className="w-full max-w-md">
          {/* ワードマーク */}
          <div className="mb-5">
            <div className="font-serif text-[24px] tracking-wide text-white">
              BioVault
            </div>
            <div className="mt-1 text-[12px] tracking-[0.3em] text-teal-200/80">
              Membership Service
            </div>
          </div>

          {/* 見出し */}
          <h1 className="font-serif text-[28px] font-bold leading-[1.3] text-white">
            録画配信 ログイン
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            登録したメールアドレスとパスワードを入力してください。
          </p>

          {/* フォームカード */}
          <div className="mt-7 rounded-2xl border border-teal-500/25 bg-[#0a0e13]/90 p-6 shadow-2xl backdrop-blur sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-xs font-medium uppercase tracking-widest text-white">
                  メールアドレス
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@example.com"
                  className="h-12 border-0 bg-[#0d1520] text-base text-white placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-teal-500/40"
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
                    placeholder="登録時に設定したパスワード"
                    className="h-12 border-0 bg-[#0d1520] pr-14 text-base text-white placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-teal-500/40"
                  />
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
                disabled={isLoading || !email.trim() || !password.trim()}
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

              <p className="text-center text-xs leading-relaxed text-slate-400">
                パスワードをお忘れの方は
                <br />
                担当者までご連絡ください
              </p>
            </form>
          </div>

          <p className="mt-6 text-center text-[10px] text-white/40">
            © MRT inc. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
