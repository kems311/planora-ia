import type { WorkCalendar } from './types'

const DAY_MS = 86_400_000

export function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date invalide : format AAAA-MM-JJ attendu.')
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Date invalide.')
  }
  return date
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function shiftCalendarDays(value: string, days: number): string {
  return formatDate(new Date(parseDate(value).getTime() + days * DAY_MS))
}

export function nextWorkingDay(value: string, calendar: WorkCalendar): string {
  let cursor = value
  for (let attempts = 0; attempts < 3660; attempts++) {
    if (calendar.isWorkingDay(cursor)) return cursor
    cursor = shiftCalendarDays(cursor, 1)
  }
  throw new Error('Calendrier invalide : aucun jour ouvré dans les dix prochaines années.')
}

export function previousWorkingDay(value: string, calendar: WorkCalendar): string {
  let cursor = value
  for (let attempts = 0; attempts < 3660; attempts++) {
    if (calendar.isWorkingDay(cursor)) return cursor
    cursor = shiftCalendarDays(cursor, -1)
  }
  throw new Error('Calendrier invalide : aucun jour ouvré dans les dix dernières années.')
}

export function addWorkingDays(value: string, days: number, calendar: WorkCalendar): string {
  if (!Number.isSafeInteger(days)) throw new Error('Le nombre de jours doit être entier.')
  let cursor = nextWorkingDay(value, calendar)
  const direction = days >= 0 ? 1 : -1
  for (let remaining = Math.abs(days); remaining > 0; remaining--) {
    cursor = direction === 1
      ? nextWorkingDay(shiftCalendarDays(cursor, 1), calendar)
      : previousWorkingDay(shiftCalendarDays(cursor, -1), calendar)
  }
  return cursor
}

export function workingDaysBetween(from: string, to: string, calendar: WorkCalendar): number {
  parseDate(from)
  parseDate(to)
  if (from === to) return 0
  const direction = from < to ? 1 : -1
  let count = 0
  for (let cursor = shiftCalendarDays(from, direction); direction === 1 ? cursor <= to : cursor >= to; cursor = shiftCalendarDays(cursor, direction)) {
    if (calendar.isWorkingDay(cursor)) count += direction
  }
  return count
}
