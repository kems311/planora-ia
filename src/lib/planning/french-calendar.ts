import Holidays from 'date-holidays'
import { parseDate } from './date-utils'
import type { WorkCalendar } from './types'

export class FrenchWorkCalendar implements WorkCalendar {
  private readonly holidays = new Set<string>()

  constructor(years: number[]) {
    const hd = new Holidays('FR')
    for (const year of years) {
      for (const holiday of hd.getHolidays(year)) {
        if (holiday.type === 'public') this.holidays.add(holiday.date.slice(0, 10))
      }
    }
  }

  isWorkingDay(value: string): boolean {
    const day = parseDate(value).getUTCDay()
    return day !== 0 && day !== 6 && !this.holidays.has(value)
  }
}

export function calendarForRange(start: string, extraYears = 5): FrenchWorkCalendar {
  const startYear = Number(start.slice(0, 4))
  return new FrenchWorkCalendar(
    Array.from({ length: extraYears + 1 }, (_, index) => startYear + index),
  )
}
