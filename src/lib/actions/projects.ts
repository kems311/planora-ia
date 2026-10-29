'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { FormState } from './auth'

const projectSchema = z.object({
  nom: z.string().trim().min(2, 'Le nom du chantier est obligatoire.').max(120),
  adresse: z.string().trim().max(240).optional(),
  date_debut: z.iso.date('Date de début invalide.'),
  client_nom: z.string().trim().max(120).optional(),
})

export async function createProject(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = projectSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) redirect('/connexion')
  const { data, error } = await supabase.from('projects').insert({
    ...parsed.data,
    adresse: parsed.data.adresse || null,
    client_nom: parsed.data.client_nom || null,
    owner_id: userId,
  }).select('id').single()
  if (error) return { error: `Création impossible : ${error.message}` }
  revalidatePath('/chantiers')
  redirect(`/chantiers/${data.id}`)
}
