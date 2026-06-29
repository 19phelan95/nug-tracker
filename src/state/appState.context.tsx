import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_SETTINGS } from '../lib/constants/appConstants'
import { LocalStorageAdapter } from '../lib/storage/storage.local'
import { countCloudRows, pullCloudState, pushFullState } from '../lib/storage/storage.cloud'
import { isSupabaseConfigured } from '../lib/supabase/client'
import { useAuth } from '../lib/supabase/auth.context'
import type { AppState } from '../types/AppState'
import type { LifeEntry } from '../types/LifeEntry'
import type { Settings } from '../types/Settings'
import type { WorkSession } from '../types/WorkSession'
import { sortLifeEntries, sortWorkSessions } from '../services/metrics.service'

interface FeedbackToast {
  id: string
  message: string
  tone: 'success' | 'warn' | 'neutral'
}

interface AppContextValue {
  now: Date
  settings: Settings
  activeSessionStart: string | null
  workSessions: WorkSession[]
  lifeEntries: LifeEntry[]
  hydrated: boolean
  feedback: FeedbackToast | null
  setSettings: (settings: Settings) => void
  clockIn: () => void
  clockOut: () => { ok: boolean; overlappingWindow?: { start: string; end: string } }
  setActiveSessionStart: (value: string | null) => void
  addWorkSession: (session: WorkSession) => void
  updateWorkSession: (session: WorkSession) => void
  deleteWorkSession: (id: string) => void
  addLifeEntry: (entry: LifeEntry) => void
  updateLifeEntry: (entry: LifeEntry) => void
  deleteLifeEntry: (id: string) => void
  exportBackup: () => Promise<void>
  importBackup: (file: File) => Promise<void>
  resetAllData: () => Promise<void>
  pushFeedback: (message: string, tone?: FeedbackToast['tone']) => void
  cloudConfigured: boolean
  cloudSignedIn: boolean
  syncToCloud: () => Promise<void>
  loadFromCloud: () => Promise<void>
}

