'use client'

export default function GanttError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="card card-pad" role="alert"><h1>Le planning ne peut pas être chargé</h1><p>Vérifiez votre connexion puis réessayez. Aucune tâche n’a été modifiée.</p><button type="button" className="button button-primary" onClick={reset}>Réessayer</button></section>
}
