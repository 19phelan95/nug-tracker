import { DEFAULT_SETTINGS, FUTURE_TOLERANCE_MS, LIFE_CATEGORIES, LIFE_CATEGORY_KEY_SET } from '../constants/appConstants'
import { isValidIsoString } from './guards'
import { sortLifeEntries, sortWorkSessions, hasSessionOverlap } from '../../services/metrics.service'
import type { AppState } from '../../types/AppState'
import type { LifeEntry } from '../../types/LifeEntry'
import type { Settings } from '../../types/Settings'
import type { WorkSession } from '../../types/WorkSession'

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function sanitizeSettings(rawSettings: unknown): { settings: Settings; repairs: number } {
  let repairs = 0
  const safe: Settings = {
    standardWorkMinutes: DEFAULT_SETTINGS.standardWorkMinutes,
    weekStartsOn: DEFAULT_SETTINGS.weekStartsOn,
    lifeTargets: { ...DEFAULT_SETTINGS.lifeTargets },
  }

  if (rawSettings && typeof rawSettings === 'object') {
    const source = rawSettings as Record<string, unknown>
    const standardWorkMinutes = Number(source.standardWorkMinutes)
    if (Number.isFinite(standardWorkMinutes) && standardWorkMinutes > 0 && standardWorkMinutes <= 24 * 60) {
      safe.standardWorkMinutes = Math.round(standardWorkMinutes)
    } else if (source.standardWorkMinutes !== undefined) {
      repairs += 1
    }

    if (source.weekStartsOn === 0 || source.weekStartsOn === 1) {
      safe.weekStartsOn = source.weekStartsOn as 0 | 1
    } else if (source.weekStartsOn !== undefined) {
      repairs += 1
    }

    if (source.lifeTargets && typeof source.lifeTargets === 'object') {
      const targets = source.lifeTargets as Record<string, unknown>
      LIFE_CATEGORIES.forEach((category) => {
        const raw = Number(targets[category.key])
        if (Number.isFinite(raw) && raw > 0 && raw <= 7 * 24 * 60) {
          safe.lifeTargets[category.key] = Math.round(raw)
        } else if (targets[category.key] !== undefined) {
          repairs += 1
        }
      })
    }
  }

  return { settings: safe, repairs }
}

export function sanitizeWorkSessions(rawSessions: unknown): { sessions: WorkSession[]; repairs: number } {
  let repairs = 0
  const seenIds = new Set<string>()
  const validSessions: WorkSession[] = []

  if (!Array.isArray(rawSessions)) return { sessions: [], repairs }

  rawSessions.forEach((session) => {
    const candidate = session as Partial<WorkSession>
    const valid = typeof candidate?.id === 'string' && isValidIsoString(candidate.start) && isValidIsoString(candidate.end)
    if (!valid) {
      repairs += 1
      return
    }
    if (new Date(candidate.end!).getTime() <= new Date(candidate.start!).getTime()) {
      repairs += 1
      return
    }

    let id = candidate.id!
    if (seenIds.has(id)) {
      id = makeId('session')
      repairs += 1
    }
    seenIds.add(id)
    validSessions.push({ id, start: candidate.start!, end: candidate.end! })
  })

  const sorted = sortWorkSessions(validSessions)
  const deconflicted: WorkSession[] = []
  sorted.forEach((session) => {
    const previous = deconflicted[deconflicted.length - 1]
    if (!previous) {
      deconflicted.push(session)
      return
    }
    if (new Date(session.start).getTime() < new Date(previous.end).getTime()) {
      repairs += 1
      return
    }
    deconflicted.push(session)
  })

  return { sessions: deconflicted, repairs }
}

export function sanitizeLifeEntries(rawEntries: unknown): { entries: LifeEntry[]; repairs: number } {
  let repairs = 0
  const seenIds = new Set<string>()
  const validEntries: LifeEntry[] = []

  if (!Array.isArray(rawEntries)) return { entries: [], repairs }

  rawEntries.forEach((entry) => {
    const candidate = entry as Partial<LifeEntry>
    const valid = typeof candidate?.id === 'string' && typeof candidate.category === 'string' && Number.isFinite(Number(candidate.minutes)) && isValidIsoString(candidate.timestamp)
    if (!valid) {
      repairs += 1
      return
    }

    const minutes = Number(candidate.minutes)
    if (minutes <= 0 || !LIFE_CATEGORY_KEY_SET.has(candidate.category!)) {
      repairs += 1
      return
    }

    let id = candidate.id!
    if (seenIds.has(id)) {
      id = makeId('life')
      repairs += 1
    }
    seenIds.add(id)
    validEntries.push({ id, category: candidate.category!, minutes, timestamp: candidate.timestamp! })
  })

  return { entries: sortLifeEntries(validEntries), repairs }
}

export function validateStoredData(raw: unknown): AppState & { repairs: number } {
  let repairs = 0
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const settingsResult = sanitizeSettings(source.settings)
  const workResult = sanitizeWorkSessions(source.workSessions)
  const lifeResult = sanitizeLifeEntries(source.lifeEntries)
  repairs += settingsResult.repairs + workResult.repairs + lifeResult.repairs

  let activeSessionStart = isValidIsoString(source.activeSessionStart) ? source.activeSessionStart : null
  if (source.activeSessionStart && !activeSessionStart) repairs += 1
  if (activeSessionStart && new Date(activeSessionStart).getTime() > Date.now() + FUTURE_TOLERANCE_MS) {
    activeSessionStart = null
    repairs += 1
  }
  if (activeSessionStart && hasSessionOverlap(workResult.sessions, activeSessionStart, new Date().toISOString())) {
    activeSessionStart = null
    repairs += 1
  }

  return {
    settings: settingsResult.settings,
    activeSessionStart,
    workSessions: workResult.sessions,
    lifeEntries: lifeResult.entries,
    repairs,
  }
}
