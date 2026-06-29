export function StatCard({ title, value, subtext }: { title: string; value: string; subtext?: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-white/45">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      {subtext ? <div className="mt-1 text-sm text-white/50">{subtext}</div> : null}
    </div>
  )
}
