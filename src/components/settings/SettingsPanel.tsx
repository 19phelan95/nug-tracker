import { LIFE_CATEGORIES } from '../../lib/constants/appConstants'

interface SettingsDraft {
  standardWorkHours: string
  weekStartsOn: string
  lifeTargets: Record<string, string>
}

export function SettingsPanel({
  isOpen,
  onToggle,
  draft,
  onDraftChange,
  onLifeTargetChange,
  onSave,
  onReset,
}: {
  isOpen: boolean
  onToggle: () => void
  draft: SettingsDraft
  onDraftChange: (field: 'standardWorkHours' | 'weekStartsOn', value: string) => void
  onLifeTargetChange: (categoryKey: string, value: string) => void
  onSave: () => void
  onReset: () => void
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-black/30 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-white">Settings</div>
          <div className="mt-1 text-sm text-white/50">Tune targets and day-length rules without changing the main UI.</div>
        </div>
        <button onClick={onToggle} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10">
          {isOpen ? 'Close' : 'Open'}
        </button>
      </div>
      {isOpen ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-white/60">
              <div className="mb-1">Standard workday (hours)</div>
              <input type="number" min="0.25" step="0.25" value={draft.standardWorkHours} onChange={(e) => onDraftChange('standardWorkHours', e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/25" />
            </label>
            <label className="text-sm text-white/60">
              <div className="mb-1">Weekly reset day</div>
              <select value={draft.weekStartsOn} onChange={(e) => onDraftChange('weekStartsOn', e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/25">
                <option value="1">Monday</option>
                <option value="0">Sunday</option>
              </select>
            </label>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium text-white">Life targets</div>
            <div className="grid gap-3 md:grid-cols-2">
              {LIFE_CATEGORIES.map((category) => (
                <label key={category.key} className="text-sm text-white/60">
                  <div className="mb-1">{category.label} ({category.key === 'practice' ? 'minutes' : 'hours'})</div>
                  <input type="number" min="0.25" step={category.key === 'practice' ? '1' : '0.25'} value={draft.lifeTargets[category.key]} onChange={(e) => onLifeTargetChange(category.key, e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/25" />
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
            <button onClick={onSave} className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90">Save Settings</button>
            <button onClick={onReset} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10">Reset Defaults</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
