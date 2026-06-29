import type { AppState } from '../../types/AppState'

export interface StorageAdapter {
  load(): Promise<AppState>
  save(state: AppState): Promise<void>
  reset(): Promise<void>
  exportBackup(state: AppState): Promise<void>
  importBackup(file: File): Promise<AppState>
}
