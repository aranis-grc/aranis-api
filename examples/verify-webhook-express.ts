/**
 * Receiving Aranis webhooks in Express.
 *
 *   npm install express @aranis-ai/api
 *   ARANIS_WEBHOOK_SECRET=whsec_... npx tsx verify-webhook-express.ts
 *
 * The two things that trip people up are both here:
 *   1. You need the **raw body**. `express.json()` parses and discards it, and a
 *      re-serialized body has different bytes, so the signature will never match.
 *   2. Acknowledge fast. The delivery times out after 5 seconds — do the real work
 *      after responding, not before.
 */

import express from 'express'
import { verifyWebhook, WebhookVerificationError, AranisClient } from '@aranis-ai/api'

const app = express()
const secret = process.env.ARANIS_WEBHOOK_SECRET!
const aranis = new AranisClient({ apiKey: process.env.ARANIS_API_KEY! })

// Deduplication store. At-least-once delivery means the same event_id can arrive more
// than once — on a retry, or if our worker restarts mid-flight. In production this
// belongs in Redis or a table with a unique index, not in memory.
const processed = new Set<string>()

app.post(
  '/webhooks/aranis',
  // Raw body on this route only; the rest of the app can still use express.json().
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    let event
    try {
      event = verifyWebhook({
        rawBody: req.body.toString('utf8'),
        signatureHeader: req.header('Aranis-Signature'),
        secret,
      })
    } catch (err) {
      if (err instanceof WebhookVerificationError) {
        // 400, not 500: a bad signature is not something a retry can fix, and 5xx would
        // make Aranis retry it five times.
        console.warn('[aranis] rejected delivery:', err.message)
        return res.status(400).send('invalid signature')
      }
      throw err
    }

    // Acknowledge before doing the work. Anything slow here risks the 5s timeout, and a
    // timeout is recorded as a failure — ten consecutive failures disable the endpoint.
    res.status(200).send('ok')

    if (processed.has(event.event_id)) {
      console.log('[aranis] duplicate, skipping:', event.event_id)
      return
    }
    processed.add(event.event_id)

    try {
      await handle(event)
    } catch (err) {
      // We already returned 200, so Aranis will not retry. Your own retry belongs here.
      console.error('[aranis] handler failed:', event.event_id, err)
    }
  }
)

async function handle(event: Awaited<ReturnType<typeof verifyWebhook>>) {
  switch (event.type) {
    case 'assessment.completed': {
      const { assessment_id } = event.data as { assessment_id: string }
      // The payload carries ids only — fetch what you need.
      const assessment = await aranis.getAssessment(assessment_id)
      const gaps = await aranis.listAssessmentGaps(assessment_id, { severity: 'high' })
      console.log(
        `[aranis] assessment ${assessment_id} completed, score ${
          (assessment.scores as { overall?: number } | null)?.overall ?? 'n/a'
        }, ${gaps.data.length} high-severity gaps`
      )
      break
    }

    case 'report.ready': {
      const { report_id } = event.data as { report_id: string }
      const url = await aranis.reportPdfUrl(report_id)
      // Signed for five minutes — download now, do not store the URL.
      console.log('[aranis] report ready:', report_id, url.slice(0, 60) + '…')
      break
    }

    case 'alert.created': {
      const { alert_id, severity, scope } = event.data as Record<string, string>
      console.log(`[aranis] ${severity} ${scope} alert ${alert_id}`)
      break
    }

    case 'action_plan_item.status_changed': {
      const { action_plan_item_id, status, previous_status } = event.data as Record<string, string>
      console.log(`[aranis] item ${action_plan_item_id}: ${previous_status} → ${status}`)
      break
    }

    default:
      // Forward compatible: a new event type is not an error.
      console.log('[aranis] unhandled event type:', (event as { type: string }).type)
  }
}

app.listen(3000, () => console.log('listening on :3000'))
