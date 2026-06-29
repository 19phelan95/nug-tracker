import type { LifeEntry } from './LifeEntry'
import type { Settings } from './Settings'
import type { WorkSession } from './WorkSession'

export interface AppState {
  settings: Settings
  activeSessionStart: string | null
  workSessions: WorkSession[]
  lifeEntries: LifeEntry[]
}
