'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { calendarForRange } from '@/lib/planning/french-calendar'
import { scheduleProject, PlanningError } from '@/lib/planning/engine'
import type { FormState } from './auth'

const taskSchema = z.object({
  project_id: z.uuid(),
  nom: z.string().trim().min(1, 'Le nom de la tâche est obligatoire.').max(180),
  duree_jours: z.coerce.number().int().min(0).max(3650),
  predecessor_id: z.string().optional(),
  responsable_id: z.string().optional(),
})

async function recalculateProject(projectId: string): Promise<string | null> {
  const supabase = await createClient()
  const [{ data: project }, { data: tasks }, { data: dependencies }] = await Promise.all([
    supabase.from('projects').select('date_debut').eq('id', projectId).single(),
    supabase.from('tasks').select('id,nom,duree_jours').eq('project_id', projectId),
    supabase.from('task_dependencies').select('task_id,predecessor_id'),
  ])
  if (!project || !tasks) return null
  const projectTaskIds = new Set(tasks.map((task) => task.id))
  const result = scheduleProject(tasks.map((task) => ({
    id: task.id,
    name: task.nom,
    duration: task.duree_jours,
    predecessorIds: (dependencies ?? [])
      .filter((dep) => dep.task_id === task.id && projectTaskIds.has(dep.predecessor_id))
      .map((dep) => dep.predecessor_id),
  })), project.date_debut, calendarForRange(project.date_debut, 10))

  await Promise.all(result.tasks.map((task) => supabase.from('tasks').update({
    date_debut_calculee: task.earlyStart,
    date_fin_calculee: task.earlyFinish,
    est_critique: task.isCritical,
    marge_jours: task.totalFloat,
  }).eq('id', task.id)))
  await supabase.from('projects').update({ date_fin_prevue: result.projectFinish }).eq('id', projectId)
  return result.projectFinish
}

export async function createTask(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = taskSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const supabase = await createClient()
  const predecessorId = parsed.data.predecessor_id || null
  const { data: task, error } = await supabase.from('tasks').insert({
    project_id: parsed.data.project_id,
    nom: parsed.data.nom,
    duree_jours: parsed.data.duree_jours,
    responsable_id: parsed.data.responsable_id || null,
  }).select('id').single()
  if (error) return { error: `Tâche non créée : ${error.message}` }
  if (predecessorId) {
    const { error: dependencyError } = await supabase.from('task_dependencies').insert({
      task_id: task.id,
      predecessor_id: predecessorId,
    })
    if (dependencyError) {
      await supabase.from('tasks').delete().eq('id', task.id)
      return { error: dependencyError.message }
    }
  }
  try {
    await recalculateProject(parsed.data.project_id)
  } catch (error) {
    await supabase.from('tasks').delete().eq('id', task.id)
    return { error: error instanceof PlanningError ? error.message : 'Le planning n’a pas pu être recalculé.' }
  }
  revalidatePath(`/chantiers/${parsed.data.project_id}`)
  return { success: 'Tâche ajoutée et planning recalculé.' }
}

export async function deleteTask(formData: FormData) {
  const projectId = String(formData.get('project_id'))
  const taskId = String(formData.get('task_id'))
  const supabase = await createClient()
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (!error) await recalculateProject(projectId)
  revalidatePath(`/chantiers/${projectId}`)
}

export async function ensureAuthenticated() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect('/connexion')
  return { supabase, userId: data.claims.sub }
}
