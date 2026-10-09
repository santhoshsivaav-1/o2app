export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span
        aria-hidden
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 font-black text-coal-950 shadow-[0_0_24px_rgba(249,115,22,0.35)]"
      >
        <span className="text-lg leading-none tracking-tighter">O₂</span>
      </span>
      {!compact && (
        <span className="flex items-center gap-3">
          <span aria-hidden className="h-8 w-px bg-brand-600/70" />
          <span className="leading-none">
            <span className="block bg-gradient-to-b from-brand-300 via-brand-500 to-brand-700 bg-clip-text text-2xl font-black tracking-wide text-transparent">
              OXYGEN
            </span>
            <span className="mt-1 block text-[11px] font-semibold tracking-[0.32em] text-brand-500">
              FITNESS STUDIO
            </span>
          </span>
        </span>
      )}
    </span>
  );
}
