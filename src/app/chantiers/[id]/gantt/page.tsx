import Link from 'next/link'
import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createGanttServerClient } from '@/lib/gantt-supabase/server'
import { scheduleProject, PlanningError } from '@/lib/gantt-planning/engine'
import { calendarForRange } from '@/lib/gantt-planning/french-calendar'
import { GanttView, type GanttTaskMeta } from '@/components/gantt-view'

interface TaskRow {
  id: string
  nom: string
  duree_jours: number
  responsable_id: string | null
  avancement: number
  statut: string
}

async function GanttContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound()
  const supabase = await createGanttServerClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims?.claims?.sub) redirect('/connexion')
  const { data: project, error: projectError } = await supabase.from('projects')
    .select('id,nom,date_debut').eq('id', id).maybeSingle()
  if (projectError) throw new Error('Impossible de charger le chantier. Réessayez dans quelques instants.')
  if (!project) notFound()
  const { data: rows, error: taskError } = await supabase.from('tasks')
    .select('id,nom,duree_jours,responsable_id,avancement,statut').eq('project_id', id).order('id')
  if (taskError) throw new Error('Impossible de charger les tâches du chantier.')
  const tasks = (rows ?? []) as TaskRow[]
  const ids = tasks.map((task) => task.id)
  const { data: deps, error: dependencyError } = ids.length
    ? await supabase.from('task_dependencies').select('task_id,predecessor_id').in('task_id', ids)
    : { data: [], error: null }
  if (dependencyError) throw new Error('Impossible de charger les dépendances du planning.')
  const metadata: GanttTaskMeta[] = tasks.map((task) => ({
    id: task.id, avancement: task.avancement, statut: task.statut,
    responsable: task.responsable_id ? 'Assigné à un membre du chantier' : null,
  }))
  const planningTasks = tasks.map((task) => ({
    id: task.id, name: task.nom, duration: task.duree_jours,
    predecessorIds: (deps ?? []).filter((dep) => dep.task_id === task.id).map((dep) => dep.predecessor_id),
  }))

  let planning
  let planningError: string | null = null
  try {
    planning = scheduleProject(planningTasks, project.date_debut, calendarForRange(project.date_debut, 0))
  } catch (error) {
    if (!(error instanceof PlanningError)) throw error
    planningError = error.message
  }
  if (!planning) {
    return <section className="card card-pad" role="alert"><h1>Planning à corriger</h1><p>{planningError}</p><Link className="button button-secondary" href={`/chantiers/${id}`}>Retour aux tâches</Link></section>
  }
  return <>
    <div className="page-head"><div><Link href={`/chantiers/${id}`} className="muted">← Tâches du chantier</Link><h1>{project.nom}</h1></div></div>
    <nav className="tabs" aria-label="Sections du chantier">
      <Link className="tab" href={`/chantiers/${id}`}>Tâches</Link>
      <Link className="tab tab-active" aria-current="page" href={`/chantiers/${id}/gantt`}>Gantt</Link>
      <span className="tab locked-tab" aria-disabled="true">Activité</span>
    </nav>
    <GanttView planning={planning} projectStart={project.date_debut} projectName={project.nom} metadata={metadata}/>
  </>
}

export default function GanttPage(props: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<section aria-busy="true" className="card card-pad"><h1>Chargement du planning…</h1><p>Calcul des dates, dépendances et marges.</p></section>}><GanttContent {...props}/></Suspense>
}
