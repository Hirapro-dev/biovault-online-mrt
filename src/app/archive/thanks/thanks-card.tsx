"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Copy, Check, CheckCircle2 } from "lucide-react";

// 個別コピー対応の情報行
function CopyRow({
  label,
  value,
  copiedField,
  setCopiedField,
  fieldKey,
}: {
  label: string;
  value: string;
  copiedField: string | null;
  setCopiedField: (k: string | null) => void;
  fieldKey: string;
}) {
  const isCopied = copiedField === fieldKey;
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="rounded-lg border border-teal-500/20 bg-[#0d1520] p-4 text-left">
      <p className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <p className="flex-1 break-all font-mono text-base font-bold tracking-wider text-teal-300">
          {value || "—"}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="h-8 w-8 shrink-0 text-slate-400 hover:bg-teal-500/10 hover:text-teal-300"
        >
          {isCopied ? (
            <Check className="h-4 w-4 text-green-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ID/PW・視聴ページURLの表示・コピーUI（クライアント側）
export function ThanksCard({
  memberId,
  password,
  watchPageUrl,
}: {
  memberId: string;
  password: string;
  watchPageUrl: string;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="relative z-10 w-full max-w-md">
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-teal-400/40 via-cyan-400/20 to-teal-400/30" />
        <div className="relative rounded-2xl bg-[#050a0e]/95 px-6 py-8 text-center shadow-2xl sm:px-10 sm:py-10">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-teal-400" />
          <h1 className="mb-2 text-xl font-bold text-white">登録が完了しました</h1>
          <p className="mb-6 text-sm text-slate-400">
            以下のID・パスワードで視聴できます。
            <br />
            大切に保管してください。
          </p>

          {/* ログインID・パスワード（個別コピー対応） */}
          <div className="mb-6 space-y-3">
            <CopyRow
              label="ログインID"
              value={memberId}
              copiedField={copiedField}
              setCopiedField={setCopiedField}
              fieldKey="id"
            />
            <CopyRow
              label="パスワード"
              value={password}
              copiedField={copiedField}
              setCopiedField={setCopiedField}
              fieldKey="pw"
            />
          </div>

          <Link href={watchPageUrl || "/archive/login"}>
            <Button className="h-12 w-full bg-gradient-to-r from-teal-600 via-cyan-500 to-teal-600 text-base font-semibold text-white hover:from-teal-500 hover:via-cyan-400 hover:to-teal-500">
              視聴ページへ進む
            </Button>
          </Link>
        </div>
      </div>

      <p className="mt-6 text-center text-[10px] text-white/40">
        © MRT inc. All rights reserved.
      </p>
    </div>
  );
}
