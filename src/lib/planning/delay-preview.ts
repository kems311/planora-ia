import { workingDaysBetween } from './date-utils'
import { PlanningError, scheduleProject } from './engine'
import type { PlanningTaskInput, ScheduledTask, WorkCalendar } from './types'

/** Retard maximal acceptable pour un signalement, en jours ouvrés. */
export const MAX_DELAY_DAYS = 365

export interface DateRange {
  start: string
  finish: string
}

export interface TaskDateChange {
  id: string
  name: string
  before: DateRange
  after: DateRange
  /** Décalage de la date de fin, en jours ouvrés (toujours positif ou nul). */
  finishShiftWorkingDays: number
}

export interface DelayPreview {
  taskId: string
  delayDays: number
  /** Uniquement les tâches dont les dates changent, triées par nouvelle date de début. */
  changes: TaskDateChange[]
  becameCritical: string[]
  noLongerCritical: string[]
  projectFinishBefore: string
  projectFinishAfter: string
  projectShiftWorkingDays: number
}

/**
 * Simule un retard de `delayDays` jours ouvrés sur une tâche, sans rien modifier.
 * Le retard allonge la durée de la tâche ; le planning est recalculé avec le même moteur.
 * Le calendrier fourni doit couvrir la période simulée (prévoir quelques années de marge).
 */
export function previewDelay(
  tasks: PlanningTaskInput[],
  taskId: string,
  delayDays: number,
  projectStart: string,
  calendar: WorkCalendar,
): DelayPreview {
  if (!Number.isInteger(delayDays) || delayDays < 1 || delayDays > MAX_DELAY_DAYS) {
    throw new PlanningError(`Le retard doit être un nombre entier de jours ouvrés entre 1 et ${MAX_DELAY_DAYS}.`)
  }
  const target = tasks.find((task) => task.id === taskId)
  if (!target) throw new PlanningError('Tâche introuvable pour ce signalement de retard.')
  if (target.duration === 0) {
    throw new PlanningError('Un jalon (durée 0) ne peut pas être retardé : retardez la tâche qui le précède.')
  }

  const before = scheduleProject(tasks, projectStart, calendar)
  const delayedTasks = tasks.map((task) => (
    task.id === taskId ? { ...task, duration: task.duration + delayDays } : task
  ))
  const after = scheduleProject(delayedTasks, projectStart, calendar)

  const beforeById = new Map<string, ScheduledTask>(before.tasks.map((task) => [task.id, task]))
  const changes: TaskDateChange[] = []
  const becameCritical: string[] = []
  const noLongerCritical: string[] = []

  for (const task of after.tasks) {
    const old = beforeById.get(task.id)
    if (!old) continue
    if (!old.isCritical && task.isCritical) becameCritical.push(task.id)
    if (old.isCritical && !task.isCritical) noLongerCritical.push(task.id)
    if (old.earlyStart === task.earlyStart && old.earlyFinish === task.earlyFinish) continue
    changes.push({
      id: task.id,
      name: task.name,
      before: { start: old.earlyStart, finish: old.earlyFinish },
      after: { start: task.earlyStart, finish: task.earlyFinish },
      finishShiftWorkingDays: workingDaysBetween(old.earlyFinish, task.earlyFinish, calendar),
    })
  }

  changes.sort((x, y) => x.after.start.localeCompare(y.after.start) || x.name.localeCompare(y.name, 'fr'))

  return {
    taskId,
    delayDays,
    changes,
    becameCritical,
    noLongerCritical,
    projectFinishBefore: before.projectFinish,
    projectFinishAfter: after.projectFinish,
    projectShiftWorkingDays: workingDaysBetween(before.projectFinish, after.projectFinish, calendar),
  }
}