const AppStateContext = createContext<AppContextValue | null>(null)

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const fallbackState = useMemo<AppState>(
    () => ({ settings: DEFAULT_SETTINGS, activeSessionStart: null, workSessions: [], lifeEntries: [] }),
    []
  )
  const storage = useMemo(() => new LocalStorageAdapter(fallbackState), [fallbackState])

  const [now, setNow] = useState(new Date())
  const [hydrated, setHydrated] = useState(false)
  const [settings, setSettingsState] = useState(DEFAULT_SETTINGS)
  const [activeSessionStart, setActiveSessionStart] = useState<string | null>(null)
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([])
  const [lifeEntries, setLifeEntries] = useState<LifeEntry[]>([])
  const [feedback, setFeedback] = useState<FeedbackToast | null>(null)

  const { session, ready: authReady } = useAuth()
  const cloudUserId = session?.user?.id ?? null
  const cloudSyncedUserRef = useRef<string | null>(null)
  const cloudPushTimer = useRef<number | null>(null)

  function pushFeedback(message: string, tone: FeedbackToast['tone'] = 'neutral') {
    setFeedback({ id: makeId('feedback'), message, tone })
  }

  useEffect(() => {
    storage.load().then((state) => {
      setSettingsState(state.settings)
      setActiveSessionStart(state.activeSessionStart)
      setWorkSessions(state.workSessions)
      setLifeEntries(state.lifeEntries)
      setHydrated(true)
    }).catch((error) => {
      console.error(error)
      pushFeedback('Saved data could not be read. Starting clean.', 'warn')
      setHydrated(true)
    })
  }, [storage])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(null), 2800)
    return () => window.clearTimeout(timer)
  }, [feedback])

  useEffect(() => {
    if (!hydrated) return
    const snapshot: AppState = {
      settings,
      activeSessionStart,
      workSessions: sortWorkSessions(workSessions),
      lifeEntries: sortLifeEntries(lifeEntries),
    }
    void storage.save(snapshot)

    // Best-effort cloud mirror, debounced — only after this user's initial
    // reconcile has run. Cloud errors never interrupt the local-first path.
    if (isSupabaseConfigured && cloudUserId && cloudSyncedUserRef.current === cloudUserId) {
      if (cloudPushTimer.current) window.clearTimeout(cloudPushTimer.current)
      cloudPushTimer.current = window.setTimeout(() => {
        pushFullState(cloudUserId, snapshot).catch((error) => {
          console.error(error)
          pushFeedback('Cloud sync paused — your changes are saved locally.', 'warn')
        })
      }, 1200)
    }
  }, [hydrated, storage, settings, activeSessionStart, workSessions, lifeEntries, cloudUserId])

  // On first sign-in for a user: seed an empty account from this device, or
  // pull the account's existing data down. Cloud failures never block local use.
  useEffect(() => {
    if (!isSupabaseConfigured || !authReady || !hydrated) return
    if (!cloudUserId) {
      cloudSyncedUserRef.current = null
      return
    }
    if (cloudSyncedUserRef.current === cloudUserId) return
    let cancelled = false
    void (async () => {
      try {
        const counts = await countCloudRows(cloudUserId)
        if (cancelled) return
        if (counts.total === 0) {
          await pushFullState(cloudUserId, { settings, activeSessionStart, workSessions, lifeEntries })
          if (!cancelled) pushFeedback('Synced this device to your account.', 'success')
        } else {
          const cloud = await pullCloudState(cloudUserId)
          if (cancelled) return
          setSettingsState(cloud.settings)
          setWorkSessions(cloud.workSessions)
          setLifeEntries(cloud.lifeEntries)
          pushFeedback('Loaded your account data.', 'success')
        }
        cloudSyncedUserRef.current = cloudUserId
      } catch (error) {
        console.error(error)
        if (!cancelled) pushFeedback('Cloud sync failed — working locally.', 'warn')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, hydrated, cloudUserId])

  function setSettings(settings: Settings) {
    setSettingsState(settings)
  }

  function clockIn() {
    if (activeSessionStart) return
    setActiveSessionStart(new Date().toISOString())
    pushFeedback('Clocked in.', 'success')
  }

  function clockOut() {
    if (!activeSessionStart) return { ok: false as const }
    const end = new Date().toISOString()
    const overlaps = workSessions.some((session) => {
      const start = new Date(activeSessionStart)
      const newEnd = new Date(end)
      return start < new Date(session.end) && newEnd > new Date(session.start)
    })
    if (overlaps) {
      setActiveSessionStart(null)
      pushFeedback('Clock out was blocked by an overlapping saved session. Repair it manually.', 'warn')
      return { ok: false as const, overlappingWindow: { start: activeSessionStart, end } }
    }
    const session: WorkSession = { id: makeId('session'), start: activeSessionStart, end }
    setWorkSessions((current) => sortWorkSessions([...current, session]))
    setActiveSessionStart(null)
    pushFeedback('Clocked out and session saved.', 'success')
    return { ok: true as const }
  }

  function addWorkSession(session: WorkSession) {
    setWorkSessions((current) => sortWorkSessions([...current, session]))
    pushFeedback('Work session saved.', 'success')
  }

  function updateWorkSession(session: WorkSession) {
    setWorkSessions((current) => sortWorkSessions(current.map((item) => (item.id === session.id ? session : item))))
    pushFeedback('Work session updated.', 'success')
  }

  function deleteWorkSession(id: string) {
    setWorkSessions((current) => current.filter((session) => session.id !== id))
    pushFeedback('Work session deleted.', 'success')
  }

  function addLifeEntry(entry: LifeEntry) {
    setLifeEntries((current) => sortLifeEntries([...current, entry]))
    pushFeedback('Life entry added.', 'success')
  }

  function updateLifeEntry(entry: LifeEntry) {
    setLifeEntries((current) => sortLifeEntries(current.map((item) => (item.id === entry.id ? entry : item))))
    pushFeedback('Life entry updated.', 'success')
  }

  function deleteLifeEntry(id: string) {
    setLifeEntries((current) => current.filter((entry) => entry.id !== id))
    pushFeedback('Life entry deleted.', 'success')
  }

  async function exportBackup() {
    await storage.exportBackup({ settings, activeSessionStart, workSessions, lifeEntries })
    pushFeedback('Backup exported.', 'success')
  }

  async function importBackup(file: File) {
    const next = await storage.importBackup(file)
    setSettingsState(next.settings)
    setActiveSessionStart(next.activeSessionStart)
    setWorkSessions(next.workSessions)
    setLifeEntries(next.lifeEntries)
    pushFeedback('Backup imported.', 'success')
  }

  async function resetAllData() {
    await storage.reset()
    setSettingsState(DEFAULT_SETTINGS)
    setActiveSessionStart(null)
    setWorkSessions([])
    setLifeEntries([])
    pushFeedback('All local data reset.', 'warn')
  }

  async function syncToCloud() {
    if (!isSupabaseConfigured || !cloudUserId) {
      pushFeedback('Sign in to enable cloud sync.', 'warn')
      return
    }
    try {
      await pushFullState(cloudUserId, { settings, activeSessionStart, workSessions, lifeEntries })
      cloudSyncedUserRef.current = cloudUserId
      pushFeedback('This device synced to your account.', 'success')
    } catch (error) {
      console.error(error)
      pushFeedback('Cloud sync failed.', 'warn')
    }
  }

  async function loadFromCloud() {
    if (!isSupabaseConfigured || !cloudUserId) {
      pushFeedback('Sign in to load account data.', 'warn')
      return
    }
    try {
      const cloud = await pullCloudState(cloudUserId)
      setSettingsState(cloud.settings)
      setWorkSessions(cloud.workSessions)
      setLifeEntries(cloud.lifeEntries)
      cloudSyncedUserRef.current = cloudUserId
      pushFeedback('Loaded your account data.', 'success')
    } catch (error) {
      console.error(error)
      pushFeedback('Could not load account data.', 'warn')
    }
  }

  const value: AppContextValue = {
    now,
    settings,
    activeSessionStart,
    workSessions,
    lifeEntries,
    hydrated,
    feedback,
    setSettings,
    clockIn,
    clockOut,
    setActiveSessionStart,
    addWorkSession,
    updateWorkSession,
    deleteWorkSession,
    addLifeEntry,
    updateLifeEntry,
    deleteLifeEntry,
    exportBackup,
    importBackup,
    resetAllData,
    pushFeedback,
    cloudConfigured: isSupabaseConfigured,
    cloudSignedIn: Boolean(cloudUserId),
    syncToCloud,
    loadFromCloud,
  }

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const context = useContext(AppStateContext)
  if (!context) throw new Error('useAppState must be used inside AppProvider')
  return context
}
