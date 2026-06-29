import { DEFAULT_SETTINGS, LIFE_CATEGORY_KEY_SET } from '../constants/appConstants'
import { supabase } from '../supabase/client'
import type { AppState } from '../../types/AppState'
import type { LifeEntry } from '../../types/LifeEntry'
import type { Settings } from '../../types/Settings'
import type { WorkSession } from '../../types/WorkSession'

/** The portion of app state that is synced to the cloud (no ephemeral clock-in). */
export interface CloudState {
  settings: Settings
  workSessions: WorkSession[]
  lifeEntries: LifeEntry[]
}

interface SettingsRow {
  user_id: string
  standard_work_minutes: number
  week_starts_on: number
  life_targets: Record<string, number>
}
interface WorkSessionRow {
  id: string
  user_id: string
  start_at: string
  end_at: string
}
interface LifeEntryRow {
  id: string
  user_id: string
  category: string
  minutes: number
  logged_at: string
}

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

/** Row counts for the account, used to decide seed-vs-pull on first sign-in. */
export async function countCloudRows(
  userId: string,
): Promise<{ total: number; sessions: number; entries: number; hasSettings: boolean }> {
  const db = requireClient()
  const [sessions, entries, settings] = await Promise.all([
    db.from('work_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('life_entries').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('user_settings').select('user_id', { count: 'exact', head: true }).eq('user_id', userId),
  ])
  if (sessions.error) throw sessions.error
  if (entries.error) throw entries.error
  if (settings.error) throw settings.error
  const sessionCount = sessions.count ?? 0
  const entryCount = entries.count ?? 0
  const settingsCount = settings.count ?? 0
  return {
    total: sessionCount + entryCount + settingsCount,
    sessions: sessionCount,
    entries: entryCount,
    hasSettings: settingsCount > 0,
  }
}

function mapSettingsRow(row: SettingsRow | null): Settings {
  if (!row) return { ...DEFAULT_SETTINGS, lifeTargets: { ...DEFAULT_SETTINGS.lifeTargets } }
  const weekStartsOn = row.week_starts_on === 0 ? 0 : 1
  const lifeTargets: Record<string, number> = { ...DEFAULT_SETTINGS.lifeTargets }
  if (row.life_targets && typeof row.life_targets === 'object') {
    for (const key of Object.keys(lifeTargets)) {
      const value = Number((row.life_targets as Record<string, unknown>)[key])
      if (Number.isFinite(value) && value > 0) lifeTargets[key] = Math.round(value)
    }
  }
  const standardWorkMinutes = Number(row.standard_work_minutes)
  return {
    standardWorkMinutes:
      Number.isFinite(standardWorkMinutes) && standardWorkMinutes > 0
        ? Math.round(standardWorkMinutes)
        : DEFAULT_SETTINGS.standardWorkMinutes,
    weekStartsOn,
    lifeTargets,
  }
}

/** Read the full account state from the cloud. */
export async function pullCloudState(userId: string): Promise<CloudState> {
  const db = requireClient()
  const [settingsRes, sessionsRes, entriesRes] = await Promise.all([
    db.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    db.from('work_sessions').select('*').eq('user_id', userId),
    db.from('life_entries').select('*').eq('user_id', userId),
  ])
  if (settingsRes.error) throw settingsRes.error
  if (sessionsRes.error) throw sessionsRes.error
  if (entriesRes.error) throw entriesRes.error

  const settings = mapSettingsRow((settingsRes.data as SettingsRow | null) ?? null)

  const workSessions: WorkSession[] = ((sessionsRes.data as WorkSessionRow[] | null) ?? [])
    .filter((row) => Boolean(row.start_at) && Boolean(row.end_at))
    .map((row) => ({ id: row.id, start: new Date(row.start_at).toISOString(), end: new Date(row.end_at).toISOString() }))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  const lifeEntries: LifeEntry[] = ((entriesRes.data as LifeEntryRow[] | null) ?? [])
    .filter((row) => LIFE_CATEGORY_KEY_SET.has(row.category) && Number(row.minutes) > 0)
    .map((row) => ({ id: row.id, category: row.category, minutes: Number(row.minutes), timestamp: new Date(row.logged_at).toISOString() }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  return { settings, workSessions, lifeEntries }
}

async function deleteMissing(
  userId: string,
  table: 'work_sessions' | 'life_entries',
  keepIds: string[],
): Promise<void> {
  const db = requireClient()
  let query = db.from(table).delete().eq('user_id', userId)
  if (keepIds.length > 0) {
    // App ids are slug-safe (alphanumeric + hyphen), so no quoting is needed.
    query = query.not('id', 'in', `(${keepIds.join(',')})`)
  }
  const { error } = await query
  if (error) throw error
}

/**
 * Mirror this device's full local state up to the cloud: upsert settings and
 * all rows, then remove cloud rows that no longer exist locally. Local stays
 * the source of truth; the cloud is a synced copy.
 */
export async function pushFullState(userId: string, state: AppState | CloudState): Promise<void> {
  const db = requireClient()
  const nowIso = new Date().toISOString()

  const settingsResult = await db.from('user_settings').upsert({
    user_id: userId,
    standard_work_minutes: state.settings.standardWorkMinutes,
    week_starts_on: state.settings.weekStartsOn,
    life_targets: state.settings.lifeTargets,
    updated_at: nowIso,
  })
  if (settingsResult.error) throw settingsResult.error

  if (state.workSessions.length > 0) {
    const rows = state.workSessions.map((s) => ({ id: s.id, user_id: userId, start_at: s.start, end_at: s.end, updated_at: nowIso }))
    const { error } = await db.from('work_sessions').upsert(rows)
    if (error) throw error
  }
  await deleteMissing(userId, 'work_sessions', state.workSessions.map((s) => s.id))

  if (state.lifeEntries.length > 0) {
    const rows = state.lifeEntries.map((e) => ({ id: e.id, user_id: userId, category: e.category, minutes: e.minutes, logged_at: e.timestamp, updated_at: nowIso }))
    const { error } = await db.from('life_entries').upsert(rows)
    if (error) throw error
  }
  await deleteMissing(userId, 'life_entries', state.lifeEntries.map((e) => e.id))
}

/** Seed an empty account with this device's local data. */
export async function migrateLocalToCloud(userId: string, state: AppState | CloudState): Promise<void> {
  await pushFullState(userId, state)
}
