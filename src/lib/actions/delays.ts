'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { MAX_DELAY_DAYS, previewDelay, type DelayPreview } from '@/lib/planning/delay-preview'
import { PlanningError, scheduleProject } from '@/lib/planning/engine'
import { calendarForRange } from '@/lib/planning/french-calendar'
import type { PlanningResult, PlanningTaskInput } from '@/lib/planning/types'
import { ensureAuthenticated } from './tasks'

const PHOTO_BUCKET = 'chantier-photos'
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const PHOTO_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

export interface DelayFormState {
  error?: string
  success?: string
  preview?: DelayPreview
}

const delaySchema = z.object({
  project_id: z.uuid(),
  task_id: z.uuid(),
  jours: z.coerce.number().int('Le retard doit être un nombre entier de jours.')
    .min(1, 'Le retard doit être d’au moins 1 jour.')
    .max(MAX_DELAY_DAYS, `Le retard ne peut pas dépasser ${MAX_DELAY_DAYS} jours.`),
  motif: z.string().trim().min(3, 'Indiquez un motif (3 caractères minimum).').max(500, 'Le motif est trop long (500 caractères maximum).'),
  intent: z.enum(['preview', 'confirm']),
  expected_finish: z.string().optional(),
})

type ServerClient = Awaited<ReturnType<typeof createClient>>
type AdminClient = ReturnType<typeof createAdminClient>

interface DelayContext {
  projectStart: string
  inputs: PlanningTaskInput[]
  responsableId: string | null
  isOwner: boolean
}

async function loadContext(
  supabase: ServerClient,
  userId: string,
  projectId: string,
  taskId: string,
): Promise<DelayContext | null> {
  const [{ data: project }, { data: rows }, { data: membership }] = await Promise.all([
    supabase.from('projects').select('date_debut').eq('id', projectId).single(),
    supabase.from('tasks').select('id,nom,duree_jours,responsable_id').eq('project_id', projectId),
    supabase.from('project_members').select('role').eq('project_id', projectId).eq('user_id', userId).maybeSingle(),
  ])
  if (!project || !rows || !membership) return null
  const target = rows.find((row) => row.id === taskId)
  if (!target) return null
  const { data: dependencies } = await supabase
    .from('task_dependencies')
    .select('task_id,predecessor_id')
    .in('task_id', rows.map((row) => row.id))
  const inputs: PlanningTaskInput[] = rows.map((row) => ({
    id: row.id,
    name: row.nom,
    duration: row.duree_jours,
    predecessorIds: (dependencies ?? [])
      .filter((dependency) => dependency.task_id === row.id)
      .map((dependency) => dependency.predecessor_id),
  }))
  return {
    projectStart: project.date_debut,
    inputs,
    responsableId: target.responsable_id ?? null,
    isOwner: membership.role === 'owner',
  }
}

async function persistSchedule(admin: AdminClient, projectId: string, result: PlanningResult): Promise<string | null> {
  const updates = await Promise.all(result.tasks.map((task) => admin.from('tasks').update({
    duree_jours: task.duration,
    date_debut_calculee: task.earlyStart,
    date_fin_calculee: task.earlyFinish,
    est_critique: task.isCritical,
    marge_jours: task.totalFloat,
  }).eq('id', task.id).eq('project_id', projectId)))
  const failed = updates.find((update) => update.error)
  if (failed?.error) return failed.error.message
  const { error } = await admin.from('projects').update({ date_fin_prevue: result.projectFinish }).eq('id', projectId)
  return error ? error.message : null
}

async function removePhoto(admin: AdminClient, path: string | null) {
  if (path) await admin.storage.from(PHOTO_BUCKET).remove([path])
}

export async function submitDelay(_: DelayFormState, formData: FormData): Promise<DelayFormState> {
  const parsed = delaySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { project_id: projectId, task_id: taskId, jours, motif, intent, expected_finish: expectedFinish } = parsed.data

  const { supabase, userId } = await ensureAuthenticated()
  const context = await loadContext(supabase, userId, projectId, taskId)
  if (!context) return { error: 'Chantier ou tâche introuvable.' }
  if (!context.isOwner && context.responsableId !== userId) {
    return { error: 'Seuls le propriétaire du chantier et le responsable de la tâche peuvent signaler un retard.' }
  }

  const calendar = calendarForRange(context.projectStart, 10)
  let preview: DelayPreview
  try {
    preview = previewDelay(context.inputs, taskId, jours, context.projectStart, calendar)
  } catch (error) {
    return { error: error instanceof PlanningError ? error.message : 'L’aperçu du retard n’a pas pu être calculé.' }
  }
  if (intent === 'preview') return { preview }
  if (!expectedFinish) return { preview, error: 'Affichez d’abord l’aperçu avant de confirmer.' }
  if (expectedFinish !== preview.projectFinishAfter) {
    return { preview, error: 'Le planning a changé depuis l’aperçu. Vérifiez la nouvelle simulation, puis confirmez.' }
  }

  let admin: AdminClient
  try {
    admin = createAdminClient()
  } catch (error) {
    return { preview, error: error instanceof Error ? error.message : 'Configuration serveur incomplète.' }
  }

  const photo = formData.get('photo')
  let photoPath: string | null = null
  if (photo instanceof File && photo.size > 0) {
    const extension = PHOTO_EXTENSIONS[photo.type]
    if (!extension) return { preview, error: 'La photo doit être une image JPEG, PNG, WebP ou HEIC.' }
    if (photo.size > MAX_PHOTO_BYTES) return { preview, error: 'La photo dépasse 5 Mo.' }
    photoPath = `${projectId}/${taskId}/${randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(photoPath, photo, { contentType: photo.type, upsert: false })
    if (uploadError) return { preview, error: `Photo non envoyée : ${uploadError.message}` }
  }

  const { data: event, error: eventError } = await supabase.from('events').insert({
    task_id: taskId,
    type: 'retard',
    jours_retard: jours,
    motif,
    photo_url: photoPath,
    donnees: {
      projectFinishBefore: preview.projectFinishBefore,
      projectFinishAfter: preview.projectFinishAfter,
      projectShiftWorkingDays: preview.projectShiftWorkingDays,
      changes: preview.changes,
      becameCritical: preview.becameCritical,
      noLongerCritical: preview.noLongerCritical,
    },
  }).select('id').single()
  if (eventError || !event) {
    await removePhoto(admin, photoPath)
    return { preview, error: `Retard non enregistré : ${eventError?.message ?? 'erreur inconnue'}` }
  }

  const delayedTasks = context.inputs.map((task) => (
    task.id === taskId ? { ...task, duration: task.duration + jours } : task
  ))
  const persistError = await persistSchedule(admin, projectId, scheduleProject(delayedTasks, context.projectStart, calendar))
  if (persistError) {
    await persistSchedule(admin, projectId, scheduleProject(context.inputs, context.projectStart, calendar))
    await admin.from('events').delete().eq('id', event.id)
    await removePhoto(admin, photoPath)
    return { preview, error: `Le planning n’a pas pu être mis à jour : ${persistError}` }
  }

  revalidatePath(`/chantiers/${projectId}`)
  revalidatePath('/chantiers')
  return { preview, success: 'Retard enregistré, planning recalculé.' }
}
