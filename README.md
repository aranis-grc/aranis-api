# Aranis API

The public contract for the [Aranis](https://aranis.ai) API — OpenAPI specification,
Postman collection, TypeScript SDK and runnable examples.

📖 **Documentation:** [developers.aranis.ai](https://developers.aranis.ai)

> This repository holds the **contract**, not the implementation. The API server is
> proprietary and lives elsewhere.

---

## What's here

| Path | |
|---|---|
| [`openapi.yaml`](./openapi.yaml) | OpenAPI 3.1 specification — the source of truth |
| [`postman/`](./postman) | Postman collection and environment, generated from the spec |
| [`sdk/typescript/`](./sdk/typescript) | `@aranis-ai/api` — the official TypeScript client |
| [`examples/`](./examples) | Runnable examples in TypeScript, Python and curl |

## Quick start

```bash
npm install @aranis-ai/api
```

```ts
import { AranisClient } from '@aranis-ai/api'

const aranis = new AranisClient({ apiKey: process.env.ARANIS_API_KEY! })

// Every supplier you have marked critical, across all pages.
for await (const supplier of aranis.paginate(
  params => aranis.listSuppliers(params),
  { criticality: 'critical' }
)) {
  console.log(supplier.name, supplier.vendor_profile)
}
```

Prefer raw HTTP:

```bash
curl https://api.aranis.ai/v1/suppliers?limit=5 \
  -H "Authorization: Bearer $ARANIS_API_KEY"
```

## Getting a key

Keys are created in the Aranis app under **Settings → Integrations**. The secret is
shown once, at creation.

The API is part of the **Enterprise** plan. A valid key on another plan receives
`403 plan_upgrade_required` — the credential is fine, the entitlement is not.

## Things worth knowing before you build

**It is server-to-server.** No response carries a CORS header and no preflight is
answered, so the API cannot be called from a browser. Your key belongs on your backend.

**The workspace comes from the key.** No endpoint accepts an organization identifier as
input, and none returns one. You cannot address another workspace's data, by accident or
otherwise.

**`pii:read` is additive.** Without it, personal fields are *absent from the payload* —
not null. An absent `email` means "this key may not see it"; a null `email` would mean
"this supplier has none". Do not treat them as the same thing.

**Pagination is cursor-based.** Pass `meta.next_cursor` back as `cursor`. Cursors are
opaque — do not construct or parse them. They stay correct while rows are being written,
which offsets do not.

**An empty collection is not an error.** It returns `200` with `meta.feature_status`
explaining why: `available` (you have no rows), `not_configured` (the feature exists but
this workspace has not set it up), or `coming_soon`. Never a 404, never a 500.

**Every `POST` needs an `Idempotency-Key`.** Replaying the same key with the same body
returns the original response; the same key with a different body is a `409`. Derive the
key from the record you are syncing — a random value per call defeats the point.

**`request_id` is on every response**, in the body of errors and in the `X-Request-Id`
header always. It is the first thing support will ask for.

## Rate limits

Per workspace:

| Window | Limit |
|---|---|
| 1 second | 60 requests |
| 1 minute | 600 requests |
| 1 hour | 5,000 requests |
| `GET /reports/{id}/pdf` | 60 per hour |

Every response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining` and
`X-RateLimit-Reset`. A `429` includes `Retry-After` in seconds. The SDK honours it
automatically.

## Webhooks

Four events: `assessment.completed`, `report.ready`, `alert.created`,
`action_plan_item.status_changed`.

Payloads are deliberately thin — ids and the minimum state. Fetch the full resource
through the API. That keeps sensitive data out of your endpoint's logs, keeps the
personal-data rules applying at read time, and means the event shape does not change
when a resource gains a field.

Delivery is **at-least-once**: deduplicate on `event_id`, which is stable across every
retry.

Signatures use the same scheme as Stripe, so an existing validator works with only the
header name changed:

```ts
import { verifyWebhook } from '@aranis-ai/api'

// rawBody must be the exact bytes received — re-serializing parsed JSON breaks the signature.
const event = verifyWebhook({
  rawBody,
  signatureHeader: req.headers['aranis-signature'],
  secret: process.env.ARANIS_WEBHOOK_SECRET!,
})
```

See [`examples/verify-webhook-express.ts`](./examples/verify-webhook-express.ts) and
[`examples/verify_webhook.py`](./examples/verify_webhook.py).

## What this API does not expose

Aranis' control catalogue — the control library, its framework crosswalks, CVE and MITRE
mappings, and the questionnaire pools — is not reachable through any endpoint, in any
version.

Two endpoints name a control: `/assessments/{id}/gaps` and `/action-plans/{id}/items`.
Both resolve a code and title for the one gap or item at hand. Neither can enumerate,
filter or page the catalogue.

Evidence file contents never leave the platform. With `evidence:read` you receive
metadata — file name, MIME type, SHA-256, review status, score — and nothing else.

## Versioning

The API is versioned in the path (`/v1`). Within a version we will add fields, add
endpoints and add enum values; we will not remove or rename a field, change a type, or
change the meaning of an existing value.

**Write forward-compatible clients:** ignore fields you do not recognise, and treat an
unknown enum value as a value you do not handle yet rather than an error.

Breaking changes ship as `/v2` with the previous version supported in parallel.
See [CHANGELOG.md](./CHANGELOG.md).

## Contributing

Corrections to the specification, the SDK and the examples are welcome — open an issue
or a pull request. Bugs in the API itself, and anything involving your workspace data,
go to [suporte@aranis.ai](mailto:suporte@aranis.ai).

**Never open a public issue for a security finding.** Write to
[security@aranis.ai](mailto:security@aranis.ai) instead. See [SECURITY.md](./SECURITY.md).

## License

The specification, SDK and examples are MIT licensed — see [LICENSE](./LICENSE). Use of
the Aranis API itself is governed by your agreement with Aranis.
