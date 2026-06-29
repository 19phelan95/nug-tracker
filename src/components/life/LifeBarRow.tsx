import { formatDateShort, formatMinutes, formatTimeLabel } from '../../lib/date/formatting'
import type { LifeEntry } from '../../types/LifeEntry'

interface EditingEntry {
  id: string
  category: string
  minutes: string
  timestamp: string
}

interface CategoryView {
  key: string
  label: string
  icon: string
  helper: string
  quickAdds: number[]
}

export function LifeBarRow({
  category,
  barPercent,
  loggedMinutes,
  periodLabel,
  customValue,
  onCustomValueChange,
  onQuickAdd,
  onCustomAdd,
  onUndo,
  canUndo,
  onToggleHistory,
  historyOpen,
  historyEntries,
  onDeleteHistoryEntry,
  onStartEditingHistoryEntry,
  editingEntry,
  onEditEntryChange,
  onSaveEditedEntry,
  onCancelEditingEntry,
}: {
  category: CategoryView
  barPercent: number
  loggedMinutes: number
  periodLabel: string
  customValue: string
  onCustomValueChange: (categoryKey: string, value: string) => void
  onQuickAdd: (categoryKey: string, minutes: number) => void
  onCustomAdd: (categoryKey: string) => void
  onUndo: (categoryKey: string) => void
  canUndo: boolean
  onToggleHistory: (categoryKey: string) => void
  historyOpen: boolean
  historyEntries: LifeEntry[]
  onDeleteHistoryEntry: (id: string) => void
  onStartEditingHistoryEntry: (entry: LifeEntry) => void
  editingEntry: EditingEntry | null
  onEditEntryChange: (field: 'minutes' | 'timestamp', value: string) => void
  onSaveEditedEntry: () => void
  onCancelEditingEntry: () => void
}) {
  const safePercent = Math.min(100, Math.max(0, barPercent))
  const barColor = safePercent <= 25 ? 'bg-red-500' : safePercent <= 50 ? 'bg-orange-400' : 'bg-emerald-500'

  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-base text-white/90">
            {category.icon}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 lg:flex-nowrap">
              <div className="text-lg font-semibold leading-tight text-white">{category.label}</div>
              <div className="text-sm leading-tight text-white/50">{category.helper}</div>
            </div>
            <div className="text-sm leading-tight text-white/45">{periodLabel} · {formatMinutes(loggedMinutes)} logged</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:justify-end">
          {category.quickAdds.map((minutes) => (
            <button key={minutes} onClick={() => onQuickAdd(category.key, minutes)} className="rounded-xl bg-white/10 px-3 py-1.5 text-sm text-white transition hover:bg-white/15">
              +{minutes >= 60 ? formatMinutes(minutes) : `${minutes}m`}
            </button>
          ))}
          <button onClick={() => onUndo(category.key)} disabled={!canUndo} className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">Undo</button>
          <button onClick={() => onToggleHistory(category.key)} className={`rounded-xl border px-3 py-1.5 text-sm transition ${historyOpen ? 'border-white bg-white text-black' : 'border-white/15 bg-white/5 text-white hover:bg-white/10'}`}>Log</button>
          <input type="number" min="1" step="5" value={customValue} onChange={(e) => onCustomValueChange(category.key, e.target.value)} placeholder="Mins" className="w-16 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/25" />
          <button onClick={() => onCustomAdd(category.key)} className="rounded-xl bg-white px-4 py-1.5 text-sm font-medium text-black transition hover:opacity-90">Add</button>
        </div>
      </div>

      <div className="mt-3 h-4 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${safePercent}%` }} />
      </div>

      {historyOpen ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="mb-2 text-sm font-medium text-white">Current period log</div>
          <div className="space-y-2">
            {historyEntries.length === 0 ? (
              <div className="text-sm text-white/45">No entries in this active period.</div>
            ) : historyEntries.map((entry) => {
              const isEditing = editingEntry?.id === entry.id
              return (
                <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  {isEditing ? (
                    <div className="grid gap-2 md:grid-cols-[120px_1fr_auto_auto] md:items-center">
                      <input type="number" min="1" step="5" value={editingEntry.minutes} onChange={(e) => onEditEntryChange('minutes', e.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/25" />
                      <input type="datetime-local" value={editingEntry.timestamp} onChange={(e) => onEditEntryChange('timestamp', e.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/25" />
                      <button onClick={onSaveEditedEntry} className="rounded-xl bg-white px-3 py-2 text-sm font-medium text-black transition hover:opacity-90">Save</button>
                      <button onClick={onCancelEditingEntry} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-white/75">{formatDateShort(new Date(entry.timestamp))} · {formatTimeLabel(new Date(entry.timestamp))} · +{entry.minutes}m</div>
                      <div className="flex gap-2">
                        <button onClick={() => onStartEditingHistoryEntry(entry)} className="rounded-xl border border-white/15 bg-white/5 px-3 py-1 text-sm text-white transition hover:bg-white/10">Edit</button>
                        <button onClick={() => onDeleteHistoryEntry(entry.id)} className="rounded-xl border border-white/15 bg-white/5 px-3 py-1 text-sm text-white transition hover:bg-white/10">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
