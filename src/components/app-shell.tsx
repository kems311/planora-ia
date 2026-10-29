import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { Logo } from './logo'
import { signOut } from '@/lib/actions/auth'

export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="shell">
    <header className="app-header">
      <Link href="/chantiers" aria-label="Accueil Planora-IA"><Logo /></Link>
      <div className="header-actions"><form action={signOut}><button className="button button-ghost" aria-label="Se déconnecter" title="Se déconnecter"><LogOut size={21}/><span className="desktop-only">Déconnexion</span></button></form></div>
    </header>
    <main className="app-main" id="contenu">{children}</main>
  </div>
}
