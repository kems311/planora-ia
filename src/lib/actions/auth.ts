'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export type FormState = { error?: string; success?: string }

const authSchema = z.object({
  email: z.email('Adresse email invalide.'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
})

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = authSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: 'Email ou mot de passe incorrect.' }
  redirect('/chantiers')
}

export async function signUp(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = authSchema.extend({
    name: z.string().min(2, 'Indiquez votre nom.'),
  }).safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { nom_complet: parsed.data.name } },
  })
  if (error) return { error: error.message }
  if (data.session) redirect('/chantiers')
  return { success: 'Compte créé. Vérifiez votre email pour confirmer l’inscription.' }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/connexion')
}
