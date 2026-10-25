// Fixed, decorative backdrop. Glass panels need colour behind them to frost,
// so this paints slow-drifting gradient blobs under the whole app.
export function GlassBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#05070a]">
      <div className="absolute -top-[20%] -left-[10%] h-[60vh] w-[60vh] rounded-full bg-emerald-500/25 blur-[120px] animate-blob" />
      <div
        className="absolute top-[30%] -right-[15%] h-[70vh] w-[70vh] rounded-full bg-teal-400/15 blur-[140px] animate-blob"
        style={{ animationDelay: "-7s" }}
      />
      <div
        className="absolute -bottom-[25%] left-[25%] h-[55vh] w-[55vh] rounded-full bg-indigo-500/15 blur-[130px] animate-blob"
        style={{ animationDelay: "-14s" }}
      />
      {/* Faint dot grid, faded toward the edges */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: "radial-gradient(rgb(255 255 255 / 0.35) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
    </div>
  );
}
