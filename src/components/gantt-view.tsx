'use client'

import { useId, useMemo, useState } from 'react'
import { calendarForRange } from '../lib/gantt-planning/french-calendar'
import { parseDate, shiftCalendarDays } from '../lib/gantt-planning/date-utils'
import { dateRange, dependencyPath, taskGeometry } from '../lib/gantt-planning/gantt-layout'
import type { PlanningResult, ScheduledTask } from '../lib/gantt-planning/types'
import styles from './gantt-view.module.css'

export interface GanttTaskMeta {
  id: string
  statut?: string
  avancement?: number
  responsable?: string | null
}

interface Props {
  planning: PlanningResult
  projectStart: string
  projectName: string
  metadata?: GanttTaskMeta[]
}

const dateLabel = (value: string) => new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
}).format(parseDate(value))
const monthLabel = (value: string) => new Intl.DateTimeFormat('fr-FR', {
  month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(parseDate(value))

function groupMonths(dates: string[]) {
  const groups: { key: string; label: string; count: number }[] = []
  for (const date of dates) {
    const key = date.slice(0, 7)
    if (groups.at(-1)?.key === key) groups[groups.length - 1].count++
    else groups.push({ key, label: monthLabel(date), count: 1 })
  }
  return groups
}

function accessibleTaskLabel(task: ScheduledTask) {
  return `${task.name}, ${task.duration === 0 ? 'jalon' : `${task.duration} jours ouvrés`}, du ${dateLabel(task.earlyStart)} au ${dateLabel(task.earlyFinish)}, ${task.isCritical ? 'critique' : `marge ${task.totalFloat} jours ouvrés`}`
}

export function GanttView({ planning, projectStart, projectName, metadata = [] }: Props) {
  const [zoom, setZoom] = useState<'week' | 'month'>('week')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const dayWidth = zoom === 'week' ? 48 : 22
  const padding = 24
  const calendar = useMemo(() => calendarForRange(projectStart, 0), [projectStart])
  const start = planning.tasks.reduce((min, task) => task.earlyStart < min ? task.earlyStart : min, projectStart)
  const finish = planning.tasks.reduce((max, task) => task.earlyFinish > max ? task.earlyFinish : max, planning.projectFinish)
  const dates = dateRange(start, shiftCalendarDays(finish < start ? start : finish, 2))
  const width = dates.length * dayWidth + padding * 2
  const height = Math.max(1, planning.tasks.length) * 64
  const months = groupMonths(dates)
  const geometry = new Map(planning.tasks.map((task, index) => {
    const value = taskGeometry(task, start, dayWidth, index)
    return [task.id, { ...value, left: value.left + padding, right: value.right + padding }]
  }))
  const taskById = new Map(planning.tasks.map((task) => [task.id, task]))
  const criticalEdges = new Set(planning.criticalDependencies.map((edge) => `${edge.predecessorId}:${edge.taskId}`))
  const dependencies = planning.tasks.flatMap((task) => task.predecessorIds.map((predecessorId) => ({ taskId: task.id, predecessorId })))
    .sort((a, b) => Number(criticalEdges.has(`${a.predecessorId}:${a.taskId}`)) - Number(criticalEdges.has(`${b.predecessorId}:${b.taskId}`)))
  const metaById = new Map(metadata.map((item) => [item.id, item]))
  const selected = taskById.get(selectedId ?? '')
  const selectedMeta = selected ? metaById.get(selected.id) : undefined

  if (!planning.tasks.length) return <section className={styles.empty}>
    <h2>Le planning prend forme ici</h2><p>Ajoutez une tâche dans l’onglet Tâches pour afficher votre Gantt.</p>
  </section>

  return <section className={styles.root} aria-label={`Planning Gantt — ${projectName}`}>
    <header className={styles.toolbar}>
      <div><h2>Planning du chantier</h2><p>{planning.projectDuration} jours ouvrés · Fin prévue : <strong>{dateLabel(planning.projectFinish)}</strong></p></div>
      <div className={styles.zoom} role="group" aria-label="Échelle du planning">
        <button type="button" aria-pressed={zoom === 'week'} onClick={() => setZoom('week')}>Semaine</button>
        <button type="button" aria-pressed={zoom === 'month'} onClick={() => setZoom('month')}>Mois</button>
      </div>
    </header>
    <ul className={styles.legend} aria-label="Légende">
      <li><span className={styles.swatchCritical}/>Critique (marge 0)</li>
      <li><span className={styles.swatchNormal}/>Autre tâche</li>
      <li><span className={styles.swatchMilestone}/>Jalon (0 j)</li>
      <li><span className={styles.swatchOff}/>Jour non ouvré</li>
    </ul>
    <p className={styles.hint}>Faites glisser horizontalement le planning. Touchez une tâche pour afficher ses détails.</p>
    <div className={styles.scroller} tabIndex={0} aria-label="Planning défilant horizontalement">
      <div className={styles.sheet} style={{ width: `calc(var(--gantt-label-width) + ${width}px)` }}>
        <div className={styles.corner} style={{ height: 72 }}>Tâches / jours ouvrés</div>
        <div className={styles.axis} style={{ width }} aria-hidden="true">
          <div className={styles.months} style={{ paddingInline: padding }}>
            {months.map((month) => <div key={month.key} style={{ width: month.count * dayWidth }}>{month.label}</div>)}
          </div>
          <div className={styles.days} style={{ paddingInline: padding }}>
            {dates.map((date) => {
              const working = calendar.isWorkingDay(date)
              return <div key={date} className={!working ? styles.offDay : undefined} style={{ width: dayWidth }} title={`${dateLabel(date)}${working ? '' : ' — non ouvré'}`}>
                {zoom === 'week' && <span>{new Intl.DateTimeFormat('fr-FR', { weekday: 'narrow', timeZone: 'UTC' }).format(parseDate(date))}</span>}
                <strong>{parseDate(date).getUTCDate()}</strong>
              </div>
            })}
          </div>
        </div>
        <div className={styles.labels}>
          {planning.tasks.map((task) => <button key={task.id} type="button" className={`${styles.label} ${selectedId === task.id ? styles.labelSelected : ''}`}
            aria-label={accessibleTaskLabel(task)} aria-pressed={selectedId === task.id} onClick={() => setSelectedId(task.id)}>
            <strong>{task.name}</strong><span>{task.duration === 0 ? 'Jalon · 0 j' : `${task.duration} j ouvrés`}{task.isCritical ? ' · Critique' : ` · Marge ${task.totalFloat} j`}</span>
          </button>)}
        </div>
        <div className={styles.timeline} style={{ width, height }}>
          <div className={styles.columns} style={{ left: padding }} aria-hidden="true">
            {dates.map((date) => <div key={date} className={!calendar.isWorkingDay(date) ? styles.offColumn : undefined} style={{ width: dayWidth, height }}/>) }
          </div>
          {planning.tasks.map((task) => {
            const item = geometry.get(task.id)!
            const meta = metaById.get(task.id)
            const progress = Math.max(0, Math.min(100, meta?.avancement ?? 0))
            return <div key={task.id} className={styles.row} style={{ top: item.centerY - 32 }}>
              <button type="button" data-task-id={task.id} data-critical={task.isCritical} data-milestone={item.milestone}
                className={`${styles.taskHit} ${item.milestone ? styles.milestoneHit : ''}`}
                style={{ left: item.milestone ? item.left - 22 : item.left - Math.max(0, (44 - (item.right - item.left)) / 2), width: item.milestone ? 44 : Math.max(44, item.right - item.left) }}
                aria-label={accessibleTaskLabel(task)} aria-pressed={selectedId === task.id}
                onClick={() => setSelectedId(task.id)}>
                {item.milestone ? <span className={`${styles.diamond} ${task.isCritical ? styles.criticalDiamond : ''}`}/>
                  : <span className={`${styles.bar} ${task.isCritical ? styles.criticalBar : ''}`} style={{ width: item.right - item.left }}><span className={styles.progress} style={{ width: `${progress}%` }}/><span className={styles.barText}>{task.name}{zoom === 'week' && ` · ${task.duration} j`}</span></span>}
              </button>
            </div>
          })}
          <svg className={styles.links} width={width} height={height} aria-hidden="true">
            <defs>
              <marker id={`${id}-normal`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L7 3.5L0 7Z" fill="#526879"/></marker>
              <marker id={`${id}-critical`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L7 3.5L0 7Z" fill="#b4232f"/></marker>
            </defs>
            {dependencies.map(({ taskId, predecessorId }) => {
              const from = geometry.get(predecessorId)
              const to = geometry.get(taskId)
              if (!from || !to) return null
              const critical = criticalEdges.has(`${predecessorId}:${taskId}`)
              return <path key={`${predecessorId}:${taskId}`} data-dependency={`${predecessorId}:${taskId}`} data-critical={critical}
                d={dependencyPath(from, to, width)} fill="none" stroke={critical ? '#b4232f' : '#526879'}
                strokeWidth={critical ? 2.5 : 1.5} strokeLinejoin="round" markerEnd={`url(#${id}-${critical ? 'critical' : 'normal'})`}/>
            })}
          </svg>
        </div>
      </div>
    </div>
    <section className={styles.details} aria-live="polite" aria-atomic="true">
      {selected ? <>
        <div className={styles.detailHeading}><h3>{selected.name}</h3><span className={selected.isCritical ? styles.criticalBadge : styles.badge}>{selected.isCritical ? 'Chemin critique' : `Marge : ${selected.totalFloat} j ouvrés`}</span></div>
        <dl className={styles.facts}>
          <div><dt>Début au plus tôt</dt><dd>{dateLabel(selected.earlyStart)}</dd></div>
          <div><dt>Fin au plus tôt</dt><dd>{dateLabel(selected.earlyFinish)}</dd></div>
          <div><dt>Début au plus tard</dt><dd>{dateLabel(selected.lateStart)}</dd></div>
          <div><dt>Fin au plus tard</dt><dd>{dateLabel(selected.lateFinish)}</dd></div>
          <div><dt>Durée</dt><dd>{selected.duration} j ouvrés{selected.duration === 0 ? ' (jalon)' : ''}</dd></div>
          <div><dt>Prédécesseurs</dt><dd>{selected.predecessorIds.map((pred) => taskById.get(pred)?.name).join(', ') || 'Aucun'}</dd></div>
          <div><dt>Responsable</dt><dd>{selectedMeta?.responsable || 'Non assigné'}</dd></div>
          <div><dt>Avancement</dt><dd>{selectedMeta?.avancement ?? 0}%</dd></div>
        </dl>
        {selected.duration === 0 && <p className={styles.hint}>Jalon à la borne de fin du jour indiqué (ou au début du chantier s’il est initial). Il ne consomme aucun jour ouvré.</p>}
      </> : <p>Sélectionnez une barre, un jalon ou le nom d’une tâche pour consulter ses dates et sa marge.</p>}
    </section>
  </section>
}
