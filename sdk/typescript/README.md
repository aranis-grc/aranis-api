# @aranis/api

Official TypeScript client for the [Aranis](https://aranis.ai) API — third-party risk,
cyber risk and privacy data from your workspace.

📖 [developers.aranis.ai](https://developers.aranis.ai) ·
📦 [Contract and examples](https://github.com/paulojoy/aranis-api)

```bash
npm install @aranis/api
```

## Quick start

```ts
import { AranisClient } from '@aranis/api'

const aranis = new AranisClient({ apiKey: process.env.ARANIS_API_KEY! })

// Walks every page for you — cursors are handled internally.
for await (const supplier of aranis.paginate(
  params => aranis.listSuppliers(params),
  { criticality: 'critical' }
)) {
  console.log(supplier.name, supplier.vendor_profile)
}
```

Keys are created in the Aranis app under **Settings → Integrations**. The API is part of
the Enterprise plan.

## Server-side only

The API sends no CORS header and answers no preflight, so it cannot be called from a
browser — and your key must never be shipped to one. Keep the client on your backend.

## What you get over plain `fetch`

**Types from the contract.** Every resource type is generated from the OpenAPI document,
and CI fails if regenerating produces a diff. The types cannot drift from the API.

**Cursor pagination.** `paginate()` is an async iterator over every page; `collect()`
gathers a small set into an array.

```ts
const critical = await aranis.collect(
  params => aranis.listSuppliers(params),
  { criticality: 'critical' }
)
```

**Typed errors.** Branch on `code`, never on the message.

```ts
import { AranisApiError } from '@aranis/api'

try {
  await aranis.createSupplier({ name: 'Acme', email: 'security@acme.com' }, 'crm-8842')
} catch (err) {
  if (err instanceof AranisApiError) {
    console.error(err.code, err.requestId)      // quote requestId to support
    if (err.code === 'validation_failed') console.error(err.fieldErrors)
  }
}
```

**Retries that respect the server.** `429` and `5xx` are retried honouring `Retry-After`.
Writes are safe to retry because every `POST` carries an `Idempotency-Key`.

## Idempotency

`createSupplier` and `createAssessment` require an idempotency key. Derive it from the
record you are syncing — a CRM id, a row id, a job id. A fresh UUID per call defeats the
mechanism entirely: the retry after a timeout gets a new key and creates a duplicate,
which is the thing the header exists to prevent.

## Webhooks

Signatures use the same scheme as Stripe, so an existing validator works with only the
header name changed.

```ts
import { verifyWebhook, WebhookVerificationError } from '@aranis/api'

try {
  const event = verifyWebhook({
    rawBody,                                   // the exact bytes received
    signatureHeader: req.header('Aranis-Signature'),
    secret: process.env.ARANIS_WEBHOOK_SECRET!,
  })
} catch (err) {
  if (err instanceof WebhookVerificationError) return res.status(400).send('invalid')
  throw err
}
```

Two things that trip people up, both of which the
[Express example](https://github.com/paulojoy/aranis-api/blob/main/examples/verify-webhook-express.ts)
handles:

- **Use the raw body.** Re-serializing parsed JSON changes the bytes and the signature
  will never match.
- **Acknowledge before processing.** Delivery times out after 5 seconds, and ten
  consecutive failures disable your endpoint.

Delivery is at-least-once — deduplicate on `event_id`, which is stable across retries.

## Personal data

`pii:read` is additive: it grants nothing on its own, it only un-redacts personal fields
on resources another scope already allows. Without it those fields are **absent from the
payload**, not null.

Check `'email' in supplier`, not `supplier.email !== null`. An absent field means "this
key may not see it"; a null field would mean "this supplier has none".

## Options

```ts
new AranisClient({
  apiKey: process.env.ARANIS_API_KEY!,
  timeoutMs: 30_000,   // per request
  maxRetries: 2,       // on 429 and 5xx
  fetch: customFetch,  // undici, a proxy agent, a test double
})
```

## Requirements

Node 18 or newer (uses the global `fetch`). ESM only.

## License

MIT — see [LICENSE](./LICENSE). Use of the Aranis API itself is governed by your
agreement with Aranis.
