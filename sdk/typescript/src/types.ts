/**
 * Public type aliases.
 *
 * Every shape here is derived from `generated.ts`, which `npm run generate` produces
 * directly from `openapi.yaml`. Nothing is hand-typed, so a field cannot drift from the
 * published contract — regenerating is the only way these change.
 */

import type { components } from './generated.js'

type Schemas = components['schemas']

// ── envelopes ────────────────────────────────────────────────────────────────

export interface CollectionMeta {
  has_more: boolean
  next_cursor: string | null
  feature_status: 'available' | 'not_configured' | 'coming_soon'
  /** Present when `feature_status` is not `available` — explains why the page is empty. */
  message?: string
}

export interface Collection<T> {
  data: T[]
  meta: CollectionMeta
  /** Currency for every monetary field in this response. Always `USD` today. */
  currency?: string
}

// ── resources ────────────────────────────────────────────────────────────────

export type Supplier = Schemas['Supplier']
export type Assessment = Schemas['Assessment']
export type Gap = Schemas['Gap']
export type Report = Schemas['Report']
export type Asset = Schemas['Asset']
export type AssetUpsertResult = Schemas['AssetUpsertResult']
export type BusinessProcess = Schemas['BusinessProcess']
export type ProductService = Schemas['ProductService']
export type ProcessingActivity = Schemas['ProcessingActivity']
export type BiaAssessment = Schemas['BiaAssessment']
export type Threat = Schemas['Threat']
export type Risk = Schemas['Risk']
export type RiskTreatment = Schemas['RiskTreatment']
export type RiskScoreSeries = Schemas['RiskScoreSeries']
export type RiskAcceptanceLetter = Schemas['RiskAcceptanceLetter']
export type ActionPlan = Schemas['ActionPlan']
export type ActionPlanItem = Schemas['ActionPlanItem']
export type Alert = Schemas['Alert']
export type Insight = Schemas['Insight']
export type AuditLog = Schemas['AuditLog']
export type WebhookEndpoint = Schemas['WebhookEndpoint']
export type WebhookDelivery = Schemas['WebhookDelivery']

/** A row from `/risk-matrix`. Discriminate on `scope`. */
export type RiskMatrixRow = Schemas['CyberRiskMatrixRow'] | Schemas['OrganizationalRiskMatrixRow']

// ── enums ────────────────────────────────────────────────────────────────────

export type Criticality = Schemas['Criticality']
export type SupplierStatus = Schemas['SupplierStatus']
export type SupplierSize = Schemas['SupplierSize']
export type RiskGroup = Schemas['RiskGroup']
export type VendorProfile = Schemas['VendorProfile']
export type AssessmentStatus = Schemas['AssessmentStatus']
export type AssessmentType = Schemas['AssessmentType']
export type AssessmentDecision = Schemas['AssessmentDecision']
export type AssetType = Schemas['AssetType']
export type Exposure = Schemas['Exposure']
export type AssetSource = Schemas['AssetSource']
export type CloudProvider = Schemas['CloudProvider']
export type ReviewStatus = Schemas['ReviewStatus']
export type ThreatSeverity = Schemas['ThreatSeverity']
export type RiskCategory = Schemas['RiskCategory']
export type RiskBand = Schemas['RiskBand']
export type AlertSeverity = Schemas['AlertSeverity']
export type InsightCategory = Schemas['InsightCategory']
export type ActionPlanItemStatus = Schemas['ActionPlanItemStatus']
export type DeliveryStatus = Schemas['DeliveryStatus']
export type WebhookEventType = Schemas['WebhookEvent']

// ── request bodies ───────────────────────────────────────────────────────────

export type SupplierCreate = Schemas['SupplierCreate']
export type AssessmentCreate = Schemas['AssessmentCreate']
export type AssetUpsert = Schemas['AssetUpsert']
export type ActionPlanItemUpdate = Schemas['ActionPlanItemUpdate']

/**
 * The full set of scopes a key can carry. `pii:read` is additive — it grants nothing on
 * its own, it only un-redacts personal fields on resources another scope already allows.
 */
export type ApiScope =
  | 'suppliers:read' | 'suppliers:write'
  | 'assessments:read' | 'assessments:write'
  | 'reports:read'
  | 'assets:read' | 'assets:write'
  | 'risks:read'
  | 'action-plans:read' | 'action-plans:write'
  | 'alerts:read'
  | 'context:read'
  | 'evidence:read'
  | 'audit:read'
  | 'webhooks:read'
  | 'pii:read'
