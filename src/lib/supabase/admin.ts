import { createClient } from '@supabase/supabase-js'

/**
 * Client Supabase à droits complets (service_role). À utiliser UNIQUEMENT dans des actions serveur,
 * après avoir vérifié explicitement les droits de l’utilisateur. Ne jamais l’importer dans un composant client.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY est absente de .env.local.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
