import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarDays, Clock3, ListChecks, Trash2 } from 'lucide-react'
import { ensureAuthenticated, deleteTask } from '@/lib/actions/tasks'
import { TaskForm } from '@/components/task-form'
import type { Project, Task, TaskDependency, TaskStatus } from '@/lib/supabase/types'
import { connection } from 'next/server'

const status: Record<TaskStatus, { label: string; className: string }> = {
  a_faire: { label: 'À faire', className: 'badge-todo' },
  en_cours: { label: 'En cours', className: 'badge-progress' },
  bloque: { label: 'Bloqué', className: 'badge-blocked' },
  termine: { label: 'Terminé', className: 'badge-done' },
}
const displayDate = (value: string | null) => value ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(`${value}T12:00:00`)) : '—'

type MemberOption = { user_id: string; profiles: { nom_complet: string | null; email: string } | null }

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await params
  const { supabase, userId } = await ensureAuthenticated()
  const [{ data: project }, { data: tasks }, { data: dependencies }, { data: members }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('tasks').select('*, profiles:responsable_id(nom_complet,email)').eq('project_id', id).order('created_at'),
    supabase.from('task_dependencies').select('task_id,predecessor_id'),
    supabase.from('project_members').select('user_id,role,profiles:user_id(nom_complet,email)').eq('project_id', id),
  ])
  if (!project) notFound()
  const typedProject = project as Project
  const typedTasks = (tasks ?? []) as unknown as Task[]
  const typedDependencies = (dependencies ?? []) as TaskDependency[]
  const byId = new Map(typedTasks.map((task) => [task.id, task]))
  const predecessor = (taskId: string) => {
    const dep = typedDependencies.find((item) => item.task_id === taskId)
    return dep ? byId.get(dep.predecessor_id)?.nom ?? '—' : '—'
  }
  const canDelay = (task: Task) => task.duree_jours > 0 && task.statut !== 'termine'
  const delayHref = (taskId: string) => `/chantiers/${id}/retard/${taskId}`
  const isOwner = (members ?? []).some((member) => member.user_id === userId && member.role === 'owner')
  const memberOptions = (members ?? []).map((member) => ({
    user_id: member.user_id,
    profiles: Array.isArray(member.profiles) ? member.profiles[0] ?? null : member.profiles,
  })) as MemberOption[]

  return <>
    <div className="page-head"><div><Link className="muted" href="/chantiers"><ArrowLeft size={18}/>Chantiers</Link><p className="eyebrow">{typedProject.client_nom || 'Chantier'}</p><h1>{typedProject.nom}</h1><p className="muted">Fin prévue : <strong>{displayDate(typedProject.date_fin_prevue)}</strong></p></div>{isOwner && <Link className="button button-secondary" href={`/chantiers/${id}/modifier`}>Modifier le chantier</Link>}</div>
    <nav className="tabs" aria-label="Sections du chantier"><span className="tab tab-active"><ListChecks size={18}/> Tâches</span><Link className="tab" href={`/chantiers/${id}/gantt`}><CalendarDays size={18}/> Gantt</Link><span className="tab locked-tab" title="Disponible après validation"><Clock3 size={18}/> Activité</span></nav>
    <div className="task-layout"><section>
      <div className="mobile-task-list task-list">{typedTasks.map((task) => <article className="card task-card" key={task.id}><div className="task-top"><div><h3>{task.nom}</h3><span className={`badge ${status[task.statut].className}`} style={{marginTop:'.4rem'}}>{status[task.statut].label}</span></div>{task.est_critique && <span className="badge badge-critical">Critique</span>}</div><div className="task-details"><div><span className="metric-label">Durée</span><strong>{task.duree_jours} j</strong></div><div><span className="metric-label">Avancement</span><strong>{task.avancement}%</strong></div><div><span className="metric-label">Début</span><strong>{displayDate(task.date_debut_calculee)}</strong></div><div><span className="metric-label">Fin</span><strong>{displayDate(task.date_fin_calculee)}</strong></div><div><span className="metric-label">Prédécesseur</span><strong>{predecessor(task.id)}</strong></div><div><span className="metric-label">Responsable</span><strong>{task.profiles?.nom_complet || task.profiles?.email || 'Non assigné'}</strong></div></div>{canDelay(task) && <Link className="button button-secondary button-wide" href={delayHref(task.id)}>Signaler un retard</Link>}</article>)}</div>
      <div className="card table-wrap"><table><thead><tr><th>Tâche</th><th>Durée</th><th>Prédécesseur</th><th>Responsable</th><th>Statut</th><th>Avanc.</th><th>Dates calculées</th><th></th></tr></thead><tbody>{typedTasks.map((task) => <tr key={task.id}><td><strong>{task.nom}</strong>{task.est_critique && <span className="badge badge-critical">Critique</span>}</td><td>{task.duree_jours} j</td><td>{predecessor(task.id)}</td><td>{task.profiles?.nom_complet || task.profiles?.email || '—'}</td><td><span className={`badge ${status[task.statut].className}`}>{status[task.statut].label}</span></td><td>{task.avancement}%</td><td>{displayDate(task.date_debut_calculee)} → {displayDate(task.date_fin_calculee)}</td><td><div style={{display:'flex',gap:'.5rem',alignItems:'center'}}>{canDelay(task) && <Link className="button button-secondary" href={delayHref(task.id)}>Retard</Link>}<form action={deleteTask}><input type="hidden" name="project_id" value={id}/><input type="hidden" name="task_id" value={task.id}/><button className="button button-danger" aria-label={`Supprimer ${task.nom}`}><Trash2 size={18}/></button></form></div></td></tr>)}</tbody></table></div>
      {!typedTasks.length && <div className="card empty"><ListChecks size={48}/><div><h2>Ajoutez la première tâche</h2><p className="muted">Les dates seront calculées automatiquement.</p></div></div>}
    </section>
    <aside className="card card-pad task-form"><p className="eyebrow">Planning</p><h2>Ajouter une tâche</h2><TaskForm projectId={id} tasks={typedTasks.map(({id,nom}) => ({id,nom}))} members={memberOptions}/></aside></div>
  </>
}
