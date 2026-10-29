import type { PlanningTaskInput } from './types'

/** Cas fourni par l'utilisateur ; aucune donnée de chantier réelle. */
export const verificationTasks: PlanningTaskInput[] = [
  { id: 'A', name: 'A', duration: 2, predecessorIds: [] },
  { id: 'B', name: 'B', duration: 3, predecessorIds: ['A'] },
  { id: 'C', name: 'C', duration: 1, predecessorIds: ['A'] },
  { id: 'D', name: 'D', duration: 1, predecessorIds: ['B', 'C'] },
]
