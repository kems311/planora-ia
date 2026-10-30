'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { deleteProject, updateProject, type ProjectSettingsState } from '@/lib/actions/project-settings'
import { SubmitButton } from './submit-button'

interface ProjectValues {
  id: string
  nom: string
  adresse: string | null
  date_debut: string
  client_nom: string | null
}

export function EditProjectForm({ project }: { project: ProjectValues }) {
  const [state, action] = useActionState<ProjectSettingsState, FormData>(updateProject, {})
  const values = state.values
  return <form className="form" action={action}>
    <input type="hidden" name="id" value={project.id} />
    <div className="field"><label htmlFor="nom">Nom du chantier *</label><input className="input" id="nom" name="nom" defaultValue={values?.nom ?? project.nom} required maxLength={120} /></div>
    <div className="field"><label htmlFor="adresse">Adresse</label><input className="input" id="adresse" name="adresse" autoComplete="street-address" defaultValue={values?.adresse ?? project.adresse ?? ''} /></div>
    <div className="form-row">
      <div className="field"><label htmlFor="date_debut">Date de début *</label><input className="input" id="date_debut" name="date_debut" type="date" defaultValue={values?.date_debut ?? project.date_debut} required /></div>
      <div className="field"><label htmlFor="client_nom">Nom du client</label><input className="input" id="client_nom" name="client_nom" defaultValue={values?.client_nom ?? project.client_nom ?? ''} /></div>
    </div>
    <p className="muted">Si vous changez la date de début, toutes les dates du planning sont recalculées.</p>
    {state.error && <p className="alert alert-error" role="alert">{state.error}</p>}
    <SubmitButton>Enregistrer les modifications</SubmitButton>
  </form>
}

function DeleteButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  const blocked = disabled || pending
  return <button type="submit" className="button button-wide" style={{ background: 'var(--red)', color: 'white', opacity: blocked ? 0.5 : 1 }} disabled={blocked}>
    {pending ? 'Suppression…' : 'Supprimer définitivement'}
  </button>
}

export function DeleteProjectForm({ id, nom }: { id: string; nom: string }) {
  const [state, action] = useActionState<ProjectSettingsState, FormData>(deleteProject, {})
  const [typed, setTyped] = useState('')
  return <form className="form" action={action}>
    <h2 style={{ color: 'var(--red)' }}>Supprimer le chantier</h2>
    <p className="muted">Cette action est définitive : les tâches, les dépendances, l’historique des retards et les photos de « {nom} » seront supprimés.</p>
    <input type="hidden" name="id" value={id} />
    <div className="field">
      <label htmlFor="confirmation">Pour confirmer, saisissez le nom du chantier : <strong>{nom}</strong></label>
      <input className="input" id="confirmation" name="confirmation" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
    </div>
    {state.error && <p className="alert alert-error" role="alert">{state.error}</p>}
    <DeleteButton disabled={typed.trim() !== nom} />
  </form>
}
