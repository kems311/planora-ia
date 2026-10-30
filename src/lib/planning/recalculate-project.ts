import type { createClient } from '../supabase/server'
import { scheduleProject } from './engine'
import { calendarForRange } from './french-calendar'
import type { PlanningTaskInput } from './types'

type ServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Recalcule les dates de toutes les tâches d’un chantier ainsi que sa date de fin prévue.
 * À utiliser côté serveur par le propriétaire (les règles RLS autorisent alors la mise à jour).
 * Renvoie un message d’erreur, ou null si tout s’est bien passé.
 */
export async function recalculateProjectDates(
  supabase: ServerClient,
  projectId: string,
  projectStart: string,
): Promise<string | null> {
  const { data: rows, error } = await supabase.from('tasks').select('id,nom,duree_jours').eq('project_id', projectId)
  if (error) return error.message
  if (!rows?.length) {
    const { error: clearError } = await supabase.from('projects').update({ date_fin_prevue: null }).eq('id', projectId)
    return clearError ? clearError.message : null
  }
  const { data: dependencies, error: dependencyError } = await supabase
    .from('task_dependencies')
    .select('task_id,predecessor_id')
    .in('task_id', rows.map((row) => row.id))
  if (dependencyError) return dependencyError.message

  const inputs: PlanningTaskInput[] = rows.map((row) => ({
    id: row.id,
    name: row.nom,
    duration: row.duree_jours,
    predecessorIds: (dependencies ?? [])
      .filter((dependency) => dependency.task_id === row.id)
      .map((dependency) => dependency.predecessor_id),
  }))

  try {
    const result = scheduleProject(inputs, projectStart, calendarForRange(projectStart, 10))
    const updates = await Promise.all(result.tasks.map((task) => supabase.from('tasks').update({
      date_debut_calculee: task.earlyStart,
      date_fin_calculee: task.earlyFinish,
      est_critique: task.isCritical,
      marge_jours: task.totalFloat,
    }).eq('id', task.id)))
    const failed = updates.find((update) => update.error)
    if (failed?.error) return failed.error.message
    const { error: projectError } = await supabase
      .from('projects')
      .update({ date_fin_prevue: result.projectFinish })
      .eq('id', projectId)
    return projectError ? projectError.message : null
  } catch (caught) {
    return caught instanceof Error ? caught.message : 'Recalcul impossible.'
  }
}
