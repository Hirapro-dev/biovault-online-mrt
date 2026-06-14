// 録画配信ページ共通の背景（軽量版：背景動画 + 控えめな光彩）
// 大面積の強いblurは描画負荷が高いため、枚数とぼかし量を抑えている
export function ArchiveBackground() {
  return (
    <>
      {/* 背景動画（最背面）。posterで即時表示し、メタデータのみ先読み */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster="/video-bg.png"
        className="pointer-events-none fixed inset-0 h-full w-full object-cover opacity-95"
      >
        <source src="/login-bg.mp4" type="video/mp4" />
      </video>

      {/* 動画の上に暗めのオーバーレイ */}
      <div className="pointer-events-none fixed inset-0 bg-[#000000]/30" />

      {/* 控えめな光彩（blur量・枚数を削減してGPU合成負荷を軽く） */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-[15%] top-[15%] h-[160px] w-[130%] rotate-[-35deg] bg-gradient-to-r from-transparent via-teal-500/10 to-transparent blur-[24px]" />
        <div className="absolute -left-[10%] top-[55%] h-[160px] w-[130%] rotate-[-35deg] bg-gradient-to-r from-transparent via-emerald-500/8 to-transparent blur-[24px]" />
        <div className="absolute left-[12%] top-[20%] h-[320px] w-[320px] rounded-full bg-teal-900/20 blur-[60px]" />
        <div className="absolute bottom-[10%] right-[15%] h-[300px] w-[300px] rounded-full bg-cyan-900/15 blur-[60px]" />
      </div>
    </>
  );
}
