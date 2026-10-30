import { describe, expect, it } from 'vitest'
import { MAX_DELAY_DAYS, previewDelay } from './delay-preview'
import { PlanningError } from './engine'
import type { PlanningTaskInput, WorkCalendar } from './types'

const weekdays: WorkCalendar = {
  isWorkingDay(value) {
    const day = new Date(`${value}T00:00:00Z`).getUTCDay()
    return day !== 0 && day !== 6
  },
}

const START = '2026-10-26'

// A(2j) -> B(3j) -> D(1j) et A -> C(1j) -> D. Chemin critique : A-B-D, fin le 2 nov. 2026.
const tasks: PlanningTaskInput[] = [
  { id: 'a', name: 'A', duration: 2, predecessorIds: [] },
  { id: 'b', name: 'B', duration: 3, predecessorIds: ['a'] },
  { id: 'c', name: 'C', duration: 1, predecessorIds: ['a'] },
  { id: 'd', name: 'D', duration: 1, predecessorIds: ['b', 'c'] },
]

describe('aperçu avant/après d’un retard', () => {
  it('un retard sur une tâche avec marge ne décale pas la fin du chantier', () => {
    const preview = previewDelay(tasks, 'c', 1, START, weekdays)
    expect(preview.changes.map((change) => change.id)).toEqual(['c'])
    expect(preview.changes[0].before.finish).toBe('2026-10-28')
    expect(preview.changes[0].after.finish).toBe('2026-10-29')
    expect(preview.changes[0].finishShiftWorkingDays).toBe(1)
    expect(preview.projectFinishBefore).toBe('2026-11-02')
    expect(preview.projectFinishAfter).toBe('2026-11-02')
    expect(preview.projectShiftWorkingDays).toBe(0)
    expect(preview.becameCritical).toEqual([])
    expect(preview.noLongerCritical).toEqual([])
  })

  it('un retard sur le chemin critique décale B puis D et la fin du chantier', () => {
    const preview = previewDelay(tasks, 'b', 2, START, weekdays)
    expect(preview.changes.map((change) => change.id)).toEqual(['b', 'd'])
    expect(preview.changes[0].after.finish).toBe('2026-11-03')
    expect(preview.changes[1].before.start).toBe('2026-11-02')
    expect(preview.changes[1].after.start).toBe('2026-11-04')
    expect(preview.projectFinishAfter).toBe('2026-11-04')
    expect(preview.projectShiftWorkingDays).toBe(2)
  })

  it('un gros retard sur C fait passer le chemin critique de B à C', () => {
    const preview = previewDelay(tasks, 'c', 3, START, weekdays)
    expect(preview.changes.map((change) => change.id)).toEqual(['c', 'd'])
    expect(preview.changes[0].after.finish).toBe('2026-11-02')
    expect(preview.projectFinishAfter).toBe('2026-11-03')
    expect(preview.projectShiftWorkingDays).toBe(1)
    expect(preview.becameCritical).toEqual(['c'])
    expect(preview.noLongerCritical).toEqual(['b'])
  })

  it('ne modifie pas les tâches fournies', () => {
    const snapshot = JSON.parse(JSON.stringify(tasks))
    previewDelay(tasks, 'b', 2, START, weekdays)
    expect(tasks).toEqual(snapshot)
  })

  it('refuse les retards invalides', () => {
    expect(() => previewDelay(tasks, 'b', 0, START, weekdays)).toThrow(PlanningError)
    expect(() => previewDelay(tasks, 'b', -1, START, weekdays)).toThrow(PlanningError)
    expect(() => previewDelay(tasks, 'b', 1.5, START, weekdays)).toThrow(PlanningError)
    expect(() => previewDelay(tasks, 'b', MAX_DELAY_DAYS + 1, START, weekdays)).toThrow(PlanningError)
  })

  it('refuse une tâche inconnue et un jalon', () => {
    expect(() => previewDelay(tasks, 'x', 1, START, weekdays)).toThrow(PlanningError)
    const withMilestone: PlanningTaskInput[] = [
      ...tasks,
      { id: 'm', name: 'Réception', duration: 0, predecessorIds: ['d'] },
    ]
    expect(() => previewDelay(withMilestone, 'm', 1, START, weekdays)).toThrow(PlanningError)
  })
})
