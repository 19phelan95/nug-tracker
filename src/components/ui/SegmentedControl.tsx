export interface SegmentOption {
  value: string
  label: string
}

export function SegmentedControl({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: SegmentOption[] }) {
  return (
    <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-1">
      {options.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-xl px-3 py-1.5 text-sm transition ${active ? 'bg-white text-black' : 'text-white/70 hover:text-white'}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
