import { Header } from '../components/layout/Header'
import { Toast } from '../components/ui/Toast'
import { useAppState } from '../state/appState.context'
import { AppRoutes } from './routes'

export default function App() {
  const { feedback, settings } = useAppState()
  const weekStartLabel = settings.weekStartsOn === 1 ? 'Monday' : 'Sunday'

  return (
    <div
      className="min-h-screen bg-[#0a0a0b] text-white"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6">
          <Header subtitle={`Work supports multiple daily sessions. Life bars auto-drain against daily and weekly deadlines. Weekly life targets currently reset on ${weekStartLabel}.`} />
          <AppRoutes />
        </div>
      </div>
      {feedback ? <Toast message={feedback.message} tone={feedback.tone} /> : null}
    </div>
  )
}
