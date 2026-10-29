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
}

export interface PlanningResult {
  tasks: ScheduledTask[]
  projectFinish: string
  topologicalOrder: string[]
}

export interface WorkCalendar {
  isWorkingDay(date: string): boolean
}
