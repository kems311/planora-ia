import { describe, expect, it } from 'vitest'
import { scheduleProject, PlanningError } from './engine'
import type { WorkCalendar } from './types'

const weekdays: WorkCalendar = {
  isWorkingDay(value) {
    const day = new Date(`${value}T00:00:00Z`).getUTCDay()
    return day !== 0 && day !== 6
  },
}

describe('moteur de planning', () => {
  it('calcule les dates fin-début en excluant le week-end', () => {
    const result = scheduleProject([
      { id: 'a', name: 'A', duration: 2, predecessorIds: [] },
      { id: 'b', name: 'B', duration: 1, predecessorIds: ['a'] },
    ], '2026-10-23', weekdays)
    expect(result.tasks[0].earlyFinish).toBe('2026-10-26')
    expect(result.tasks[1].earlyStart).toBe('2026-10-27')
    expect(result.projectFinish).toBe('2026-10-27')
  })

  it('identifie le chemin critique et la marge', () => {
    const result = scheduleProject([
      { id: 'a', name: 'Longue', duration: 4, predecessorIds: [] },
      { id: 'b', name: 'Courte', duration: 2, predecessorIds: [] },
      { id: 'c', name: 'Fin', duration: 1, predecessorIds: ['a', 'b'] },
    ], '2026-10-26', weekdays)
    expect(result.tasks.find((task) => task.id === 'a')?.isCritical).toBe(true)
    expect(result.tasks.find((task) => task.id === 'b')?.totalFloat).toBe(2)
  })

  it('accepte un jalon de durée zéro', () => {
    const result = scheduleProject([
      { id: 'm', name: 'Jalon', duration: 0, predecessorIds: [] },
    ], '2026-10-26', weekdays)
    expect(result.tasks[0].earlyFinish).toBe('2026-10-26')
  })

  it('refuse les dépendances circulaires', () => {
    expect(() => scheduleProject([
      { id: 'a', name: 'A', duration: 1, predecessorIds: ['b'] },
      { id: 'b', name: 'B', duration: 1, predecessorIds: ['a'] },
    ], '2026-10-26', weekdays)).toThrow(PlanningError)
  })
})
