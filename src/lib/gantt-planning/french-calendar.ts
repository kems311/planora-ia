import { formatDate, parseDate, shiftCalendarDays } from './date-utils'
import type { WorkCalendar } from './types'

/** Calcul grégorien de Pâques (algorithme de Meeus/Jones/Butcher). */
function easterSunday(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return formatDate(new Date(Date.UTC(year, month - 1, day)))
}

/** France métropolitaine, hors jours fériés locaux d'Alsace-Moselle / outre-mer. */
export class FrenchWorkCalendar implements WorkCalendar {
  private readonly loadedYears = new Set<number>()
  private readonly holidays = new Set<string>()

  constructor(years: number[] = []) {
    years.forEach((year) => this.loadYear(year))
  }

  private loadYear(year: number) {
    if (this.loadedYears.has(year)) return
    const y = String(year).padStart(4, '0')
    for (const day of ['01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25']) {
      this.holidays.add(`${y}-${day}`)
    }
    const easter = easterSunday(year)
    for (const offset of [1, 39, 50]) this.holidays.add(shiftCalendarDays(easter, offset))
    this.loadedYears.add(year)
  }

  isWorkingDay(value: string): boolean {
    const date = parseDate(value)
    this.loadYear(date.getUTCFullYear())
    const day = date.getUTCDay()
    return day !== 0 && day !== 6 && !this.holidays.has(value)
  }
}

export function calendarForRange(start: string, extraYears = 5): FrenchWorkCalendar {
  const year = parseDate(start).getUTCFullYear()
  return new FrenchWorkCalendar(Array.from({ length: Math.max(0, extraYears) + 1 }, (_, i) => year + i))
}
