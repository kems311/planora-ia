'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { signIn, signUp, type FormState } from '@/lib/actions/auth'
import { SubmitButton } from './submit-button'

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const action = mode === 'login' ? signIn : signUp
  const [state, formAction] = useActionState<FormState, FormData>(action, {})
  return <form className="form" action={formAction}>
    {mode === 'signup' && <div className="field"><label htmlFor="name">Nom complet</label><input className="input" id="name" name="name" autoComplete="name" required /></div>}
    <div className="field"><label htmlFor="email">Adresse email</label><input className="input" id="email" name="email" type="email" autoComplete="email" inputMode="email" required /></div>
    <div className="field"><label htmlFor="password">Mot de passe</label><input className="input" id="password" name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required /></div>
    {state.error && <p className="alert alert-error" role="alert">{state.error}</p>}
    {state.success && <p className="alert alert-success" role="status">{state.success}</p>}
    <SubmitButton pendingText={mode === 'login' ? 'Connexion…' : 'Création…'}>{mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</SubmitButton>
    <p className="auth-switch">{mode === 'login' ? <>Pas encore de compte ? <Link href="/inscription">S’inscrire</Link></> : <>Déjà inscrit ? <Link href="/connexion">Se connecter</Link></>}</p>
  </form>
}
