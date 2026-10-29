import Link from 'next/link'
import { connection } from 'next/server'
import { CalendarDays, Plus, MapPin, FolderOpen } from 'lucide-react'
import { ensureAuthenticated } from '@/lib/actions/tasks'
import type { Project } from '@/lib/supabase/types'

const date = (value: string | null) => value ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : 'À calculer'

export default async function ProjectsPage() {
  await connection()
  const { supabase } = await ensureAuthenticated()
  const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
  const projects = (data ?? []) as Project[]
  return <>
    <div className="page-head"><div><p className="eyebrow">Tableau de bord</p><h1>Mes chantiers</h1></div><Link className="button button-primary" href="/chantiers/nouveau"><Plus size={20}/><span className="desktop-only">Nouveau chantier</span><span className="sr-only">Nouveau chantier</span></Link></div>
    {projects.length ? <section className="grid project-grid" aria-label="Liste des chantiers">
      {projects.map((project) => <Link className="card project-card" href={`/chantiers/${project.id}`} key={project.id}>
        <div><h2>{project.nom}</h2>{project.adresse && <p className="muted" style={{display:'flex',alignItems:'center',gap:'.35rem',marginTop:'.35rem'}}><MapPin size={15}/>{project.adresse}</p>}</div>
        <div><div style={{display:'flex',justifyContent:'space-between',marginBottom:'.4rem'}}><span className="metric-label">Avancement global</span><strong>{project.avancement_global}%</strong></div><div className="progress"><span style={{width:`${project.avancement_global}%`}} /></div></div>
        <div className="project-meta"><div><span className="metric-label"><CalendarDays size={13} style={{display:'inline'}}/> Début</span><span className="metric-value">{date(project.date_debut)}</span></div><div><span className="metric-label">Fin prévue</span><span className="metric-value">{date(project.date_fin_prevue)}</span></div></div>
      </Link>)}
    </section> : <section className="card empty"><FolderOpen size={48}/><div><h2>Aucun chantier pour l’instant</h2><p className="muted" style={{marginTop:'.35rem'}}>Créez votre premier chantier puis ajoutez ses tâches.</p></div><Link className="button button-primary" href="/chantiers/nouveau"><Plus size={20}/>Créer un chantier</Link></section>}
  </>
}
