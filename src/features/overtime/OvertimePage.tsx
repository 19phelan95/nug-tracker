import { useMemo, useRef, useState } from 'react'
import { AccountPanel } from '../../components/account/AccountPanel'
import { TrendBarChart } from '../../components/charts/TrendBarChart'
import { SettingsPanel } from '../../components/settings/SettingsPanel'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { StatCard } from '../../components/ui/StatCard'
import { LIFE_CATEGORIES, DEFAULT_SETTINGS } from '../../lib/constants/appConstants'
import { startOfDay, startOfNextDay, startOfWeek } from '../../lib/date/dateRanges'
import { formatDateLabel, formatDecimalHours, formatHoursValue, formatMinutes } from '../../lib/date/formatting'
import { buildDailyOvertimeRows, buildMonthlyOvertimeRows, buildWeeklyOvertimeRows, getWorkedMinutes } from '../../services/metrics.service'
import { useAppState } from '../../state/appState.context'
import type { Settings } from '../../types/Settings'

interface SettingsDraft {
  standardWorkHours: string
  weekStartsOn: string
  lifeTargets: Record<string, string>
}

function buildSettingsDraft(settings: Settings): SettingsDraft {
  return {
    standardWorkHours: formatHoursValue(settings.standardWorkMinutes),
    weekStartsOn: String(settings.weekStartsOn),
    lifeTargets: Object.fromEntries(LIFE_CATEGORIES.map((category) => [category.key, category.key === 'practice' ? String(settings.lifeTargets[category.key]) : formatHoursValue(settings.lifeTargets[category.key])])),
  }
}

