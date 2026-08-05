# Security Policy

## Reporting a vulnerability

Email **security@aranis.ai**. Do not open a public issue — a public report exposes other
customers for as long as the fix takes.

Include enough to reproduce: the endpoint, the request, what you observed, and what you
expected. If you have a `request_id` from the response, send it; it lets us find the
exact request in our logs.

We acknowledge within two business days and keep you updated until the issue is closed.

## Scope

This repository holds the API contract, the SDK and examples. Findings in any of them
belong here.

Findings in the API service itself (api.aranis.ai) or the Aranis application also go to
security@aranis.ai.

## Handling your API keys

- Keys are bearer credentials. Anyone holding one has the access it was granted.
- Keep them on a server. The API sends no CORS header, so a key in a browser would not
  work — but it would still be exposed.
- Grant the narrowest scope set that does the job. `pii:read` in particular should only
  be on keys that genuinely need personal data.
- Rotate on any suspicion, and revoke in Settings → Integrations. Revocation is
  immediate.
- If you commit a key by accident, revoke it first and rewrite history second. Assume
  anything pushed to a public repository is already compromised.
