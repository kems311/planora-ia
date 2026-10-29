'use client'
import { useActionState } from 'react'
import { createProject } from '@/lib/actions/projects'
import type { FormState } from '@/lib/actions/auth'
import { SubmitButton } from './submit-button'

export function ProjectForm() {
  const [state, action] = useActionState<FormState, FormData>(createProject, {})
  return <form className="form" action={action}>
    <div className="field"><label htmlFor="nom">Nom du chantier *</label><input className="input" id="nom" name="nom" placeholder="Ex. Rénovation maison Martin" required maxLength={120} /></div>
    <div className="field"><label htmlFor="adresse">Adresse</label><input className="input" id="adresse" name="adresse" autoComplete="street-address" placeholder="12 rue des Lilas, Toulouse" /></div>
    <div className="form-row">
      <div className="field"><label htmlFor="date_debut">Date de début *</label><input className="input" id="date_debut" name="date_debut" type="date" required /></div>
      <div className="field"><label htmlFor="client_nom">Nom du client</label><input className="input" id="client_nom" name="client_nom" /></div>
    </div>
    {state.error && <p className="alert alert-error" role="alert">{state.error}</p>}
    <SubmitButton>Créer le chantier</SubmitButton>
  </form>
}
