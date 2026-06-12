"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

// 録画視聴ページのヘッダー（ライブ配信視聴ページと同じ構成）
export function ArchiveHeader({ memberName }: { memberName: string | null }) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/archive/login", { method: "DELETE" });
    router.push("/archive/login");
    router.refresh();
  };

  return (
    <header className="relative z-10 border-b border-teal-500/10 bg-[#050a0e]/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center justify-between px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="MRT inc."
          className="h-6 w-auto object-contain drop-shadow-[0_0_10px_rgba(94,234,212,0.15)]"
        />
        <div className="flex items-center gap-3">
          {memberName && (
            <span className="text-base text-teal-400">{memberName} 様</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-slate-400 hover:text-teal-200"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
