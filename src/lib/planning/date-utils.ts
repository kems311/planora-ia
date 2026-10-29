import type { WorkCalendar } from './types'

const DAY_MS = 86_400_000

export function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function shiftCalendarDays(value: string, days: number): string {
  return formatDate(new Date(parseDate(value).getTime() + days * DAY_MS))
}

export function nextWorkingDay(value: string, calendar: WorkCalendar): string {
  let cursor = value
  while (!calendar.isWorkingDay(cursor)) cursor = shiftCalendarDays(cursor, 1)
  return cursor
}

export function previousWorkingDay(value: string, calendar: WorkCalendar): string {
  let cursor = value
  while (!calendar.isWorkingDay(cursor)) cursor = shiftCalendarDays(cursor, -1)
  return cursor
}

export function addWorkingDays(
  value: string,
  days: number,
  calendar: WorkCalendar,
): string {
  if (!Number.isInteger(days)) throw new Error('Le nombre de jours doit être entier.')
  let cursor = nextWorkingDay(value, calendar)
  if (days === 0) return cursor
  const direction = days > 0 ? 1 : -1
  let remaining = Math.abs(days)
  while (remaining > 0) {
    cursor = shiftCalendarDays(cursor, direction)
    if (calendar.isWorkingDay(cursor)) remaining -= 1
  }
  return cursor
}

export function workingDaysBetween(
  from: string,
  to: string,
  calendar: WorkCalendar,
): number {
  if (from === to) return 0
  const direction = from < to ? 1 : -1
  let cursor = from
  let count = 0
  while (cursor !== to) {
    cursor = shiftCalendarDays(cursor, direction)
    if (calendar.isWorkingDay(cursor)) count += direction
  }
  return count
}
