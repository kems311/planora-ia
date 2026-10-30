export interface SendEmailInput {
  to: string
  subject: string
  html: string
  text: string
  idempotencyKey: string
}

export interface SendEmailResult {
  ok: boolean
  error?: string
}

/** Envoi via l’API REST de Resend. À appeler uniquement côté serveur (la clé ne doit jamais atteindre le navigateur). */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY absente' }
  const from = process.env.EMAIL_FROM || 'Planora-IA <onboarding@resend.dev>'
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html, text: input.text }),
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) {
      const body = await response.text()
      return { ok: false, error: `Resend ${response.status} : ${body.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Envoi impossible' }
  }
}
