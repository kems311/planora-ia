import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { ArrowLeft } from 'lucide-react'
import { ensureAuthenticated } from '@/lib/actions/tasks'
import { DeleteProjectForm, EditProjectForm } from '@/components/project-settings-forms'

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await params
  const { supabase, userId } = await ensureAuthenticated()
  const [{ data: project }, { data: membership }] = await Promise.all([
    supabase.from('projects').select('id,nom,adresse,date_debut,client_nom').eq('id', id).maybeSingle(),
    supabase.from('project_members').select('role').eq('project_id', id).eq('user_id', userId).maybeSingle(),
  ])
  if (!project) notFound()

  const header = <div className="page-head"><div>
    <Link className="muted" href={`/chantiers/${id}`}><ArrowLeft size={18}/>Retour au chantier</Link>
    <p className="eyebrow">Réglages</p>
    <h1>Modifier le chantier</h1>
  </div></div>

  if (membership?.role !== 'owner') {
    return <>
      {header}
      <section className="card card-pad form-card"><p className="alert alert-error" role="alert">Seul le propriétaire du chantier peut le modifier ou le supprimer.</p></section>
    </>
  }

  return <>
    {header}
    <section className="card card-pad form-card"><EditProjectForm project={project} /></section>
    <section className="card card-pad form-card" style={{ marginTop: '1rem' }}><DeleteProjectForm id={project.id} nom={project.nom} /></section>
  </>
}
