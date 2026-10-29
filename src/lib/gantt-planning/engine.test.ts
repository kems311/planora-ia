import { describe, expect, it } from 'vitest'
import { scheduleProject, wouldCreateCycle } from './engine'
import { FrenchWorkCalendar } from './french-calendar'
import { verificationTasks } from './verification-case'
import { parseDate, shiftCalendarDays } from './date-utils'
import { dateRange, taskGeometry } from './gantt-layout'
import type { PlanningTaskInput } from './types'

const calendar = new FrenchWorkCalendar()
const start = '2026-10-26'
const run = (tasks: PlanningTaskInput[] = verificationTasks, from = start) => scheduleProject(tasks, from, calendar)

describe('CPM — cas demandé A-B-D / A-C-D', () => {
  it('calcule une durée de 6 j, A-B-D critiques et C avec 2 j de marge', () => {
    const result = run()
    expect(result.projectDuration).toBe(6)
    expect(result.projectFinish).toBe('2026-11-02')
    expect(result.tasks.map((t) => [t.id, t.earlyStartOffset, t.earlyFinishOffset, t.lateStartOffset, t.lateFinishOffset, t.totalFloat, t.isCritical])).toEqual([
      ['A', 0, 2, 0, 2, 0, true],
      ['B', 2, 5, 2, 5, 0, true],
      ['C', 2, 3, 4, 5, 2, false],
      ['D', 5, 6, 5, 6, 0, true],
    ])
    expect(result.criticalDependencies).toEqual([
      { predecessorId: 'A', taskId: 'B' },
      { predecessorId: 'B', taskId: 'D' },
    ])
  })
  it('attend les DEUX prédécesseurs de D, pas seulement C', () => {
    const d = run().tasks.find((t) => t.id === 'D')!
    expect(d.earlyStart).toBe('2026-11-02')
    expect(d.predecessorIds).toEqual(['B', 'C'])
  })
  it('respecte les dates inclusives affichées', () => {
    expect(run().tasks.map((t) => [t.id, t.earlyStart, t.earlyFinish, t.lateStart, t.lateFinish])).toEqual([
      ['A', '2026-10-26', '2026-10-27', '2026-10-26', '2026-10-27'],
      ['B', '2026-10-28', '2026-10-30', '2026-10-28', '2026-10-30'],
      ['C', '2026-10-28', '2026-10-28', '2026-10-30', '2026-10-30'],
      ['D', '2026-11-02', '2026-11-02', '2026-11-02', '2026-11-02'],
    ])
  })
  it('ne dépend pas de l’ordre des tâches', () => {
    expect(run([...verificationTasks].reverse())).toEqual(run())
  })
  it('ne mute jamais les entrées', () => {
    const snapshot = JSON.stringify(verificationTasks)
    run()
    expect(JSON.stringify(verificationTasks)).toBe(snapshot)
  })
  it('recalcule C critique si C dure 4 jours', () => {
    const result = run(verificationTasks.map((t) => t.id === 'C' ? { ...t, duration: 4 } : t))
    expect(result.projectDuration).toBe(7)
    expect(result.tasks.filter((t) => t.isCritical).map((t) => t.id)).toEqual(['A', 'C', 'D'])
    expect(result.tasks.find((t) => t.id === 'B')!.totalFloat).toBe(1)
  })
  it('accepte plusieurs chemins critiques lorsque B et C durent 3 jours', () => {
    const result = run(verificationTasks.map((t) => t.id === 'C' ? { ...t, duration: 3 } : t))
    expect(result.tasks.every((t) => t.isCritical)).toBe(true)
    expect(result.criticalDependencies).toHaveLength(4)
  })
})

describe('Jalons à durée nulle', () => {
  it('un jalon terminal n’ajoute aucune journée au projet', () => {
    const result = run([...verificationTasks, { id: 'M', name: 'Réception', duration: 0, predecessorIds: ['D'] }])
    const m = result.tasks.find((t) => t.id === 'M')!
    expect(result.projectDuration).toBe(6)
    expect(result.projectFinish).toBe('2026-11-02')
    expect([m.earlyStartOffset, m.earlyFinishOffset, m.earlyStart, m.earlyFinish, m.totalFloat]).toEqual([6, 6, '2026-11-02', '2026-11-02', 0])
  })
  it('un jalon initial ne retarde pas la première tâche', () => {
    const result = run([
      { id: 'M', name: 'Départ', duration: 0, predecessorIds: [] },
      { id: 'A', name: 'A', duration: 1, predecessorIds: ['M'] },
    ])
    expect(result.projectDuration).toBe(1)
    expect(result.tasks.map((t) => t.earlyStart)).toEqual([start, start])
  })
  it('un jalon intermédiaire ne crée pas de jour fantôme', () => {
    const result = run([
      { id: 'A', name: 'A', duration: 2, predecessorIds: [] },
      { id: 'M', name: 'Validation', duration: 0, predecessorIds: ['A'] },
      { id: 'B', name: 'B', duration: 3, predecessorIds: ['M'] },
    ])
    expect(result.projectDuration).toBe(5)
    expect(result.tasks.find((t) => t.id === 'B')!.earlyStart).toBe('2026-10-28')
    const milestone = result.tasks.find((t) => t.id === 'M')!
    const a = result.tasks.find((t) => t.id === 'A')!
    expect(taskGeometry(milestone, start, 48, 1).left).toBe(taskGeometry(a, start, 48, 0).right)
  })
  it('des jalons seuls ont une durée totale nulle', () => {
    const result = run([{ id: 'M', name: 'M', duration: 0, predecessorIds: [] }])
    expect(result.projectDuration).toBe(0)
    expect(result.projectFinish).toBe(start)
    expect(taskGeometry(result.tasks[0], start, 48, 0).left).toBe(0)
  })
})

