import { ArchiveBackground } from "./archive-background";

// 録画配信（/archive 配下）共通レイアウト
// 背景をここで1回だけマウントし、ページ遷移ごとの再生成（動画再取得）を防ぐ
export default function ArchiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050a0e]">
      <ArchiveBackground />
      {children}
    </div>
  );
}
