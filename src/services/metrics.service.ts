import { LIFE_CATEGORIES } from '../lib/constants/appConstants'
import { startOfDay } from '../lib/date/dateRanges'
import { clamp, dateKey, monthKey, overlapMinutes } from '../lib/date/formatting'
import type { LifeEntry } from '../types/LifeEntry'
import type { Settings } from '../types/Settings'
import type { WorkSession } from '../types/WorkSession'

/**
 * Aggregated overtime for a single period (day, week, or month).
 * Daily rows always carry `days: 1` so day/week/month rows share one shape
 * and consumers never have to feature-detect the `days` field.
 */
export interface OvertimeRow {
  key: string
  start: Date
  worked: number
  overtime: number
  days: number
}

export function sortWorkSessions(sessions: WorkSession[]): WorkSession[] {
  return [...sessions].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
}

export function sortLifeEntries(entries: LifeEntry[]): LifeEntry[] {
  return [...entries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

export function hasSessionOverlap(workSessions: WorkSession[], startIso: string, endIso: string, excludeId: string | null = null): boolean {
  const start = new Date(startIso)
  const end = new Date(endIso)
  return workSessions.some((session) => {
    if (session.id === excludeId) return false
    const otherStart = new Date(session.start)
    const otherEnd = new Date(session.end)
    return start < otherEnd && end > otherStart
  })
}

export function getWorkedMinutes(sessions: WorkSession[], activeSessionStart: string | null, now: Date, rangeStart: Date, rangeEnd: Date): number {
  const mapped = sessions.map((session) => ({ start: new Date(session.start), end: new Date(session.end) }))
  if (activeSessionStart) mapped.push({ start: new Date(activeSessionStart), end: now })
  return mapped.reduce((sum, session) => sum + overlapMinutes(session.start, session.end, rangeStart, rangeEnd), 0)
}

export function buildDailyOvertimeRows(sessions: WorkSession[], activeSessionStart: string | null, now: Date, standardWorkMinutes: number): OvertimeRow[] {
  const all = sessions.map((session) => ({ startDate: new Date(session.start), endDate: new Date(session.end) }))
  if (activeSessionStart) all.push({ startDate: new Date(activeSessionStart), endDate: now })
  const dayMap = new Map<string, OvertimeRow>()
  all.forEach((session) => {
    let cursor = startOfDay(session.startDate)
    const finalDay = startOfDay(session.endDate)
    while (cursor.getTime() <= finalDay.getTime()) {
      const key = dateKey(cursor)
      if (!dayMap.has(key)) {
        const start = new Date(cursor)
        const end = new Date(cursor)
        end.setDate(end.getDate() + 1)
        const worked = getWorkedMinutes(sessions, activeSessionStart, now, start, end)
        const overtime = Math.max(0, worked - standardWorkMinutes)
        if (worked > 0 || overtime > 0) {
          dayMap.set(key, { key, start, worked, overtime, days: 1 })
        }
      }
      const next = new Date(cursor)
      next.setDate(next.getDate() + 1)
      cursor = next
    }
  })
  return Array.from(dayMap.values()).filter((row) => row.overtime > 0).sort((a, b) => b.start.getTime() - a.start.getTime())
}

export function buildWeeklyOvertimeRows(dailyRows: OvertimeRow[], weekStartFn: (d: Date) => Date): OvertimeRow[] {
  const weekMap = new Map<string, OvertimeRow>()
  dailyRows.forEach((row) => {
    const start = weekStartFn(row.start)
    const key = dateKey(start)
    const current = weekMap.get(key) ?? { key, start, worked: 0, overtime: 0, days: 0 }
    current.worked += row.worked
    current.overtime += row.overtime
    current.days += 1
    weekMap.set(key, current)
  })
  return Array.from(weekMap.values()).sort((a, b) => b.start.getTime() - a.start.getTime())
}

export function buildMonthlyOvertimeRows(dailyRows: OvertimeRow[]): OvertimeRow[] {
  const monthMap = new Map<string, OvertimeRow>()
  dailyRows.forEach((row) => {
    const start = new Date(row.start.getFullYear(), row.start.getMonth(), 1)
    const key = monthKey(start)
    const current = monthMap.get(key) ?? { key, start, worked: 0, overtime: 0, days: 0 }
    current.worked += row.worked
    current.overtime += row.overtime
    current.days += 1
    monthMap.set(key, current)
  })
  return Array.from(monthMap.values()).sort((a, b) => b.start.getTime() - a.start.getTime())
}

export function buildLifeStats(lifeEntries: LifeEntry[], settings: Settings, now: Date, todayStart: Date, tomorrowStart: Date, weekStart: Date, nextWeekStart: Date) {
  return LIFE_CATEGORIES.map((category) => {
    const targetMinutes = settings.lifeTargets[category.key]
    const periodStart = category.period === 'day' ? todayStart : weekStart
    const periodEnd = category.period === 'day' ? tomorrowStart : nextWeekStart
    const periodDuration = periodEnd.getTime() - periodStart.getTime()
    const elapsed = clamp((now.getTime() - periodStart.getTime()) / periodDuration, 0, 1)
    const entries = lifeEntries.filter((entry) => {
      if (entry.category !== category.key) return false
      const time = new Date(entry.timestamp).getTime()
      return time >= periodStart.getTime() && time < periodEnd.getTime()
    })
    const loggedMinutes = entries.reduce((sum, entry) => sum + entry.minutes, 0)
    const requiredByNow = targetMinutes * elapsed
    const deficit = Math.max(0, requiredByNow - loggedMinutes)
    const barPercent = loggedMinutes >= targetMinutes ? 100 : clamp(100 - (deficit / targetMinutes) * 100, 0, 100)
    return {
      ...category,
      targetMinutes,
      loggedMinutes,
      barPercent,
      periodEntries: [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    }
  })
}
