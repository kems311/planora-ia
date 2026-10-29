import type { Metadata } from 'next'
import { AuthForm } from '@/components/auth-form'
import { Logo } from '@/components/logo'
export const metadata: Metadata = { title: 'Inscription' }
export default function SignupPage() {
  return <main className="auth-layout"><section className="auth-card" aria-labelledby="title"><div className="auth-brand"><Logo /></div><p className="eyebrow">Démarrage gratuit</p><h1 id="title">Créer votre espace</h1><p className="muted" style={{margin: '.5rem 0 1.5rem'}}>Centralisez vos chantiers et leurs tâches.</p><AuthForm mode="signup" /></section></main>
}
