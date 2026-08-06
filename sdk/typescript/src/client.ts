/**
 * The Aranis API client.
 *
 * A thin, typed wrapper over `fetch`. It does four things you would otherwise write
 * yourself: attaches the bearer token, turns error bodies into typed exceptions,
 * respects `Retry-After` on 429, and walks cursors for you.
 */

import { AranisApiError, type AranisErrorCode } from './errors.js'
import type {
  Alert, ActionPlan, ActionPlanItem, Asset, AssetUpsertResult, Assessment, AuditLog,
  BiaAssessment, BusinessProcess, Collection, Gap, Insight, ProcessingActivity,
  ProductService, Report, Risk, RiskAcceptanceLetter, RiskMatrixRow, RiskScoreSeries,
  RiskTreatment, Supplier, Threat, WebhookDelivery, WebhookEndpoint,
} from './types.js'

export interface AranisClientOptions {
  /** A key from Aranis → Settings → Integrations. */
  apiKey: string
  /** Override only for testing against a non-production host. */
  baseUrl?: string
  /** Per-request timeout in milliseconds. Default 30_000. */
  timeoutMs?: number
  /**
   * How many times to retry a 429 or 5xx, honouring `Retry-After`. Default 2.
   * Writes are retried too — they are protected by `Idempotency-Key`.
   */
  maxRetries?: number
  /** Swap in a custom fetch (undici, a proxy agent, a test double). */
  fetch?: typeof globalThis.fetch
}

type QueryValue = string | number | boolean | undefined | null

export interface ListParams {
  limit?: number
  cursor?: string
  [key: string]: QueryValue
}

const DEFAULT_BASE_URL = 'https://api.aranis.ai/v1'

export class AranisClient {
  readonly #apiKey: string
  readonly #baseUrl: string
  readonly #timeoutMs: number
  readonly #maxRetries: number
  readonly #fetch: typeof globalThis.fetch

  constructor(options: AranisClientOptions) {
    if (!options.apiKey) {
      throw new Error('AranisClient: apiKey is required.')
    }
    this.#apiKey = options.apiKey
    this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    this.#timeoutMs = options.timeoutMs ?? 30_000
    this.#maxRetries = options.maxRetries ?? 2
    this.#fetch = options.fetch ?? globalThis.fetch
  }

  // ── transport ──────────────────────────────────────────────────────────────

