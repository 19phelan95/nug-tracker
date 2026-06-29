export function isValidDateInstance(date: Date): boolean {
  return date instanceof Date && !Number.isNaN(date.getTime())
}

export function isValidIsoString(value: unknown): value is string {
  return typeof value === 'string' && isValidDateInstance(new Date(value))
}
