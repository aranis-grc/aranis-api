/**
 * Error types for the Aranis API client.
 *
 * Every failure the API reports arrives as an `AranisApiError` carrying the machine
 * code, the request id, and any per-field detail. Catch on `code`, never on the message
 * — messages are written for humans and will change.
 */

export type AranisErrorCode =
  | 'invalid_request'
  | 'invalid_api_key'
  | 'plan_upgrade_required'
  | 'insufficient_scope'
  | 'resource_not_found'
  | 'conflict'
  | 'validation_failed'
  | 'rate_limit_exceeded'
  | 'internal_error'
  /** The client could not reach the API, or the response was not JSON. */
  | 'network_error'

export class AranisApiError extends Error {
  readonly code: AranisErrorCode
  readonly status: number
  /** Quote this to Aranis support. Present on every response, success or failure. */
  readonly requestId: string | null
  readonly details?: Record<string, unknown>
  /** Seconds to wait, on a 429. */
  readonly retryAfter?: number

  constructor(args: {
    code: AranisErrorCode
    message: string
    status: number
    requestId?: string | null
    details?: Record<string, unknown>
    retryAfter?: number
  }) {
    super(args.message)
    this.name = 'AranisApiError'
    this.code = args.code
    this.status = args.status
    this.requestId = args.requestId ?? null
    this.details = args.details
    this.retryAfter = args.retryAfter
  }

  /** True when retrying the identical request could plausibly succeed. */
  get isRetryable(): boolean {
    return this.code === 'rate_limit_exceeded' || this.status >= 500
  }

  /**
   * Field-level messages from a 422, keyed by field name. Empty for every other error,
   * so it is safe to read without checking the code first.
   */
  get fieldErrors(): Record<string, string> {
    const fields = (this.details as { fields?: Record<string, string> } | undefined)?.fields
    return fields ?? {}
  }
}
