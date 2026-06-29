import { STORAGE_KEY } from '../constants/appConstants'
import { validateStoredData } from '../validation/sanitize'
import type { AppState } from '../../types/AppState'
import type { StorageAdapter } from './storage.types'

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly fallbackState: AppState) {}

  async load(): Promise<AppState> {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return this.fallbackState
    const parsed = JSON.parse(raw)
    const clean = validateStoredData(parsed)
    return {
      settings: clean.settings,
      activeSessionStart: clean.activeSessionStart,
      workSessions: clean.workSessions,
      lifeEntries: clean.lifeEntries,
    }
  }

  async save(state: AppState): Promise<void> {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }

  async reset(): Promise<void> {
    window.localStorage.removeItem(STORAGE_KEY)
  }

  async exportBackup(state: AppState): Promise<void> {
    const date = new Date().toISOString().slice(0, 10)
    downloadJson(`life-tracker-backup-${date}.json`, {
      version: 3,
      exportedAt: new Date().toISOString(),
      ...state,
    })
  }

  async importBackup(file: File): Promise<AppState> {
    const text = await file.text()
    const parsed = JSON.parse(text)
    const clean = validateStoredData(parsed)
    return {
      settings: clean.settings,
      activeSessionStart: clean.activeSessionStart,
      workSessions: clean.workSessions,
      lifeEntries: clean.lifeEntries,
    }
  }
}
