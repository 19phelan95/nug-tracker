import { useMemo, useState } from 'react'
import { LIFE_CATEGORIES } from '../../lib/constants/appConstants'
import { startOfDay, startOfNextDay, startOfNextWeek, startOfWeek } from '../../lib/date/dateRanges'
import { formatTargetHelper, fromLocalInputValue, toLocalInputValue } from '../../lib/date/formatting'
import { LifeBarRow } from '../../components/life/LifeBarRow'
import { useAppState } from '../../state/appState.context'
import { buildLifeStats } from '../../services/metrics.service'
import type { LifeEntry } from '../../types/LifeEntry'

interface LifeEntryDraft {
  id: string
  category: string
  minutes: string
  timestamp: string
}

function buildLifeEntryDraft(entry: LifeEntry): LifeEntryDraft {
  return { id: entry.id, category: entry.category, minutes: String(entry.minutes), timestamp: toLocalInputValue(entry.timestamp) }
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function LifePage() {
  const { now, settings, lifeEntries, addLifeEntry, updateLifeEntry, deleteLifeEntry, pushFeedback } = useAppState()
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({})
  const [lifeHistoryOpen, setLifeHistoryOpen] = useState<string | null>(null)
  const [lifeEntryEditor, setLifeEntryEditor] = useState<LifeEntryDraft | null>(null)

  // Re-derive period boundaries and pace-based stats at minute granularity so
  // the bars don't recompute on every 1s clock tick.
  const minuteKey = Math.floor(now.getTime() / 60000)
  const { todayStart, tomorrowStart, weekStart, nextWeekStart } = useMemo(
    () => ({
      todayStart: startOfDay(now),
      tomorrowStart: startOfNextDay(now),
      weekStart: startOfWeek(now, settings.weekStartsOn),
      nextWeekStart: startOfNextWeek(now, settings.weekStartsOn),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minuteKey, settings.weekStartsOn],
  )
  const weekStartLabel = settings.weekStartsOn === 1 ? 'Monday' : 'Sunday'

  const categoriesWithTargets = useMemo(() => LIFE_CATEGORIES.map((category) => ({ ...category, targetMinutes: settings.lifeTargets[category.key], helper: formatTargetHelper(settings.lifeTargets[category.key], category.period) })), [settings])
  const lifeStats = useMemo(
    () =>
      buildLifeStats(lifeEntries, settings, now, todayStart, tomorrowStart, weekStart, nextWeekStart).map((stat) => ({
        ...stat,
        helper: formatTargetHelper(stat.targetMinutes, stat.period),
        periodLabel: stat.period === 'day' ? 'Today' : `Week of ${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
        canUndo: stat.periodEntries.length > 0,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minuteKey, lifeEntries, settings, todayStart, tomorrowStart, weekStart, nextWeekStart],
  )

  const lifeAveragePercent = Math.round(lifeStats.reduce((sum, stat) => sum + stat.barPercent, 0) / lifeStats.length)
  const lifeOnTrackCount = lifeStats.filter((stat) => stat.barPercent > 50).length
  const lifeCompletedCount = lifeStats.filter((stat) => stat.loggedMinutes >= stat.targetMinutes).length

  function addMinutes(categoryKey: string, minutes: number) {
    addLifeEntry({ id: makeId('life'), category: categoryKey, minutes, timestamp: new Date().toISOString() })
  }

  function handleCustomAdd(categoryKey: string) {
    const minutes = Number(customInputs[categoryKey])
    if (!Number.isFinite(minutes) || minutes <= 0) return pushFeedback('Enter a valid number of minutes.', 'warn')
    addMinutes(categoryKey, minutes)
    setCustomInputs((current) => ({ ...current, [categoryKey]: '' }))
  }

  function handleUndoLifeEntry(categoryKey: string) {
    const category = categoriesWithTargets.find((item) => item.key === categoryKey)
    if (!category) return
    const periodStart = category.period === 'day' ? todayStart : weekStart
    const periodEnd = category.period === 'day' ? tomorrowStart : nextWeekStart
    const latest = [...lifeEntries]
      .filter((entry) => entry.category === categoryKey && new Date(entry.timestamp).getTime() >= periodStart.getTime() && new Date(entry.timestamp).getTime() < periodEnd.getTime())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
    if (!latest) return
    deleteLifeEntry(latest.id)
  }

  function saveEditedLifeEntry() {
    if (!lifeEntryEditor) return
    const minutes = Number(lifeEntryEditor.minutes)
    const timestamp = fromLocalInputValue(lifeEntryEditor.timestamp)
    if (!Number.isFinite(minutes) || minutes <= 0) return pushFeedback('Enter a valid life-entry minute value.', 'warn')
    if (!timestamp) return pushFeedback('Enter a valid life-entry time.', 'warn')
    updateLifeEntry({ id: lifeEntryEditor.id, category: lifeEntryEditor.category, minutes, timestamp })
    setLifeEntryEditor(null)
  }

  return (
    <div className="space-y-3">
      <div className="px-1 text-sm text-white/45">Daily bars reset each day. Weekly bars reset on {weekStartLabel}. Add time manually to refill each track.</div>
      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/65">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div><span className="font-medium text-white">Life score:</span> {lifeAveragePercent}%</div>
          <div><span className="font-medium text-white">On track:</span> {lifeOnTrackCount}/{lifeStats.length}</div>
          <div><span className="font-medium text-white">Targets met:</span> {lifeCompletedCount}/{lifeStats.length}</div>
        </div>
      </div>
      {lifeStats.map((category) => (
        <LifeBarRow
          key={category.key}
          category={category}
          barPercent={category.barPercent}
          loggedMinutes={category.loggedMinutes}
          periodLabel={category.periodLabel}
          customValue={customInputs[category.key] || ''}
          onCustomValueChange={(key, value) => setCustomInputs((current) => ({ ...current, [key]: value }))}
          onQuickAdd={addMinutes}
          onCustomAdd={handleCustomAdd}
          onUndo={handleUndoLifeEntry}
          canUndo={category.canUndo}
          onToggleHistory={(key) => { setLifeHistoryOpen((current) => current === key ? null : key); setLifeEntryEditor(null) }}
          historyOpen={lifeHistoryOpen === category.key}
          historyEntries={category.periodEntries}
          onDeleteHistoryEntry={deleteLifeEntry}
          onStartEditingHistoryEntry={(entry) => setLifeEntryEditor(buildLifeEntryDraft(entry))}
          editingEntry={lifeEntryEditor?.category === category.key ? lifeEntryEditor : null}
          onEditEntryChange={(field, value) => setLifeEntryEditor((current) => current ? { ...current, [field]: value } : current)}
          onSaveEditedEntry={saveEditedLifeEntry}
          onCancelEditingEntry={() => setLifeEntryEditor(null)}
        />
      ))}
    </div>
  )
}
