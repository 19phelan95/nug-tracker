import { useMemo, useState } from 'react'
import { FUTURE_TOLERANCE_MS, MAX_VISIBLE_WORK_LOG } from '../../lib/constants/appConstants'
import { startOfDay, startOfMonth, startOfNextDay, startOfNextMonth, startOfNextWeek, startOfWeek } from '../../lib/date/dateRanges'
import { formatDateLabel, formatMinutes, formatTimeLabel, fromLocalInputValue, overlapMinutes, toLocalInputValue } from '../../lib/date/formatting'
import { buildDailyOvertimeRows, getWorkedMinutes, hasSessionOverlap } from '../../services/metrics.service'
import { useAppState } from '../../state/appState.context'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { StatCard } from '../../components/ui/StatCard'
import type { WorkSession } from '../../types/WorkSession'

interface SessionDraft {
  mode: 'create' | 'edit'
  id: string | null
  start: string
  end: string
}

function buildSessionDraft(session?: WorkSession): SessionDraft {
  return {
    mode: session ? 'edit' : 'create',
    id: session?.id ?? null,
    start: session ? toLocalInputValue(session.start) : '',
    end: session ? toLocalInputValue(session.end) : '',
  }
}

export function WorkPage() {
  const { now, settings, activeSessionStart, workSessions, clockIn, clockOut, addWorkSession, updateWorkSession, deleteWorkSession, pushFeedback } = useAppState()
  const [workOpen, setWorkOpen] = useState(false)
  const [workHistoryFilter, setWorkHistoryFilter] = useState('all')
  const [sessionEditor, setSessionEditor] = useState<SessionDraft | null>(null)

  // The global clock ticks every second; recompute heavy aggregates only when
  // the minute changes so the whole view isn't recalculated 60x per minute.
  const minuteKey = Math.floor(now.getTime() / 60000)

  const bounds = useMemo(
    () => ({
      todayStart: startOfDay(now),
      tomorrowStart: startOfNextDay(now),
      weekStart: startOfWeek(now, settings.weekStartsOn),
      nextWeekStart: startOfNextWeek(now, settings.weekStartsOn),
      monthStart: startOfMonth(now),
      nextMonthStart: startOfNextMonth(now),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minuteKey, settings.weekStartsOn],
  )
  const { todayStart, tomorrowStart, weekStart, nextWeekStart, monthStart, nextMonthStart } = bounds

  const workedTotals = useMemo(
    () => ({
      today: getWorkedMinutes(workSessions, activeSessionStart, now, todayStart, tomorrowStart),
      week: getWorkedMinutes(workSessions, activeSessionStart, now, weekStart, nextWeekStart),
      month: getWorkedMinutes(workSessions, activeSessionStart, now, monthStart, nextMonthStart),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minuteKey, workSessions, activeSessionStart, todayStart, tomorrowStart, weekStart, nextWeekStart, monthStart, nextMonthStart],
  )
  const todayWorkedMinutes = workedTotals.today
  const currentWeekWorked = workedTotals.week
  const currentMonthWorked = workedTotals.month
  const todayOvertimeMinutes = Math.max(0, todayWorkedMinutes - settings.standardWorkMinutes)

  const dailyRows = useMemo(
    () => buildDailyOvertimeRows(workSessions, activeSessionStart, now, settings.standardWorkMinutes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minuteKey, workSessions, activeSessionStart, settings.standardWorkMinutes],
  )
  const totalOvertimeMinutes = dailyRows.reduce((sum, row) => sum + row.overtime, 0)

  const allSessions = useMemo(() => {
    const completed = workSessions.map((session) => ({ ...session, startDate: new Date(session.start), endDate: new Date(session.end), isActive: false }))
    if (activeSessionStart) {
      completed.push({ id: 'active', start: activeSessionStart, end: now.toISOString(), startDate: new Date(activeSessionStart), endDate: now, isActive: true })
    }
    return completed.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  }, [workSessions, activeSessionStart, now])

  const todaySessions = allSessions.filter((session) => overlapMinutes(session.startDate, session.endDate, todayStart, tomorrowStart) > 0)

  const filteredWorkSessionsDescending = useMemo(
    () =>
      [...workSessions]
        .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
        .filter((session) => {
          if (workHistoryFilter === 'all') return true
          const start = new Date(session.start)
          const end = new Date(session.end)
          const rangeStart = workHistoryFilter === 'today' ? todayStart : workHistoryFilter === 'week' ? weekStart : monthStart
          const rangeEnd = workHistoryFilter === 'today' ? tomorrowStart : workHistoryFilter === 'week' ? nextWeekStart : nextMonthStart
          return overlapMinutes(start, end, rangeStart, rangeEnd) > 0
        })
        .slice(0, MAX_VISIBLE_WORK_LOG),
    [workSessions, workHistoryFilter, todayStart, tomorrowStart, weekStart, nextWeekStart, monthStart, nextMonthStart],
  )

  const workCardClass = todayWorkedMinutes >= settings.standardWorkMinutes ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-white/10 bg-black/30'

  function handleClockOut() {
    const result = clockOut()
    if (!result.ok && result.overlappingWindow) {
      setSessionEditor({ mode: 'create', id: null, start: toLocalInputValue(result.overlappingWindow.start), end: toLocalInputValue(result.overlappingWindow.end) })
    }
  }

  function openManualSessionEditor() {
    const anchorEnd = activeSessionStart ? new Date(activeSessionStart) : new Date()
    const anchorStart = new Date(anchorEnd.getTime() - 60 * 60000)
    setSessionEditor({ mode: 'create', id: null, start: toLocalInputValue(anchorStart.toISOString()), end: toLocalInputValue(anchorEnd.toISOString()) })
  }

  function saveSessionEditor() {
    if (!sessionEditor) return
    const startIso = fromLocalInputValue(sessionEditor.start)
    const endIso = fromLocalInputValue(sessionEditor.end)
    if (!startIso || !endIso) return pushFeedback('Please enter valid start and end times.', 'warn')
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) return pushFeedback('End time must be after start time.', 'warn')
    if (new Date(startIso).getTime() > Date.now() + FUTURE_TOLERANCE_MS || new Date(endIso).getTime() > Date.now() + FUTURE_TOLERANCE_MS) return pushFeedback('Work sessions cannot be saved in the future.', 'warn')
    if (hasSessionOverlap(workSessions, startIso, endIso, sessionEditor.mode === 'edit' ? sessionEditor.id : null)) return pushFeedback('That session overlaps an existing saved work session.', 'warn')
    if (activeSessionStart) {
      const activeConflict = startIso < new Date().toISOString() && endIso > activeSessionStart
      if (activeConflict) return pushFeedback('That session overlaps your currently running clock-in.', 'warn')
    }
    const session: WorkSession = { id: sessionEditor.id ?? `session-${Date.now()}`, start: startIso, end: endIso }
    if (sessionEditor.mode === 'create') addWorkSession(session)
    else updateWorkSession(session)
    setSessionEditor(null)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
      <div className={`rounded-[28px] border p-5 transition ${workCardClass}`}>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-white/45">Today</div>
              <div className="mt-2 text-3xl font-semibold text-white">{todayWorkedMinutes >= settings.standardWorkMinutes ? 'Completed work day' : 'In progress'}</div>
              <div className="mt-2 text-sm text-white/55">{activeSessionStart ? 'Clocked in now.' : 'Clocked out.'} Overtime begins after {formatMinutes(settings.standardWorkMinutes)}.</div>
            </div>
            <div className="flex gap-2">
              <button onClick={clockIn} disabled={Boolean(activeSessionStart)} className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">Clock In</button>
              <button onClick={handleClockOut} disabled={!activeSessionStart} className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">Clock Out</button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Status" value={activeSessionStart ? 'Clocked In' : 'Clocked Out'} subtext={`${todaySessions.length} session${todaySessions.length === 1 ? '' : 's'} touching today`} />
            <StatCard title="Target" value={formatMinutes(settings.standardWorkMinutes)} subtext="Standard day" />
            <StatCard title="Overtime Today" value={formatMinutes(todayOvertimeMinutes)} subtext={todayWorkedMinutes >= settings.standardWorkMinutes ? 'Banked today' : 'Not yet earned'} />
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-3">
            <button onClick={() => setWorkOpen((current) => !current)} className="flex w-full items-center justify-between rounded-2xl px-2 py-2 text-left text-sm text-white/75 transition hover:bg-white/5">
              <span className="font-medium text-white">Time Worked</span>
              <span>{workOpen ? 'Hide' : 'Reveal'}</span>
            </button>
            {workOpen ? (
              <div className="mt-3 space-y-3 px-2 pb-2">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <StatCard title="Today Total" value={formatMinutes(todayWorkedMinutes)} subtext="Across all sessions" />
                  <StatCard title="This Week" value={formatMinutes(currentWeekWorked)} subtext="Worked this week" />
                  <StatCard title="This Month" value={formatMinutes(currentMonthWorked)} subtext="Worked this month" />
                </div>
                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm font-medium text-white">Today’s Sessions</div>
                    <button onClick={openManualSessionEditor} className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white transition hover:bg-white/15">Add Manual Session</button>
                  </div>
                  {sessionEditor ? (
                    <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="mb-3 text-sm font-medium text-white">{sessionEditor.mode === 'create' ? 'Manual session' : 'Edit session'}</div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-sm text-white/60"><div className="mb-1">Start</div><input type="datetime-local" value={sessionEditor.start} onChange={(e) => setSessionEditor((current) => current ? { ...current, start: e.target.value } : current)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/25" /></label>
                        <label className="text-sm text-white/60"><div className="mb-1">End</div><input type="datetime-local" value={sessionEditor.end} onChange={(e) => setSessionEditor((current) => current ? { ...current, end: e.target.value } : current)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/25" /></label>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button onClick={saveSessionEditor} className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90">Save</button>
                        <button onClick={() => setSessionEditor(null)} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10">Cancel</button>
                      </div>
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    {todaySessions.length === 0 ? <div className="text-sm text-white/45">No work logged today yet.</div> : todaySessions.map((session) => (
                      <div key={session.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-white/80">{session.startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → {session.isActive ? 'Now' : session.endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="font-medium text-white">{formatMinutes(overlapMinutes(session.startDate, session.endDate, todayStart, tomorrowStart))}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">Recent Work Log</div>
                      <div className="text-sm text-white/45">{filteredWorkSessionsDescending.length} matching session{filteredWorkSessionsDescending.length === 1 ? '' : 's'}</div>
                    </div>
                    <SegmentedControl value={workHistoryFilter} onChange={setWorkHistoryFilter} options={[{ value: 'all', label: 'All' }, { value: 'today', label: 'Today' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
                  </div>
                  <div className="space-y-2">
                    {filteredWorkSessionsDescending.length === 0 ? <div className="text-sm text-white/45">No completed sessions in this filter.</div> : filteredWorkSessionsDescending.map((session) => {
                      const start = new Date(session.start)
                      const end = new Date(session.end)
                      return (
                        <div key={session.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="font-medium text-white">{formatDateLabel(start)}</div>
                            <div className="mt-1 text-white/55">{formatTimeLabel(start)} → {formatTimeLabel(end)} · {formatMinutes(overlapMinutes(start, end, start, end))}</div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setSessionEditor(buildSessionDraft(session))} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white transition hover:bg-white/10">Edit</button>
                            <button onClick={() => deleteWorkSession(session.id)} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white transition hover:bg-white/10">Delete</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-[28px] border border-white/10 bg-black/30 p-5">
          <div className="text-xs uppercase tracking-[0.25em] text-white/45">Banked</div>
          <div className="mt-3 text-4xl font-semibold text-white">{formatMinutes(totalOvertimeMinutes)}</div>
          <div className="mt-2 text-sm text-white/50">Total overtime accumulated beyond {formatMinutes(settings.standardWorkMinutes)} days.</div>
        </div>
      </div>
    </div>
  )
}
