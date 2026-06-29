import { useNavigate } from 'react-router-dom'

export function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-black/30 px-6 py-10 text-center">
        <div className="text-xs uppercase tracking-[0.35em] text-white/35">Home</div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight text-white">Nug-Tracker</h2>
        <p className="mt-3 text-sm text-white/50">Choose where you want to go.</p>
        <div className="mt-8 flex flex-col gap-4">
          {[
            ['Work', '/work', 'Clock in, clock out, and review worked time.'],
            ['Life', '/life', 'Track personal targets, routines, and progress bars.'],
            ['Overtime', '/overtime', 'Review banked extra time, trends, and settings.'],
          ].map(([label, path, helper]) => (
            <button key={path} onClick={() => navigate(path)} className="w-full rounded-3xl border border-white/10 bg-white/5 px-6 py-5 text-left transition hover:bg-white/10">
              <div className="text-2xl font-semibold text-white">{label}</div>
              <div className="mt-1 text-sm text-white/45">{helper}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
