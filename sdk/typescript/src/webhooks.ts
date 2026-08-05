/**
 * Webhook signature verification.
 *
 * The scheme is byte-for-byte Stripe's: `t=<unix>,v1=<hex hmac_sha256>` over
 * `"{t}.{raw_body}"`. If you already verify Stripe webhooks, the only change is the
 * header name.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

export const SIGNATURE_HEADER = 'Aranis-Signature'

/** Deliveries older than this are rejected as replays. */
export const DEFAULT_TOLERANCE_SECONDS = 300

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebhookVerificationError'
  }
}

export interface WebhookEvent<T = Record<string, unknown>> {
  event_id: string
  type: 'assessment.completed' | 'report.ready' | 'alert.created' | 'action_plan_item.status_changed'
  occurred_at: string
  organization_id: string
  data: T
}

function parseHeader(header: string): { timestamp: number; signatures: string[] } | null {
  let timestamp: number | null = null
  const signatures: string[] = []

  for (const part of header.split(',')) {
    const [key, value] = part.split('=', 2)
    if (!key || !value) continue
    if (key.trim() === 't') {
      const parsed = Number(value.trim())
      if (Number.isFinite(parsed)) timestamp = parsed
    } else if (key.trim() === 'v1') {
      signatures.push(value.trim())
    }
  }

  if (timestamp === null || signatures.length === 0) return null
  return { timestamp, signatures }
}

/**
 * Verifies a delivery and returns the parsed event.
 *
 * **`rawBody` must be the exact bytes you received.** Re-serializing parsed JSON
 * changes key order and whitespace, and the signature will not match. In Express, reach
 * for `express.raw({ type: 'application/json' })` on this route; in Next.js App Router,
 * `await request.text()`.
 *
 * @throws {WebhookVerificationError} on a bad signature, a stale timestamp, or an
 * unparseable body. Treat any throw as "do not process" — respond 400 and move on.
 */
export function verifyWebhook<T = Record<string, unknown>>(args: {
  rawBody: string
  signatureHeader: string | null | undefined
  secret: string
  toleranceSeconds?: number
  /** Injectable for tests. Seconds since the epoch. */
  now?: number
}): WebhookEvent<T> {
  const { rawBody, signatureHeader, secret } = args

  if (!signatureHeader) {
    throw new WebhookVerificationError(`Missing ${SIGNATURE_HEADER} header.`)
  }

  const parsed = parseHeader(signatureHeader)
  if (!parsed) {
    throw new WebhookVerificationError(`Malformed ${SIGNATURE_HEADER} header.`)
  }

  const now = args.now ?? Math.floor(Date.now() / 1000)
  const tolerance = args.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS

  // Checked before the HMAC so a replayed body never reaches the comparison.
  if (Math.abs(now - parsed.timestamp) > tolerance) {
    throw new WebhookVerificationError(
      `Timestamp outside the ${tolerance}s tolerance — treating as a replay.`
    )
  }

  const expected = createHmac('sha256', secret)
    .update(`${parsed.timestamp}.${rawBody}`)
    .digest()

  const matched = parsed.signatures.some(candidate => {
    const provided = Buffer.from(candidate, 'hex')
    return provided.length === expected.length && timingSafeEqual(provided, expected)
  })

  if (!matched) {
    throw new WebhookVerificationError('Signature does not match the expected value.')
  }

  try {
    return JSON.parse(rawBody) as WebhookEvent<T>
  } catch {
    throw new WebhookVerificationError('Body is not valid JSON.')
  }
}