export function OvertimePage() {
  const { now, settings, activeSessionStart, workSessions, setSettings, exportBackup, importBackup, resetAllData, pushFeedback } = useAppState()
  const [overtimeScope, setOvertimeScope] = useState('day')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>(buildSettingsDraft(settings))
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // The global clock ticks every second; recompute heavy aggregates only when
  // the minute changes so trends and archives aren't rebuilt 60x per minute.
  const minuteKey = Math.floor(now.getTime() / 60000)

  const bounds = useMemo(
    () => ({ todayStart: startOfDay(now), tomorrowStart: startOfNextDay(now) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minuteKey],
  )
  const { todayStart, tomorrowStart } = bounds

  const todayWorkedMinutes = useMemo(
    () => getWorkedMinutes(workSessions, activeSessionStart, now, todayStart, tomorrowStart),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minuteKey, workSessions, activeSessionStart, todayStart, tomorrowStart],
  )
  const todayOvertimeMinutes = Math.max(0, todayWorkedMinutes - settings.standardWorkMinutes)

  const dailyRows = useMemo(
    () => buildDailyOvertimeRows(workSessions, activeSessionStart, now, settings.standardWorkMinutes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minuteKey, workSessions, activeSessionStart, settings.standardWorkMinutes],
  )
  const weeklyRows = useMemo(
    () => buildWeeklyOvertimeRows(dailyRows, (date) => startOfWeek(date, settings.weekStartsOn)),
    [dailyRows, settings.weekStartsOn],
  )
  const monthlyRows = useMemo(() => buildMonthlyOvertimeRows(dailyRows), [dailyRows])
  const totalOvertimeMinutes = dailyRows.reduce((sum, row) => sum + row.overtime, 0)
  const overtimeRows = overtimeScope === 'day' ? dailyRows : overtimeScope === 'week' ? weeklyRows : monthlyRows

  const last7DaysWorkedTrend = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const day = new Date(todayStart)
    day.setDate(day.getDate() - (6 - index))
    const next = new Date(day)
    next.setDate(next.getDate() + 1)
    return { label: day.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3), value: getWorkedMinutes(workSessions, activeSessionStart, now, day, next) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [minuteKey, todayStart, workSessions, activeSessionStart])

  const last7DaysOvertimeTrend = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const day = new Date(todayStart)
    day.setDate(day.getDate() - (6 - index))
    const next = new Date(day)
    next.setDate(next.getDate() + 1)
    const worked = getWorkedMinutes(workSessions, activeSessionStart, now, day, next)
    return { label: day.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3), value: Math.max(0, worked - settings.standardWorkMinutes) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [minuteKey, todayStart, workSessions, activeSessionStart, settings.standardWorkMinutes])

  function openSettings() {
    setSettingsDraft(buildSettingsDraft(settings))
    setSettingsOpen((current) => !current)
  }

  function saveSettings() {
    const standardWorkHours = Number(settingsDraft.standardWorkHours)
    if (!Number.isFinite(standardWorkHours) || standardWorkHours <= 0 || standardWorkHours > 24) return pushFeedback('Enter a valid standard workday in hours.', 'warn')
    const weekStartsOn = Number(settingsDraft.weekStartsOn)
    if (weekStartsOn !== 0 && weekStartsOn !== 1) return pushFeedback('Choose a valid weekly reset day.', 'warn')
    const nextLifeTargets: Record<string, number> = {}
    for (const category of LIFE_CATEGORIES) {
      const raw = Number(settingsDraft.lifeTargets[category.key])
      if (!Number.isFinite(raw) || raw <= 0) return pushFeedback(`Enter a valid target for ${category.label}.`, 'warn')
      nextLifeTargets[category.key] = category.key === 'practice' ? Math.round(raw) : Math.round(raw * 60)
    }
    setSettings({ standardWorkMinutes: Math.round(standardWorkHours * 60), weekStartsOn, lifeTargets: nextLifeTargets })
    setSettingsOpen(false)
    pushFeedback('Settings saved.', 'success')
  }

  return (
    <div className="space-y-4">
      <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; await importBackup(file); if (fileInputRef.current) fileInputRef.current.value = '' }} />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Banked Total" value={formatMinutes(totalOvertimeMinutes)} subtext={formatDecimalHours(totalOvertimeMinutes)} />
        <StatCard title="Today" value={formatMinutes(todayOvertimeMinutes)} subtext="Over target today" />
        <StatCard title="Archive" value={overtimeScope === 'day' ? 'Daily' : overtimeScope === 'week' ? 'Weekly' : 'Monthly'} subtext="Switch review period below" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TrendBarChart title="7-day overtime trend" subtitle="Banked overtime across the last seven days" data={last7DaysOvertimeTrend} formatter={(value) => `${(value / 60).toFixed(1)}h`} />
        <TrendBarChart title="7-day work trend" subtitle="Worked time across the last seven days" data={last7DaysWorkedTrend} formatter={(value) => `${Math.round(value / 60)}h`} />
      </div>
      <div className="rounded-[28px] border border-white/10 bg-black/30 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-white">Overtime archive</div>
            <div className="mt-1 text-sm text-white/50">Review banked overtime by day, week, or month.</div>
          </div>
          <SegmentedControl value={overtimeScope} onChange={setOvertimeScope} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
        </div>
        <div className="mt-4 space-y-3">
          {overtimeRows.length === 0 ? <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-white/45">No overtime archived in this scope yet.</div> : overtimeRows.map((row) => (
            <div key={row.key} className="flex flex-col gap-2 rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium text-white">{overtimeScope === 'month' ? row.start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : overtimeScope === 'week' ? `Week of ${row.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : formatDateLabel(row.start)}</div>
                <div className="mt-1 text-sm text-white/45">{overtimeScope === 'day' ? `Worked ${formatMinutes(row.worked)}` : `${row.days} contributing day${row.days === 1 ? '' : 's'}`}</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-semibold text-emerald-400">{formatMinutes(row.overtime)}</div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/35">Banked</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <SettingsPanel
        isOpen={settingsOpen}
        onToggle={openSettings}
        draft={settingsDraft}
        onDraftChange={(field, value) => setSettingsDraft((current) => ({ ...current, [field]: value }))}
        onLifeTargetChange={(categoryKey, value) => setSettingsDraft((current) => ({ ...current, lifeTargets: { ...current.lifeTargets, [categoryKey]: value } }))}
        onSave={saveSettings}
        onReset={() => { setSettings(DEFAULT_SETTINGS); setSettingsDraft(buildSettingsDraft(DEFAULT_SETTINGS)); pushFeedback('Settings reset to defaults.', 'success') }}
      />
      <AccountPanel />
      <div className="rounded-[28px] border border-white/10 bg-black/30 p-5">
        <div className="text-lg font-semibold text-white">Data tools</div>
        <div className="mt-1 text-sm text-white/50">Export, import, and reset local data safely.</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => void exportBackup()} className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90">Export Backup</button>
          <button onClick={() => fileInputRef.current?.click()} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10">Import Backup</button>
          <button onClick={() => void resetAllData()} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10">Reset Data</button>
        </div>
      </div>
    </div>
  )
}
