import { addWorkingDays, nextWorkingDay, parseDate } from './date-utils'
import type { PlanningResult, PlanningTaskInput, ScheduledTask, WorkCalendar } from './types'

export class PlanningError extends Error {}

function topologicalSort(tasks: PlanningTaskInput[]): string[] {
  const ids = new Set(tasks.map((task) => task.id))
  if (ids.size !== tasks.length) throw new PlanningError('Les identifiants de tâches doivent être uniques.')
  const degree = new Map(tasks.map((task) => [task.id, 0]))
  const successors = new Map(tasks.map((task) => [task.id, [] as string[]]))
  for (const task of tasks) {
    if (!Number.isSafeInteger(task.duration) || task.duration < 0) {
      throw new PlanningError(`Durée invalide pour « ${task.name} ».`)
    }
    for (const predecessor of new Set(task.predecessorIds)) {
      if (!ids.has(predecessor)) throw new PlanningError(`Prédécesseur inconnu pour « ${task.name} ».`)
      if (predecessor === task.id) throw new PlanningError('Une tâche ne peut pas dépendre d’elle-même (boucle).')
      degree.set(task.id, degree.get(task.id)! + 1)
      successors.get(predecessor)!.push(task.id)
    }
  }
  const queue = tasks.filter((task) => degree.get(task.id) === 0).map((task) => task.id).sort()
  const order: string[] = []
  let cursor = 0
  while (cursor < queue.length) {
    const id = queue[cursor++]
    order.push(id)
    for (const successor of [...successors.get(id)!].sort()) {
      degree.set(successor, degree.get(successor)! - 1)
      if (degree.get(successor) === 0) queue.push(successor)
    }
  }
  if (order.length !== tasks.length) throw new PlanningError('Dépendance refusée : elle créerait une boucle dans le planning.')
  return order
}

export function scheduleProject(tasks: PlanningTaskInput[], projectStart: string, calendar: WorkCalendar): PlanningResult {
  parseDate(projectStart)
  const order = topologicalSort(tasks)
  if (!tasks.length) return {
    tasks: [], projectFinish: projectStart, projectDuration: 0,
    topologicalOrder: [], criticalDependencies: [],
  }
  const normalized = tasks.map((task) => ({ ...task, predecessorIds: [...new Set(task.predecessorIds)] }))
  const byId = new Map(normalized.map((task) => [task.id, task]))
  const successors = new Map(tasks.map((task) => [task.id, [] as string[]]))
  for (const task of normalized) {
    for (const pred of task.predecessorIds) successors.get(pred)!.push(task.id)
  }

  // CPM sur des intervalles [début, fin) : les jalons n'ajoutent aucune durée.
  const early = new Map<string, { start: number; finish: number }>()
  for (const id of order) {
    const task = byId.get(id)!
    const start = task.predecessorIds.reduce((max, pred) => Math.max(max, early.get(pred)!.finish), 0)
    const finish = start + task.duration
    if (!Number.isSafeInteger(finish) || finish > 100_000) throw new PlanningError('Planning trop long : maximum 100 000 jours ouvrés.')
    early.set(id, { start, finish })
  }
  const projectDuration = Math.max(...[...early.values()].map((item) => item.finish))
  const late = new Map<string, { start: number; finish: number }>()
  for (const id of [...order].reverse()) {
    const children = successors.get(id)!
    const finish = children.length
      ? Math.min(...children.map((child) => late.get(child)!.start))
      : projectDuration
    late.set(id, { start: finish - byId.get(id)!.duration, finish })
  }

  const firstDay = nextWorkingDay(projectStart, calendar)
  const dateCache = new Map<number, string>([[0, firstDay]])
  let lastOffset = 0
  let lastDate = firstDay
  const atOffset = (offset: number): string => {
    while (lastOffset < offset) {
      lastDate = addWorkingDays(lastDate, 1, calendar)
      dateCache.set(++lastOffset, lastDate)
    }
    return dateCache.get(offset)!
  }
  atOffset(Math.max(0, projectDuration - 1))
  const scheduled: ScheduledTask[] = order.map((id) => {
    const task = byId.get(id)!
    const e = early.get(id)!
    const l = late.get(id)!
    const totalFloat = l.start - e.start
    // Un jalon non initial est daté en fin du jour ouvré précédent sa borne.
    const earlyStart = atOffset(task.duration === 0 ? Math.max(0, e.start - 1) : e.start)
    const lateStart = atOffset(task.duration === 0 ? Math.max(0, l.start - 1) : l.start)
    return {
      ...task,
      earlyStart,
      earlyFinish: task.duration === 0 ? earlyStart : atOffset(e.finish - 1),
      lateStart,
      lateFinish: task.duration === 0 ? lateStart : atOffset(l.finish - 1),
      earlyStartOffset: e.start, earlyFinishOffset: e.finish,
      lateStartOffset: l.start, lateFinishOffset: l.finish,
      totalFloat, isCritical: totalFloat === 0,
    }
  })
  const scheduledById = new Map(scheduled.map((task) => [task.id, task]))
  const criticalDependencies = scheduled.flatMap((task) => task.predecessorIds.flatMap((predecessorId) => {
    const predecessor = scheduledById.get(predecessorId)!
    return task.isCritical && predecessor.isCritical && predecessor.earlyFinishOffset === task.earlyStartOffset
      ? [{ predecessorId, taskId: task.id }]
      : []
  }))
  return {
    tasks: scheduled,
    projectFinish: atOffset(Math.max(0, projectDuration - 1)),
    projectDuration, topologicalOrder: order, criticalDependencies,
  }
}

export function wouldCreateCycle(tasks: PlanningTaskInput[]): boolean {
  try { topologicalSort(tasks); return false }
  catch (error) { return error instanceof PlanningError && error.message.includes('boucle') }
}
