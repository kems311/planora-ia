import type { TaskDateChange } from '../planning/delay-preview'

export interface DelayEmailInput {
  recipientName: string | null
  reporterName: string | null
  projectName: string
  taskName: string
  delayDays: number
  motif: string
  changes: TaskDateChange[]
  projectFinishBefore: string
  projectFinishAfter: string
  projectUrl: string
}

export interface BuiltEmail {
  subject: string
  html: string
  text: string
}

const fullDate = (iso: string) => new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${iso}T12:00:00Z`))

const shortDate = (iso: string) => new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
}).format(new Date(`${iso}T12:00:00Z`))

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const oneLine = (value: string) => value.replace(/\s+/g, ' ').trim()

export function buildDelayEmail(input: DelayEmailInput): BuiltEmail {
  const finishChanged = input.projectFinishBefore !== input.projectFinishAfter
  const plural = input.delayDays > 1 ? 's' : ''
  const days = `${input.delayDays} jour${plural} ouvré${plural}`
  const project = oneLine(input.projectName)
  const task = oneLine(input.taskName)
  const motif = oneLine(input.motif)
  const reporter = input.reporterName ? oneLine(input.reporterName) : 'Un membre de l’équipe'
  const greeting = input.recipientName ? `Bonjour ${oneLine(input.recipientName)},` : 'Bonjour,'

  const subject = finishChanged
    ? `Retard sur « ${project} » : nouvelle fin le ${fullDate(input.projectFinishAfter)}`
    : `Retard signalé sur « ${project} » : fin du chantier inchangée`
  const finishLine = finishChanged
    ? `Nouvelle fin du chantier : ${fullDate(input.projectFinishAfter)} (avant : ${fullDate(input.projectFinishBefore)})`
    : `Fin du chantier inchangée : ${fullDate(input.projectFinishAfter)}`

  const text = [
    greeting,
    '',
    `${reporter} a signalé un retard de ${days} sur « ${task} » (chantier « ${project} »).`,
    `Motif : ${motif}`,
    '',
    finishLine,
    '',
    'Tâches concernées :',
    ...input.changes.map((change) => `- ${oneLine(change.name)} : début ${shortDate(change.before.start)} → ${shortDate(change.after.start)} ; fin ${shortDate(change.before.finish)} → ${shortDate(change.after.finish)}`),
    '',
    `Ouvrir le chantier : ${input.projectUrl}`,
  ].join('\n')

  const cell = 'padding:8px;border-top:1px solid #dce6ec;vertical-align:top'
  const rows = input.changes.map((change) => `<tr><td style="${cell}"><strong>${escapeHtml(oneLine(change.name))}</strong></td><td style="${cell}"><s>${shortDate(change.before.start)} → ${shortDate(change.before.finish)}</s></td><td style="${cell}">${shortDate(change.after.start)} → ${shortDate(change.after.finish)}</td></tr>`).join('')
  const bannerStyle = finishChanged
    ? 'background:#fff0e5;color:#c75b0b'
    : 'background:#eaf0f4;color:#142533'
  const banner = finishChanged
    ? `<strong>Nouvelle fin du chantier : ${escapeHtml(fullDate(input.projectFinishAfter))}</strong><br>Avant : <s>${escapeHtml(fullDate(input.projectFinishBefore))}</s>`
    : `<strong>Fin du chantier inchangée : ${escapeHtml(fullDate(input.projectFinishAfter))}</strong>`

  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#142533;max-width:600px;margin:0 auto;padding:16px">',
    `<h1 style="font-size:20px;color:#102a43;margin:0 0 16px">Retard signalé sur « ${escapeHtml(project)} »</h1>`,
    `<p>${escapeHtml(greeting)}</p>`,
    `<p>${escapeHtml(reporter)} a signalé un retard de <strong>${days}</strong> sur <strong>${escapeHtml(task)}</strong>.</p>`,
    `<p><strong>Motif :</strong> ${escapeHtml(motif)}</p>`,
    `<p style="${bannerStyle};padding:12px;border-radius:8px">${banner}</p>`,
    '<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr><th align="left" style="padding:8px">Tâche</th><th align="left" style="padding:8px">Avant</th><th align="left" style="padding:8px">Après</th></tr></thead>',
    `<tbody>${rows}</tbody></table>`,
    `<p style="margin-top:24px"><a href="${escapeHtml(input.projectUrl)}" style="display:inline-block;background:#102a43;color:#ffffff;padding:14px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Ouvrir le chantier</a></p>`,
    '<p style="color:#5f7282;font-size:12px">Message automatique de Planora-IA.</p>',
    '</div>',
  ].join('')

  return { subject, html, text }
}
