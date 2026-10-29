import { parseDate, shiftCalendarDays } from './date-utils'
import type { ScheduledTask } from './types'

const DAY_MS = 86_400_000

export function calendarDaysBetween(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / DAY_MS)
}

export interface GanttGeometry {
  id: string
  left: number
  right: number
  centerY: number
  milestone: boolean
}

export function taskGeometry(task: ScheduledTask, start: string, dayWidth: number, index: number): GanttGeometry {
  const startOffset = calendarDaysBetween(start, task.earlyStart)
  const endOffset = calendarDaysBetween(start, task.earlyFinish) + 1
  // Un jalon initial est au début du premier jour ; les autres à la fin du jour indiqué.
  const point = task.earlyStartOffset === 0 ? startOffset : endOffset
  return {
    id: task.id,
    left: (task.duration === 0 ? point : startOffset) * dayWidth,
    right: (task.duration === 0 ? point : endOffset) * dayWidth,
    centerY: index * 64 + 32,
    milestone: task.duration === 0,
  }
}

export function dependencyPath(from: GanttGeometry, to: GanttGeometry, timelineWidth: number): string {
  const startX = from.right + (from.milestone ? 8 : 0)
  const endX = to.left - (to.milestone ? 8 : 0)
  const startY = from.centerY
  const endY = to.centerY
  const gap = endX - startX
  // Connexion fin-début ; détour dans l'interligne lorsque les bornes sont contiguës.
  if (gap >= 22) {
    const elbow = startX + Math.min(20, gap / 2)
    return `M ${startX} ${startY} H ${elbow} V ${endY} H ${endX}`
  }
  const exitX = Math.min(startX + 12, timelineWidth - 4)
  const entryX = endX - 12
  const laneY = startY + (endY >= startY ? 24 : -24)
  return `M ${startX} ${startY} H ${exitX} V ${laneY} H ${entryX} V ${endY} H ${endX}`
}

export function dateRange(start: string, end: string): string[] {
  const size = calendarDaysBetween(start, end) + 1
  if (size < 1 || size > 36_600) throw new Error('Période Gantt invalide ou supérieure à 100 ans.')
  return Array.from({ length: size }, (_, index) => shiftCalendarDays(start, index))
}
