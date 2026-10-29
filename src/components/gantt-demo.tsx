'use client'

import { useMemo, useState } from 'react'
import { GanttView } from './gantt-view'
import { scheduleProject } from '../lib/gantt-planning/engine'
import { calendarForRange } from '../lib/gantt-planning/french-calendar'
import { verificationTasks } from '../lib/gantt-planning/verification-case'
import styles from './gantt-demo.module.css'

export function GanttDemo() {
  const [projectStart, setProjectStart] = useState('2026-10-26')
  const [milestone, setMilestone] = useState(false)
  const [cDuration, setCDuration] = useState(1)
  const planning = useMemo(() => {
    const tasks = verificationTasks.map((task) => task.id === 'C' ? { ...task, duration: cDuration } : task)
    if (milestone) tasks.push({ id: 'M', name: 'Réception', duration: 0, predecessorIds: ['D'] })
    return scheduleProject(tasks, projectStart, calendarForRange(projectStart, 0))
  }, [projectStart, milestone, cDuration])
  const criticalNames = planning.tasks.filter((task) => task.isCritical).map((task) => task.name)
  return <main className={styles.page} id="contenu">
    <header className={styles.header}>
      <div className={styles.brand}><svg aria-label="Logo Planora-IA" role="img" viewBox="0 0 32 32" width="32" height="32" fill="none"><path d="M5 6h22v21H5zM5 12h22M11 3v6M21 3v6M10 18h7M16 23h7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg><span>Planora-IA</span></div>
      <span className={styles.version}>Lot 2 · Vérification Gantt</span>
    </header>
    <div className={styles.intro}><span className={styles.eyebrow}>PLANNING DE CHANTIER</span><h1>Le chemin critique, en clair.</h1><p>Cas de vérification : A (2 j) → B (3 j) → D (1 j), et A → C (1 j) → D. Ce jeu d’essai n’est pas enregistré dans Supabase.</p></div>
    <section className={styles.controls} aria-label="Paramètres de vérification">
      <label>Date de début<input type="date" value={projectStart} min="2000-01-01" max="2090-12-31" onChange={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setProjectStart(e.target.value) }}/></label>
      <label>Durée de C (jours ouvrés)<select value={cDuration} onChange={(e) => setCDuration(Number(e.target.value))}><option value={1}>1 jour (cas demandé)</option><option value={3}>3 jours (deux chemins critiques)</option><option value={4}>4 jours (C devient critique)</option></select></label>
      <label className={styles.check}><input type="checkbox" checked={milestone} onChange={(e) => setMilestone(e.target.checked)}/>Ajouter un jalon Réception après D</label>
    </section>
    <section className={styles.result} aria-live="polite"><div><span>Durée calculée</span><strong>{planning.projectDuration} jours ouvrés</strong></div><div><span>Tâches critiques (ordre topologique)</span><strong>{criticalNames.join(' · ')}</strong></div><p>{cDuration === 1 ? 'Vérification attendue : A-B-D ; marge de C = 2 jours ouvrés.' : 'Les durées et le chemin critique sont recalculés immédiatement.'}</p></section>
    <GanttView planning={planning} projectStart={projectStart} projectName="Vérification A-B-D"/>
    <section className={styles.calculation}><h2>Calcul vérifiable</h2><p>Les bornes ci-dessous sont des indices de jours ouvrés à partir de 0, avec fin exclusive. Une tâche de 2 jours occupe l’intervalle [0, 2).</p><div className={styles.tableScroll}><table><thead><tr><th>Tâche</th><th>Durée</th><th>Début tôt</th><th>Fin tôt</th><th>Début tard</th><th>Fin tard</th><th>Marge</th><th>Critique</th></tr></thead><tbody>{planning.tasks.map((task) => <tr key={task.id}><th>{task.name}</th><td>{task.duration}</td><td>{task.earlyStartOffset}</td><td>{task.earlyFinishOffset}</td><td>{task.lateStartOffset}</td><td>{task.lateFinishOffset}</td><td>{task.totalFloat}</td><td>{task.isCritical ? 'Oui' : 'Non'}</td></tr>)}</tbody></table></div></section>
    <footer className={styles.footer}>Calendrier métropolitain national · Week-ends et jours fériés exclus · Pas de glisser-déposer ni d’écriture en base dans cette vue</footer>
  </main>
}
