export interface TrendPoint {
  label: string
  value: number
}

export function TrendBarChart({ title, subtitle, data, formatter = (value: number) => String(value) }: { title: string; subtitle: string; data: TrendPoint[]; formatter?: (value: number) => string }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1)

  return (
    <div className="rounded-[28px] border border-white/10 bg-black/30 p-5">
      <div className="text-lg font-semibold text-white">{title}</div>
      <div className="mt-1 text-sm text-white/50">{subtitle}</div>
      <div className="mt-4 flex h-44 items-end gap-2">
        {data.map((item) => {
          const height = Math.max(10, (item.value / maxValue) * 100)
          return (
            <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
              <div className="text-[11px] text-white/45">{formatter(item.value)}</div>
              <div className="flex h-28 w-full items-end">
                <div className="w-full rounded-t-2xl bg-white/80 transition hover:bg-white" style={{ height: `${height}%` }} />
              </div>
              <div className="text-xs text-white/45">{item.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
