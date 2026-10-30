'use client'

import Link from 'next/link'
import { startTransition, useActionState, useRef, useState } from 'react'
import { submitDelay, type DelayFormState } from '@/lib/actions/delays'
import type { NotificationSummary } from '@/lib/email/notify-delay'

const formatDate = (value: string) => new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short', day: '2-digit', month: 'short',
}).format(new Date(`${value}T12:00:00`))

function notificationText(summary: NotificationSummary) {
  if (summary.skipped) return `Emails non envoyés : ${summary.skipped}.`
  if (summary.sent === 0 && summary.failed === 0) return 'Aucun email à envoyer.'
  const parts = []
  if (summary.sent > 0) parts.push(`${summary.sent} email(s) envoyé(s)`)
  if (summary.failed > 0) parts.push(`${summary.failed} échec(s) d’envoi`)
  return `${parts.join(', ')}.`
}

// Réduit les photos de téléphone (souvent > 5 Mo) avant l’envoi. En cas d’échec, la photo d’origine est envoyée.
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/heic' || file.type === 'image/heif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.78))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

export function DelayReportForm({ projectId, taskId }: { projectId: string; taskId: string }) {
  const [state, dispatch, pending] = useActionState<DelayFormState, FormData>(submitDelay, {})
  const formRef = useRef<HTMLFormElement>(null)
  const [jours, setJours] = useState('1')
  const [preparing, setPreparing] = useState(false)
  const preview = state.preview
  const stale = preview !== undefined && preview.delayDays !== Number(jours)
  const done = Boolean(state.success)
  const busy = pending || preparing

  async function send(intent: 'preview' | 'confirm') {
    const form = formRef.current
    if (!form || !form.reportValidity()) return
    setPreparing(true)
    try {
      const data = new FormData(form)
      data.set('intent', intent)
      if (intent === 'confirm' && preview) data.set('expected_finish', preview.projectFinishAfter)
      const photo = data.get('photo')
      if (photo instanceof File && photo.size > 0) data.set('photo', await compressImage(photo))
      startTransition(() => dispatch(data))
    } finally {
      setPreparing(false)
    }
  }

  return <div className="form">
    <form ref={formRef} className="form" onSubmit={(event) => { event.preventDefault(); void send('preview') }}>
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="task_id" value={taskId} />
      <div className="field"><label htmlFor="jours">Retard en jours ouvrés *</label><input className="input" id="jours" name="jours" type="number" inputMode="numeric" min="1" max="365" value={jours} onChange={(event) => setJours(event.target.value)} required disabled={done} /></div>
      <div className="field"><label htmlFor="motif">Motif *</label><textarea className="input" id="motif" name="motif" rows={3} minLength={3} maxLength={500} placeholder="Ex. Livraison du carrelage reportée" required disabled={done} /></div>
      <div className="field"><label htmlFor="photo">Photo (facultatif, 5 Mo maximum)</label><input className="input" id="photo" name="photo" type="file" accept="image/*" disabled={done} /></div>
      {!done && <button type="submit" className="button button-secondary button-wide" disabled={busy}>{busy ? 'Calcul en cours…' : 'Voir l’aperçu avant / après'}</button>}
    </form>

    {state.error && <p className="alert alert-error" role="alert">{state.error}</p>}
    {state.success && <p className="alert alert-success" role="status">{state.success}</p>}
    {state.notifications && <p className="muted" role="status">{notificationText(state.notifications)}</p>}

    {preview && !stale && <section className="card card-pad" aria-live="polite">
      <h2>Aperçu avant / après</h2>
      <p style={{ marginTop: '.5rem' }}>Fin du chantier : <s>{formatDate(preview.projectFinishBefore)}</s> → <strong>{formatDate(preview.projectFinishAfter)}</strong></p>
      <p className="alert" style={{ marginTop: '.75rem', background: 'var(--orange-soft)', color: 'var(--orange)' }}>
        {preview.projectShiftWorkingDays > 0
          ? `La fin du chantier recule de ${preview.projectShiftWorkingDays} jour(s) ouvré(s).`
          : 'La date de fin du chantier ne change pas : cette tâche a de la marge.'}
      </p>
      <h3 style={{ marginTop: '1rem' }}>Tâches décalées ({preview.changes.length})</h3>
      {preview.changes.map((change) => <div key={change.id} style={{ marginTop: '.75rem', paddingTop: '.75rem', borderTop: '1px solid var(--border)' }}>
        <strong>{change.name}</strong>
        <p className="muted">Début : {formatDate(change.before.start)} → {formatDate(change.after.start)}</p>
        <p className="muted">Fin : {formatDate(change.before.finish)} → {formatDate(change.after.finish)}</p>
      </div>)}
      {!done && <div style={{ marginTop: '1rem' }}><button type="button" className="button button-primary button-wide" disabled={busy} onClick={() => void send('confirm')}>Confirmer le retard de {preview.delayDays} j</button></div>}
    </section>}

    {done && <Link className="button button-primary button-wide" href={`/chantiers/${projectId}`}>Retour au chantier</Link>}
  </div>
}
