/**
 * `@aranis-ai/api` — the official TypeScript client for the Aranis API.
 *
 * ```ts
 * import { AranisClient } from '@aranis-ai/api'
 *
 * const aranis = new AranisClient({ apiKey: process.env.ARANIS_API_KEY! })
 *
 * for await (const supplier of aranis.paginate(p => aranis.listSuppliers(p), { criticality: 'critical' })) {
 *   console.log(supplier.name)
 * }
 * ```
 *
 * The API is server-to-server. Keep the key on your backend — it is never safe in a
 * browser, and the API sends no CORS header, so it would not work there anyway.
 */

export { AranisClient } from './client.js'
export type { AranisClientOptions, ListParams } from './client.js'

export { AranisApiError } from './errors.js'
export type { AranisErrorCode } from './errors.js'

export {
  verifyWebhook,
  WebhookVerificationError,
  SIGNATURE_HEADER,
  DEFAULT_TOLERANCE_SECONDS,
} from './webhooks.js'
export type { WebhookEvent } from './webhooks.js'

export type * from './types.js'
