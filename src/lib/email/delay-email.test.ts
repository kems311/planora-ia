import { describe, expect, it } from 'vitest'
import { buildDelayEmail, type DelayEmailInput } from './delay-email'

const base: DelayEmailInput = {
  recipientName: 'Karim',
  reporterName: 'Kemal',
  projectName: 'Maison Martin',
  taskName: 'B',
  delayDays: 2,
  motif: 'Pluie',
  changes: [
    { id: 'b', name: 'B', before: { start: '2026-10-28', finish: '2026-10-30' }, after: { start: '2026-10-28', finish: '2026-11-03' }, finishShiftWorkingDays: 2 },
    { id: 'd', name: 'D', before: { start: '2026-11-02', finish: '2026-11-02' }, after: { start: '2026-11-04', finish: '2026-11-04' }, finishShiftWorkingDays: 2 },
  ],
  projectFinishBefore: '2026-11-02',
  projectFinishAfter: '2026-11-04',
  projectUrl: 'http://localhost:3000/chantiers/abc',
}

describe('email de retard', () => {
  it('indique l’ancienne et la nouvelle fin du chantier', () => {
    const email = buildDelayEmail(base)
    expect(email.subject).toContain('mercredi 4 novembre 2026')
    expect(email.html).toContain('mercredi 4 novembre 2026')
    expect(email.html).toContain('lundi 2 novembre 2026')
    expect(email.text).toContain('Motif : Pluie')
    expect(email.text).toContain('Bonjour Karim,')
    expect(email.text).toContain('2 jours ouvrés')
    expect(email.text).toContain('http://localhost:3000/chantiers/abc')
  })

  it('liste les anciennes et nouvelles dates de chaque tâche', () => {
    const email = buildDelayEmail(base)
    expect(email.text).toContain('- B : début')
    expect(email.text).toContain('- D : début')
    expect(email.html).toContain('<s>')
  })

  it('signale une fin de chantier inchangée', () => {
    const email = buildDelayEmail({
      ...base,
      delayDays: 1,
      changes: [base.changes[0]],
      projectFinishAfter: base.projectFinishBefore,
    })
    expect(email.subject).toContain('inchangée')
    expect(email.text).toContain('inchangée')
    expect(email.text).toContain('1 jour ouvré ')
  })

  it('protège le HTML contre le contenu saisi par les utilisateurs', () => {
    const email = buildDelayEmail({ ...base, motif: '<script>alert(1)</script>', taskName: '<b>x</b>' })
    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&lt;script&gt;')
    expect(email.html).not.toContain('<b>x</b>')
  })
})
