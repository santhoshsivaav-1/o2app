export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 text-lg font-black leading-none tracking-tighter text-white shadow-[0_2px_12px_rgba(234,88,12,0.4)]"
      >
        O₂
      </span>
      {!compact && (
        <span className="flex items-center gap-3">
          <span aria-hidden className="h-8 w-px bg-brand-600/50" />
          <span className="leading-none">
            <span className="block bg-gradient-to-b from-brand-500 to-brand-800 bg-clip-text text-2xl font-black tracking-wide text-transparent">
              OXYGEN
            </span>
            <span className="mt-1 block text-[11px] font-bold tracking-[0.32em] text-brand-700">
              FITNESS STUDIO
            </span>
          </span>
        </span>
      )}
    </span>
  );
}
