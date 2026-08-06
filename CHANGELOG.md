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
