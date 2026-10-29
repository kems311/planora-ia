import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** Client utilisateur uniquement : jamais de clé secrète contournant RLS. */
export async function createGanttServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase non configuré : vérifiez .env.local.')
  const cookieStore = await cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(values) {
        try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
        catch {
          // Les Server Components ne peuvent pas modifier les cookies.
          // Le proxy / middleware d'authentification du projet gère le renouvellement.
        }
      },
    },
  })
}