describe('Calendrier et validation du graphe', () => {
  it('exclut le 11 novembre et le week-end', () => {
    const result = run([{ id: 'A', name: 'A', duration: 4, predecessorIds: [] }], '2026-11-10')
    expect(result.projectFinish).toBe('2026-11-16')
  })
  it('normalise un démarrage samedi au lundi ouvré', () => {
    expect(run([{ id: 'A', name: 'A', duration: 1, predecessorIds: [] }], '2026-10-31').tasks[0].earlyStart).toBe('2026-11-02')
  })
  it('charge les jours fériés des années suivantes à la demande', () => {
    const result = run([{ id: 'A', name: 'A', duration: 2, predecessorIds: [] }], '2026-12-31')
    expect(result.projectFinish).toBe('2027-01-04')
  })
  it('reconnaît les 11 jours fériés nationaux 2026 (référence calendrier.api.gouv.fr)', () => {
    const holidays = ['2026-01-01','2026-04-06','2026-05-01','2026-05-08','2026-05-14','2026-05-25','2026-07-14','2026-08-15','2026-11-01','2026-11-11','2026-12-25']
    expect(holidays.every((date) => !calendar.isWorkingDay(date))).toBe(true)
    expect(calendar.isWorkingDay('2026-04-07')).toBe(true)
    expect(calendar.isWorkingDay('2027-03-29')).toBe(false)
  })
  it('refuse les cycles', () => {
    const tasks = verificationTasks.map((t) => t.id === 'A' ? { ...t, predecessorIds: ['D'] } : t)
    expect(() => run(tasks)).toThrow(/boucle/)
    expect(wouldCreateCycle(tasks)).toBe(true)
    expect(wouldCreateCycle(verificationTasks)).toBe(false)
  })
  it('refuse l’auto-dépendance', () => {
    expect(() => run([{ id: 'A', name: 'A', duration: 1, predecessorIds: ['A'] }])).toThrow(/boucle/)
  })
  it('refuse les prédécesseurs manquants et identifiants dupliqués', () => {
    expect(() => run([{ id: 'A', name: 'A', duration: 1, predecessorIds: ['inconnu'] }])).toThrow(/inconnu/)
    expect(() => run([verificationTasks[0], verificationTasks[0]])).toThrow(/uniques/)
  })
  it.each([-1, 1.5, NaN, Infinity])('refuse une durée invalide %s', (duration) => {
    expect(() => run([{ id: 'A', name: 'A', duration, predecessorIds: [] }])).toThrow(/Durée/)
  })
  it('ne compte pas deux fois une dépendance dupliquée', () => {
    const tasks = verificationTasks.map((t) => t.id === 'B' ? { ...t, predecessorIds: ['A', 'A'] } : t)
    expect(run(tasks)).toEqual(run())
  })
  it('retourne un planning vide cohérent', () => {
    expect(run([]).projectDuration).toBe(0)
    expect(run([]).tasks).toEqual([])
  })
  it('ne modifie pas les dates à cause du fuseau horaire', () => {
    expect(parseDate('2026-10-26').toISOString()).toBe('2026-10-26T00:00:00.000Z')
    expect(shiftCalendarDays('2026-10-25', 1)).toBe('2026-10-26')
  })
  it('refuse les dates invalides', () => {
    expect(() => run([], '2026-02-30')).toThrow(/Date invalide/)
  })
  it('conserve les jours non ouvrés sur l’axe visuel', () => {
    const dates = dateRange('2026-10-30', '2026-11-02')
    expect(dates).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  })
})

describe('Réseaux de dépendances complémentaires', () => {
  it('ne colore pas une liaison non tendue entre deux tâches pourtant critiques', () => {
    const result = run([
      { id: 'A', name: 'A', duration: 2, predecessorIds: [] },
      { id: 'B', name: 'B', duration: 2, predecessorIds: ['A'] },
      { id: 'D', name: 'D', duration: 1, predecessorIds: ['A', 'B'] },
    ])
    expect(result.tasks.every((task) => task.isCritical)).toBe(true)
    expect(result.criticalDependencies).toEqual([
      { predecessorId: 'A', taskId: 'B' },
      { predecessorId: 'B', taskId: 'D' },
    ])
  })
  it('donne de la marge aux branches terminales plus courtes', () => {
    const result = run([
      { id: 'A', name: 'A', duration: 5, predecessorIds: [] },
      { id: 'B', name: 'B', duration: 2, predecessorIds: [] },
    ])
    expect(result.projectDuration).toBe(5)
    expect(result.tasks.find((task) => task.id === 'B')!.totalFloat).toBe(3)
  })
})