  async #request<T>(
    method: string,
    path: string,
    options: { query?: ListParams; body?: unknown; idempotencyKey?: string } = {}
  ): Promise<T> {
    const url = new URL(this.#baseUrl + path)
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.#apiKey}`,
      Accept: 'application/json',
      'User-Agent': '@aranis-ai/api-node',
    }
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey

    let lastError: AranisApiError | undefined

    for (let attempt = 0; attempt <= this.#maxRetries; attempt++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.#timeoutMs)

      try {
        const response = await this.#fetch(url.toString(), {
          method,
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: controller.signal,
          // The API is server-to-server; a redirect only happens on the PDF endpoint,
          // which is handled explicitly by reportPdfUrl().
          redirect: 'follow',
        })

        if (response.ok) {
          if (response.status === 204) return undefined as T
          return (await response.json()) as T
        }

        lastError = await this.#toError(response)
        if (!lastError.isRetryable || attempt === this.#maxRetries) throw lastError

        // Honour Retry-After when the server sends it; otherwise back off gently.
        const waitMs = (lastError.retryAfter ?? 2 ** attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, waitMs))
      } catch (err) {
        if (err instanceof AranisApiError) {
          if (!err.isRetryable || attempt === this.#maxRetries) throw err
          lastError = err
          continue
        }
        // Network failure or timeout.
        const wrapped = new AranisApiError({
          code: 'network_error',
          message: err instanceof Error ? err.message : 'Request failed',
          status: 0,
        })
        if (attempt === this.#maxRetries) throw wrapped
        lastError = wrapped
        await new Promise(resolve => setTimeout(resolve, 2 ** attempt * 1000))
      } finally {
        clearTimeout(timer)
      }
    }

    throw lastError ?? new AranisApiError({ code: 'network_error', message: 'Request failed', status: 0 })
  }

  async #toError(response: Response): Promise<AranisApiError> {
    const requestId = response.headers.get('X-Request-Id')
    const retryAfterHeader = response.headers.get('Retry-After')
    const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : undefined

    let code: AranisErrorCode = 'internal_error'
    let message = `Request failed with status ${response.status}`
    let details: Record<string, unknown> | undefined

    try {
      const body = (await response.json()) as {
        error?: { code?: AranisErrorCode; message?: string; details?: Record<string, unknown> }
      }
      if (body.error?.code) code = body.error.code
      if (body.error?.message) message = body.error.message
      details = body.error?.details
    } catch {
      // Non-JSON body — keep the status-derived defaults.
    }

    return new AranisApiError({ code, message, status: response.status, requestId, details, retryAfter })
  }

  // ── pagination ─────────────────────────────────────────────────────────────

  /**
   * Walks every page of a collection, yielding one item at a time.
   *
   * ```ts
   * for await (const supplier of client.paginate(p => client.listSuppliers(p))) {
   *   console.log(supplier.name)
   * }
   * ```
   *
   * Prefer this over incrementing an offset: cursors stay correct while rows are being
   * written underneath you, which offsets do not.
   */
  async *paginate<T>(
    fetchPage: (params: ListParams) => Promise<Collection<T>>,
    params: ListParams = {}
  ): AsyncGenerator<T, void, undefined> {
    let cursor: string | undefined = params.cursor
    do {
      const page: Collection<T> = await fetchPage({ ...params, cursor })
      for (const item of page.data) yield item
      cursor = page.meta.next_cursor ?? undefined
    } while (cursor)
  }

  /** Collects every page into one array. Only for sets you know are small. */
  async collect<T>(
    fetchPage: (params: ListParams) => Promise<Collection<T>>,
    params: ListParams = {}
  ): Promise<T[]> {
    const out: T[] = []
    for await (const item of this.paginate(fetchPage, params)) out.push(item)
    return out
  }

  // ── suppliers ──────────────────────────────────────────────────────────────

  listSuppliers(params: ListParams = {}) {
    return this.#request<Collection<Supplier>>('GET', '/suppliers', { query: params })
  }

  getSupplier(id: string) {
    return this.#request<Supplier & { assessment_count: number }>('GET', `/suppliers/${id}`)
  }

  /**
   * `idempotencyKey` must be stable for a given logical creation. Derive it from the
   * record you are syncing — a random value per call defeats the protection.
   */
  createSupplier(body: Record<string, unknown>, idempotencyKey: string) {
    return this.#request<Supplier>('POST', '/suppliers', { body, idempotencyKey })
  }

  // ── assessments ────────────────────────────────────────────────────────────

  listAssessments(params: ListParams = {}) {
    return this.#request<Collection<Assessment>>('GET', '/assessments', { query: params })
  }

  getAssessment(id: string) {
    return this.#request<Assessment>('GET', `/assessments/${id}`)
  }

  listAssessmentGaps(id: string, params: ListParams = {}) {
    return this.#request<Collection<Gap>>('GET', `/assessments/${id}/gaps`, { query: params })
  }

  createAssessment(body: Record<string, unknown>, idempotencyKey: string) {
    return this.#request<Assessment>('POST', '/assessments', { body, idempotencyKey })
  }

  // ── reports ────────────────────────────────────────────────────────────────

  listReports(params: ListParams = {}) {
    return this.#request<Collection<Report>>('GET', '/reports', { query: params })
  }

  getReport(id: string) {
    return this.#request<Report>('GET', `/reports/${id}`)
  }

  /**
   * Resolves the signed download URL without following the redirect, so you can stream
   * it or hand it to another process. The URL expires in five minutes.
   */
  async reportPdfUrl(id: string): Promise<string> {
    const response = await this.#fetch(`${this.#baseUrl}/reports/${id}/pdf`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.#apiKey}` },
      redirect: 'manual',
    })

    const location = response.headers.get('Location')
    if (location) return location

    throw await this.#toError(response)
  }

  // ── assets ─────────────────────────────────────────────────────────────────

  listAssets(params: ListParams = {}) {
    return this.#request<Collection<Asset>>('GET', '/assets', { query: params })
  }

  /**
   * Declarative sync. Idempotent by construction — the natural key is
   * `(source, cloud_provider, external_id)` — so no Idempotency-Key is needed.
   * Maximum 500 items; split larger inventories yourself.
   */
  upsertAssets(body: {
    source: 'manual' | 'cloud'
    cloud_provider?: 'aws' | 'gcp' | 'azure' | 'oci'
    assets: Array<Record<string, unknown>>
  }) {
    return this.#request<AssetUpsertResult>('PUT', '/assets', { body })
  }

  // ── context ────────────────────────────────────────────────────────────────

  listBusinessProcesses(params: ListParams = {}) {
    return this.#request<Collection<BusinessProcess>>('GET', '/business-processes', { query: params })
  }

  listProductsServices(params: ListParams = {}) {
    return this.#request<Collection<ProductService>>('GET', '/products-services', { query: params })
  }

  listProcessingActivities(params: ListParams = {}) {
    return this.#request<Collection<ProcessingActivity>>('GET', '/processing-activities', { query: params })
  }

  listBiaAssessments(params: ListParams = {}) {
    return this.#request<Collection<BiaAssessment>>('GET', '/bia', { query: params })
  }

  listThreats(params: ListParams = {}) {
    return this.#request<Collection<Threat>>('GET', '/threats', { query: params })
  }

  // ── risks ──────────────────────────────────────────────────────────────────

  listRisks(params: ListParams = {}) {
    return this.#request<Collection<Risk>>('GET', '/risks', { query: params })
  }

  listRiskTreatments(riskId: string) {
    return this.#request<Collection<RiskTreatment>>('GET', `/risks/${riskId}/treatments`)
  }

  getRiskScores(params: ListParams = {}) {
    return this.#request<Collection<RiskScoreSeries>>('GET', '/risk-scores', { query: params })
  }

  getRiskMatrix(params: ListParams = {}) {
    return this.#request<Collection<RiskMatrixRow>>('GET', '/risk-matrix', { query: params })
  }

  listRiskAcceptances(params: ListParams = {}) {
    return this.#request<Collection<RiskAcceptanceLetter>>('GET', '/risk-acceptances', { query: params })
  }

  // ── action plans ───────────────────────────────────────────────────────────

  listActionPlans(params: ListParams = {}) {
    return this.#request<Collection<ActionPlan>>('GET', '/action-plans', { query: params })
  }

  listActionPlanItems(planId: string, params: ListParams = {}) {
    return this.#request<Collection<ActionPlanItem>>('GET', `/action-plans/${planId}/items`, { query: params })
  }

  updateActionPlanItem(itemId: string, body: { status: string; note?: string }) {
    return this.#request<ActionPlanItem>('PATCH', `/action-plan-items/${itemId}`, { body })
  }

  // ── alerts, insights, audit ────────────────────────────────────────────────

  listAlerts(params: ListParams = {}) {
    return this.#request<Collection<Alert>>('GET', '/alerts', { query: params })
  }

  listInsights(params: ListParams = {}) {
    return this.#request<Collection<Insight>>('GET', '/insights', { query: params })
  }

  listAuditLogs(params: ListParams = {}) {
    return this.#request<Collection<AuditLog>>('GET', '/audit-logs', { query: params })
  }

  // ── webhooks ───────────────────────────────────────────────────────────────

  listWebhookEndpoints(params: ListParams = {}) {
    return this.#request<Collection<WebhookEndpoint>>('GET', '/webhook-endpoints', { query: params })
  }

  listWebhookDeliveries(params: ListParams = {}) {
    return this.#request<Collection<WebhookDelivery>>('GET', '/webhook-deliveries', { query: params })
  }
}
