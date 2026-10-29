import type { Metadata } from 'next'
import { AuthForm } from '@/components/auth-form'
import { Logo } from '@/components/logo'
export const metadata: Metadata = { title: 'Connexion' }
export default function LoginPage() {
  return <main className="auth-layout"><section className="auth-card" aria-labelledby="title"><div className="auth-brand"><Logo /></div><p className="eyebrow">Votre planning de chantier</p><h1 id="title">Bon retour</h1><p className="muted" style={{margin: '.5rem 0 1.5rem'}}>Connectez-vous pour retrouver vos chantiers.</p><AuthForm mode="login" /></section></main>
}
