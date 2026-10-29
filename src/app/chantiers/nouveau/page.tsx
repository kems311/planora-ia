import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ProjectForm } from '@/components/project-form'

export default function NewProjectPage() {
  return <>
    <div className="page-head"><div>
      <Link className="muted" href="/chantiers"><ArrowLeft size={18}/>Retour</Link>
      <h1>Nouveau chantier</h1>
      <p className="muted">Les informations complémentaires pourront être ajoutées ensuite.</p>
    </div></div>
    <section className="card card-pad form-card"><ProjectForm /></section>
  </>
}
