export interface PlanningTaskInput {
  id: string
  name: string
  duration: number
  predecessorIds: string[]
}

export interface ScheduledTask extends PlanningTaskInput {
  earlyStart: string
  earlyFinish: string
  lateStart: string
  lateFinish: string
  totalFloat: number
  isCritical: boolean
  /** Bornes en jours ouvrés : [début, fin), donc fin - début = durée. */
  earlyStartOffset: number
  earlyFinishOffset: number
  lateStartOffset: number
  lateFinishOffset: number
}

export interface CriticalDependency {
  predecessorId: string
  taskId: string
}

export interface PlanningResult {
  tasks: ScheduledTask[]
  projectFinish: string
  projectDuration: number
  topologicalOrder: string[]
  criticalDependencies: CriticalDependency[]
}

export interface WorkCalendar {
  isWorkingDay(date: string): boolean
}
