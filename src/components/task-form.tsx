'use client'
import { useActionState } from 'react'
import { createTask } from '@/lib/actions/tasks'
import type { FormState } from '@/lib/actions/auth'
import { SubmitButton } from './submit-button'

interface Option { id: string; nom: string }
interface Member { user_id: string; profiles: { nom_complet: string | null; email: string } | null }

export function TaskForm({ projectId, tasks, members }: { projectId: string; tasks: Option[]; members: Member[] }) {
  const [state, action] = useActionState<FormState, FormData>(createTask, {})
  return <form className="form" action={action}>
    <input type="hidden" name="project_id" value={projectId} />
    <div className="field"><label htmlFor="nom">Nom de la tâche *</label><input className="input" id="nom" name="nom" placeholder="Ex. Pose du carrelage" required /></div>
    <div className="field"><label htmlFor="duree_jours">Durée en jours ouvrés *</label><input className="input" id="duree_jours" name="duree_jours" type="number" inputMode="numeric" min="0" max="3650" defaultValue="1" required /><span className="muted">0 = jalon</span></div>
    <div className="field"><label htmlFor="predecessor_id">Prédécesseur</label><select className="select" id="predecessor_id" name="predecessor_id"><option value="">Aucun</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.nom}</option>)}</select></div>
    <div className="field"><label htmlFor="responsable_id">Responsable</label><select className="select" id="responsable_id" name="responsable_id"><option value="">Non assigné</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.profiles?.nom_complet || member.profiles?.email || 'Membre'}</option>)}</select></div>
    {state.error && <p className="alert alert-error" role="alert">{state.error}</p>}
    {state.success && <p className="alert alert-success" role="status">{state.success}</p>}
    <SubmitButton>Ajouter la tâche</SubmitButton>
  </form>
}
