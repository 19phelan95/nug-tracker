import type { Settings } from '../../types/Settings'

export const STORAGE_KEY = 'life-tracker-v2'
export const DEFAULT_STANDARD_WORK_MINUTES = 7.5 * 60
export const MAX_VISIBLE_WORK_LOG = 20
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000

export interface LifeCategory {
  key: string
  label: string
  icon: string
  defaultTargetMinutes: number
  period: 'day' | 'week'
  quickAdds: number[]
}

export const LIFE_CATEGORIES: LifeCategory[] = [
  { key: 'gym', label: 'Gym', icon: '🏋️', defaultTargetMinutes: 270, period: 'week', quickAdds: [30, 60, 90] },
  { key: 'ableton', label: 'Ableton', icon: '♪', defaultTargetMinutes: 600, period: 'week', quickAdds: [30, 60, 120] },
  { key: 'touchdesigner', label: 'TouchDesigner', icon: '🖐️', defaultTargetMinutes: 600, period: 'week', quickAdds: [30, 60, 120] },
  { key: 'practice', label: 'Practice', icon: '🎹', defaultTargetMinutes: 15, period: 'day', quickAdds: [5, 15, 30] },
  { key: 'social', label: 'Social', icon: '👥', defaultTargetMinutes: 480, period: 'week', quickAdds: [30, 60, 120] },
  { key: 'free', label: 'Free', icon: '☀️', defaultTargetMinutes: 480, period: 'week', quickAdds: [30, 60, 120] },
  { key: 'sleep', label: 'Sleep', icon: 'Zz', defaultTargetMinutes: 480, period: 'day', quickAdds: [30, 60, 120] },
]

export const LIFE_CATEGORY_KEY_SET = new Set(LIFE_CATEGORIES.map((category) => category.key))

export const DEFAULT_SETTINGS: Settings = {
  standardWorkMinutes: DEFAULT_STANDARD_WORK_MINUTES,
  weekStartsOn: 1,
  lifeTargets: Object.fromEntries(LIFE_CATEGORIES.map((category) => [category.key, category.defaultTargetMinutes])),
}
