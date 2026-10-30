import type { DelayPreview } from '../planning/delay-preview'
import type { createAdminClient } from '../supabase/admin'
import { buildDelayEmail } from './delay-email'
import { sendEmail } from './send'

type AdminClient = ReturnType<typeof createAdminClient>

export interface NotificationSummary {
  sent: number
  failed: number
  skipped?: string
}

interface NotifyDelayParams {
  admin: AdminClient
  projectId: string
  eventId: string
  taskName: string
  reporterId: string
  delayDays: number
  motif: string
  preview: DelayPreview
}

/**
 * Prévient par email : le propriétaire (toutes les tâches décalées) et chaque responsable
 * dont une tâche est décalée (ses propres tâches). Un échec d’envoi ne bloque jamais le retard.
 */
export async function notifyDelay(params: NotifyDelayParams): Promise<NotificationSummary> {
  const { admin, projectId, eventId, taskName, reporterId, delayDays, motif, preview } = params
  if (!process.env.RESEND_API_KEY) return { sent: 0, failed: 0, skipped: 'clé RESEND_API_KEY absente' }

  const changedIds = preview.changes.map((change) => change.id)
  const [{ data: project }, { data: tasks }, { data: owners }] = await Promise.all([
    admin.from('projects').select('nom').eq('id', projectId).single(),
    admin.from('tasks').select('id,responsable_id').in('id', changedIds),
    admin.from('project_members').select('user_id').eq('project_id', projectId).eq('role', 'owner'),
  ])
  if (!project) return { sent: 0, failed: 0, skipped: 'chantier introuvable' }

  const taskIdsByUser = new Map<string, Set<string>>()
  for (const row of tasks ?? []) {
    if (!row.responsable_id) continue
    const set = taskIdsByUser.get(row.responsable_id) ?? new Set<string>()
    set.add(row.id)
    taskIdsByUser.set(row.responsable_id, set)
  }
  const ownerIds = new Set<string>((owners ?? []).map((owner) => owner.user_id))
  const recipientIds = [...new Set([...taskIdsByUser.keys(), ...ownerIds])]

  const { data: profiles } = await admin
    .from('profiles')
    .select('id,email,nom_complet')
    .in('id', [...new Set([...recipientIds, reporterId])])
  const profileById = new Map<string, { email: string; nom_complet: string | null }>(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  )
  const reporter = profileById.get(reporterId)
  const reporterName = reporter?.nom_complet || reporter?.email || null
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')

  let sent = 0
  let failed = 0
  for (const userId of recipientIds) {
    const profile = profileById.get(userId)
    if (!profile?.email) continue
    const changes = ownerIds.has(userId)
      ? preview.changes
      : preview.changes.filter((change) => taskIdsByUser.get(userId)?.has(change.id))
    if (!changes.length) continue
    const email = buildDelayEmail({
      recipientName: profile.nom_complet,
      reporterName,
      projectName: project.nom,
      taskName,
      delayDays,
      motif,
      changes,
      projectFinishBefore: preview.projectFinishBefore,
      projectFinishAfter: preview.projectFinishAfter,
      projectUrl: `${appUrl}/chantiers/${projectId}`,
    })
    const result = await sendEmail({ to: profile.email, ...email, idempotencyKey: `${eventId}-${userId}` })
    if (result.ok) {
      sent += 1
    } else {
      failed += 1
      console.error('[email] échec d’envoi', result.error)
    }
  }
  return { sent, failed }
}
