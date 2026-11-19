# Changelog

All notable changes to the Aranis API contract are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Within a major version we add fields, endpoints and enum values; we do not remove or
rename fields, change types, or change the meaning of existing values.

## [1.0.0] — unreleased

First public version.

### Added

- 27 resources across suppliers, assessments, reports, assets, business context, risks,
  action plans, alerts, audit logs and webhooks.
- Four write endpoints: create supplier, create assessment, bulk upsert assets, update
  an action plan item's status.
- Four webhook events with HMAC-SHA256 signatures and at-least-once delivery.
- `@aranis-ai/api` TypeScript SDK.
- Postman collection and environment.

### Changed

The write endpoints now follow the same rules as the Aranis app. These rules were
applied before 1.0.0 was released, when no integration had written through the API yet.

- `PATCH /v1/action-plan-items/{id}`: an item becomes `completed` only after at least
  one of its evidences is approved; otherwise the response is `409 conflict` with
  `details.reason = evidence_required`. When every item of a plan reaches a final status,
  the plan is completed. The `action_plan_item.status_changed` event gains
  `plan_completed`.
- `POST /v1/suppliers`: when `domain` is omitted, it is taken from `email`, unless the
  address belongs to a free mail provider. The duplicate-domain check ignores case.
- `POST /v1/assessments`: a `supplier` assessment requires `vendor_profile` (P1, P2 or
  P3) and one to ten `respondent_emails`. A `deadline` must be in the future. A supplier
  with an open assessment (draft, sent or in progress) is refused with `409` and
  `details.existing_assessment_id`. Self-assessments are unchanged.
- `GET /v1/risk-scores`: the organizational score is now a **risk** score, 0–100, where
  higher is worse: the weighted mean of six pillars (`cyber`, `tprm`, `privacy`,
  `continuity`, `ai`, `human`), counting only the pillars that have data. Each point has
  `methodology_version` (`2` for the new score, `1` for earlier points, which stay in the
  history unchanged) and `pillars` with score, base and weight per pillar. `score_tprm`,
  `score_cyber`, `score_ai` and `score_human` are deprecated and keep their version 1
  meaning; read `pillars` instead. Do not compare scores of different versions.
