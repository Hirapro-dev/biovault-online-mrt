// 録画配信ページ共通の背景（ログインページ /login と同じ：背景動画 + 光線エフェクト）
export function ArchiveBackground() {
  return (
    <>
      {/* 背景動画（最背面） */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="pointer-events-none fixed inset-0 h-full w-full object-cover opacity-95"
      >
        <source src="/login-bg.mp4" type="video/mp4" />
      </video>

      {/* 動画の上に暗めのオーバーレイ */}
      <div className="pointer-events-none fixed inset-0 bg-[#000000]/30" />

      {/* 斜めの光線エフェクト */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-[20%] top-[10%] h-[200px] w-[140%] rotate-[-35deg] bg-gradient-to-r from-transparent via-teal-500/10 to-transparent blur-[60px]" />
        <div className="absolute -left-[10%] top-[30%] h-[150px] w-[130%] rotate-[-35deg] bg-gradient-to-r from-transparent via-cyan-400/8 to-transparent blur-[80px]" />
        <div className="absolute -left-[15%] top-[55%] h-[180px] w-[140%] rotate-[-35deg] bg-gradient-to-r from-transparent via-emerald-500/8 to-transparent blur-[70px]" />

        {/* 補助グロー */}
        <div className="absolute left-[10%] top-[20%] h-[400px] w-[400px] rounded-full bg-teal-900/20 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[15%] h-[350px] w-[350px] rounded-full bg-cyan-900/15 blur-[100px]" />
        <div className="absolute left-[50%] top-[60%] h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-emerald-900/10 blur-[90px]" />

        {/* パーティクル */}
        <div className="absolute left-[15%] top-[25%] h-1 w-1 rounded-full bg-teal-300/40 shadow-[0_0_6px_rgba(94,234,212,0.4)]" />
        <div className="absolute left-[70%] top-[15%] h-0.5 w-0.5 rounded-full bg-cyan-300/50 shadow-[0_0_4px_rgba(103,232,249,0.5)]" />
        <div className="absolute left-[45%] top-[70%] h-1 w-1 rounded-full bg-emerald-300/35 shadow-[0_0_6px_rgba(110,231,183,0.35)]" />
        <div className="absolute left-[80%] top-[45%] h-0.5 w-0.5 rounded-full bg-teal-200/45 shadow-[0_0_4px_rgba(153,246,228,0.45)]" />
        <div className="absolute left-[25%] top-[60%] h-1 w-1 rounded-full bg-cyan-200/30 shadow-[0_0_5px_rgba(165,243,252,0.3)]" />
        <div className="absolute left-[60%] top-[80%] h-0.5 w-0.5 rounded-full bg-teal-300/40 shadow-[0_0_4px_rgba(94,234,212,0.4)]" />
        <div className="absolute left-[35%] top-[10%] h-0.5 w-0.5 rounded-full bg-emerald-200/35 shadow-[0_0_4px_rgba(167,243,208,0.35)]" />
        <div className="absolute left-[90%] top-[70%] h-1 w-1 rounded-full bg-cyan-300/30 shadow-[0_0_5px_rgba(103,232,249,0.3)]" />

        {/* 細い光線ライン */}
        <div className="absolute -left-[5%] top-[40%] h-[1px] w-[60%] rotate-[-35deg] bg-gradient-to-r from-transparent via-teal-400/25 to-transparent" />
        <div className="absolute left-[30%] top-[20%] h-[1px] w-[50%] rotate-[-35deg] bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
        <div className="absolute left-[10%] top-[65%] h-[1px] w-[55%] rotate-[-35deg] bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
      </div>
    </>
  );
}
