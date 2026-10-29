import {
  addWorkingDays,
  nextWorkingDay,
  previousWorkingDay,
  shiftCalendarDays,
  workingDaysBetween,
} from './date-utils'
import type { PlanningResult, PlanningTaskInput, ScheduledTask, WorkCalendar } from './types'

export class PlanningError extends Error {}

function topologicalSort(tasks: PlanningTaskInput[]): string[] {
  const ids = new Set(tasks.map((task) => task.id))
  if (ids.size !== tasks.length) throw new PlanningError('Les identifiants de tâches doivent être uniques.')

  const inDegree = new Map(tasks.map((task) => [task.id, 0]))
  const successors = new Map(tasks.map((task) => [task.id, [] as string[]]))

  for (const task of tasks) {
    if (!Number.isInteger(task.duration) || task.duration < 0) {
      throw new PlanningError(`Durée invalide pour « ${task.name} ».`)
    }
    for (const predecessorId of new Set(task.predecessorIds)) {
      if (!ids.has(predecessorId)) throw new PlanningError(`Prédécesseur inconnu pour « ${task.name} ».`)
      if (predecessorId === task.id) throw new PlanningError('Une tâche ne peut pas dépendre d’elle-même.')
      inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1)
      successors.get(predecessorId)?.push(task.id)
    }
  }

  const queue = [...tasks.filter((task) => inDegree.get(task.id) === 0).map((task) => task.id)].sort()
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const successorId of successors.get(id) ?? []) {
      const degree = (inDegree.get(successorId) ?? 0) - 1
      inDegree.set(successorId, degree)
      if (degree === 0) queue.push(successorId)
    }
    queue.sort()
  }

  if (order.length !== tasks.length) {
    throw new PlanningError('Dépendance refusée : elle créerait une boucle dans le planning.')
  }
  return order
}

export function scheduleProject(
  tasks: PlanningTaskInput[],
  projectStart: string,
  calendar: WorkCalendar,
): PlanningResult {
  if (!tasks.length) return { tasks: [], projectFinish: projectStart, topologicalOrder: [] }
  const order = topologicalSort(tasks)
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const early = new Map<string, { start: string; finish: string }>()
  const projectFirstDay = nextWorkingDay(projectStart, calendar)

  for (const id of order) {
    const task = byId.get(id)!
    let start = projectFirstDay
    for (const predecessorId of task.predecessorIds) {
      const predecessorFinish = early.get(predecessorId)!.finish
      const candidate = nextWorkingDay(shiftCalendarDays(predecessorFinish, 1), calendar)
      if (candidate > start) start = candidate
    }
    const finish = task.duration === 0 ? start : addWorkingDays(start, task.duration - 1, calendar)
    early.set(id, { start, finish })
  }

  const projectFinish = [...early.values()].reduce(
    (latest, item) => (item.finish > latest ? item.finish : latest),
    projectFirstDay,
  )
  const successors = new Map(tasks.map((task) => [task.id, [] as string[]]))
  for (const task of tasks) {
    for (const predecessorId of task.predecessorIds) successors.get(predecessorId)!.push(task.id)
  }

  const late = new Map<string, { start: string; finish: string }>()
  for (const id of [...order].reverse()) {
    const task = byId.get(id)!
    const children = successors.get(id) ?? []
    let finish = projectFinish
    if (children.length) {
      finish = children
        .map((childId) => previousWorkingDay(shiftCalendarDays(late.get(childId)!.start, -1), calendar))
        .reduce((earliest, value) => (value < earliest ? value : earliest))
    }
    const start = task.duration === 0 ? finish : addWorkingDays(finish, -(task.duration - 1), calendar)
    late.set(id, { start, finish })
  }

  const scheduled: ScheduledTask[] = order.map((id) => {
    const task = byId.get(id)!
    const totalFloat = workingDaysBetween(early.get(id)!.start, late.get(id)!.start, calendar)
    return {
      ...task,
      earlyStart: early.get(id)!.start,
      earlyFinish: early.get(id)!.finish,
      lateStart: late.get(id)!.start,
      lateFinish: late.get(id)!.finish,
      totalFloat,
      isCritical: totalFloat === 0,
    }
  })

  return { tasks: scheduled, projectFinish, topologicalOrder: order }
}

export function wouldCreateCycle(tasks: PlanningTaskInput[]): boolean {
  try {
    topologicalSort(tasks)
    return false
  } catch (error) {
    return error instanceof PlanningError && error.message.includes('boucle')
  }
}
