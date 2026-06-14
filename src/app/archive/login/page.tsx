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
    <div className="relative min-h-screen w-full bg-[#050a0e] text-white">
      {/* ヒーロー：register/a と同じCSS構造（下端ボーダー全幅・内側640px） */}
      <div className="relative border-b border-teal-400/40 bg-[#050a0e]">
        <div className="relative mx-auto h-[200px] w-full max-w-[640px] overflow-hidden sm:h-[260px]">
          {/* 人物画像（右側に配置・上寄せ） */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/nagashima_black02.png"
            alt=""
            className="absolute right-0 top-0 h-full w-[52%] object-cover object-top sm:w-[48%]"
          />
          {/* 左のテキスト領域のみ暗くし、人物はクリアに保つ横グラデーション */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#050a0e] from-[42%] via-[#050a0e] via-[50%] to-transparent to-[64%]" />

          {/* 左寄せのテキスト */}
          <div className="absolute inset-0 flex flex-col justify-center px-6">
            <div className="mb-5">
              <div className="font-serif text-[20px] tracking-wide text-white">
                BioVault
              </div>
              <div className="text-[12px] tracking-[0.2em] text-teal-200/80">
                Membership Service
              </div>
            </div>
            <h1 className="font-serif text-[24px] font-bold leading-[1.3] text-white">
              録画配信 ログイン
            </h1>
          </div>
        </div>
      </div>

      {/* 本文（PC・スマホ共通で640px幅） */}
      <div className="mx-auto w-full max-w-[640px]">
        {/* 導入文 */}
        <div className="px-6 py-7">
          <p className="text-base leading-loose text-slate-300">
            登録したメールアドレスとパスワードを入力してください。
          </p>
        </div>

        {/* フォームカード */}
        <div className="px-4 pb-14">
          <div className="rounded-2xl border border-teal-500/30 bg-[#0a0e13]/95 px-6 py-8 shadow-2xl sm:px-10 sm:py-10">
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
                  className="h-12 rounded-lg border-0 bg-[#0d1520] text-base text-white placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-teal-500/40"
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
                    className="h-12 rounded-lg border-0 bg-[#0d1520] pr-14 text-base text-white placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-teal-500/40"
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

          <p className="mt-6 text-center text-xs text-white/40">
            © MRT inc. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
