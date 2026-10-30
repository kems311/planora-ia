import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { ArrowLeft } from 'lucide-react'
import { ensureAuthenticated } from '@/lib/actions/tasks'
import { DelayReportForm } from '@/components/delay-report-form'

export default async function DelayPage({ params }: { params: Promise<{ id: string; taskId: string }> }) {
  await connection()
  const { id, taskId } = await params
  const { supabase } = await ensureAuthenticated()
  const { data: task } = await supabase
    .from('tasks')
    .select('id,nom,duree_jours')
    .eq('id', taskId)
    .eq('project_id', id)
    .maybeSingle()
  if (!task || task.duree_jours === 0) notFound()

  return <>
    <div className="page-head"><div><Link className="muted" href={`/chantiers/${id}`}><ArrowLeft size={18}/>Retour au chantier</Link><p className="eyebrow">Signalement</p><h1>Retard : {task.nom}</h1></div></div>
    <section className="card card-pad form-card"><DelayReportForm projectId={id} taskId={taskId} /></section>
  </>
}
