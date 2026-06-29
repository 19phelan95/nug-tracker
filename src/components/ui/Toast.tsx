export function Toast({ message, tone }: { message: string; tone: 'success' | 'warn' | 'neutral' }) {
  const className =
    tone === 'success'
      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
      : tone === 'warn'
        ? 'border-orange-400/30 bg-orange-500/10 text-orange-100'
        : 'border-white/10 bg-black/70 text-white'

  return (
    <div
      className={`fixed right-4 z-50 rounded-2xl border px-4 py-3 text-sm shadow-2xl ${className}`}
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      {message}
    </div>
  )
}
