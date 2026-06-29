import { useLocation, useNavigate } from 'react-router-dom'
import { TabButton } from '../ui/TabButton'

const nav = [
  { label: 'Home', path: '/' },
  { label: 'Work', path: '/work' },
  { label: 'Life', path: '/life' },
  { label: 'Overtime', path: '/overtime' },
]

export function Header({ subtitle }: { subtitle: string }) {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-white/40">Nug-Tracker</div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Work. Life. Overtime.</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">{subtitle}</p>
      </div>
      <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
        {nav.map((item) => (
          <TabButton key={item.path} active={location.pathname === item.path} onClick={() => navigate(item.path)}>
            {item.label}
          </TabButton>
        ))}
      </div>
    </div>
  )
}
