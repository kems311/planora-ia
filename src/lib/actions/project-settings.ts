'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { recalculateProjectDates } from '@/lib/planning/recalculate-project'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureAuthenticated } from './tasks'

const PHOTO_BUCKET = 'chantier-photos'

export interface ProjectSettingsState {
  error?: string
  values?: { nom: string; adresse: string; date_debut: string; client_nom: string }
}

const updateSchema = z.object({
  id: z.uuid(),
  nom: z.string().trim().min(2, 'Le nom du chantier est obligatoire.').max(120, 'Le nom est trop long (120 caractères maximum).'),
  adresse: z.string().trim().max(240, 'L’adresse est trop longue (240 caractères maximum).').optional(),
  date_debut: z.iso.date('Date de début invalide.'),
  client_nom: z.string().trim().max(120, 'Le nom du client est trop long (120 caractères maximum).').optional(),
})

const deleteSchema = z.object({
  id: z.uuid(),
  confirmation: z.string(),
})

export async function updateProject(_: ProjectSettingsState, formData: FormData): Promise<ProjectSettingsState> {
  const raw = Object.fromEntries(formData)
  const values = {
    nom: String(raw.nom ?? ''),
    adresse: String(raw.adresse ?? ''),
    date_debut: String(raw.date_debut ?? ''),
    client_nom: String(raw.client_nom ?? ''),
  }
  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message, values }
  const { id, nom, adresse, date_debut: dateDebut, client_nom: clientNom } = parsed.data

  const { supabase, userId } = await ensureAuthenticated()
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (membership?.role !== 'owner') return { error: 'Seul le propriétaire peut modifier le chantier.', values }

  const { data: current } = await supabase.from('projects').select('date_debut').eq('id', id).maybeSingle()
  if (!current) return { error: 'Chantier introuvable.', values }

  const { error } = await supabase.from('projects').update({
    nom,
    adresse: adresse || null,
    client_nom: clientNom || null,
    date_debut: dateDebut,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { error: `Modification impossible : ${error.message}`, values }

  if (current.date_debut !== dateDebut) {
    const recalcError = await recalculateProjectDates(supabase, id, dateDebut)
    if (recalcError) {
      return { error: `Chantier modifié, mais le planning n’a pas pu être recalculé : ${recalcError}`, values }
    }
  }

  revalidatePath(`/chantiers/${id}`)
  revalidatePath('/chantiers')
  redirect(`/chantiers/${id}`)
}

/** Supprime les photos du chantier (dossier <chantier>/<tâche>/<fichier>). Un échec est consigné sans bloquer la suppression. */
async function removeProjectPhotos(projectId: string) {
  try {
    const bucket = createAdminClient().storage.from(PHOTO_BUCKET)
    const { data: entries } = await bucket.list(projectId, { limit: 1000 })
    const paths: string[] = []
    for (const entry of entries ?? []) {
      if (entry.id === null) {
        const { data: files } = await bucket.list(`${projectId}/${entry.name}`, { limit: 1000 })
        for (const file of files ?? []) paths.push(`${projectId}/${entry.name}/${file.name}`)
      } else {
        paths.push(`${projectId}/${entry.name}`)
      }
    }
    if (paths.length) await bucket.remove(paths)
  } catch (caught) {
    console.error('[stockage] nettoyage des photos impossible', caught instanceof Error ? caught.message : caught)
  }
}

export async function deleteProject(_: ProjectSettingsState, formData: FormData): Promise<ProjectSettingsState> {
  const parsed = deleteSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Demande de suppression invalide.' }
  const { id, confirmation } = parsed.data

  const { supabase, userId } = await ensureAuthenticated()
  const [{ data: project }, { data: membership }] = await Promise.all([
    supabase.from('projects').select('nom').eq('id', id).maybeSingle(),
    supabase.from('project_members').select('role').eq('project_id', id).eq('user_id', userId).maybeSingle(),
  ])
  if (!project) return { error: 'Chantier introuvable.' }
  if (membership?.role !== 'owner') return { error: 'Seul le propriétaire peut supprimer le chantier.' }
  if (confirmation.trim() !== project.nom) return { error: 'Le nom saisi ne correspond pas au nom du chantier.' }

  const { data: deleted, error } = await supabase.from('projects').delete().eq('id', id).select('id')
  if (error) return { error: `Suppression impossible : ${error.message}` }
  if (!deleted?.length) return { error: 'Le chantier n’a pas été supprimé (droits insuffisants).' }

  await removeProjectPhotos(id)
  revalidatePath('/chantiers')
  redirect('/chantiers')
}
