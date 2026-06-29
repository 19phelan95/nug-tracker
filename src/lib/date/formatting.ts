export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export function formatHoursValue(totalMinutes: number): string {
  const hours = totalMinutes / 60
  return Number.isInteger(hours) ? `${hours}` : `${hours.toFixed(2).replace(/\.00$/, '')}`
}

export function formatDecimalHours(totalMinutes: number): string {
  return `${(totalMinutes / 60).toFixed(2)}h`
}

export function formatTargetHelper(minutes: number, period: 'day' | 'week'): string {
  if (minutes < 60) return `${minutes}m / ${period}`
  const hours = minutes / 60
  const display = Number.isInteger(hours) ? `${hours}` : `${hours.toFixed(1).replace(/\.0$/, '')}`
  return `${display}h / ${period}`
}

export function formatDateLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateShort(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatTimeLabel(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function dateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function monthKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function overlapMinutes(sessionStart: Date, sessionEnd: Date, rangeStart: Date, rangeEnd: Date): number {
  const start = Math.max(sessionStart.getTime(), rangeStart.getTime())
  const end = Math.min(sessionEnd.getTime(), rangeEnd.getTime())
  return Math.max(0, end - start) / 60000
}

export function toLocalInputValue(isoString: string): string {
  const date = new Date(isoString)
  const offsetMs = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

export function fromLocalInputValue(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
