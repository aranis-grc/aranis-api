# curl recipes

Every example assumes:

```bash
export ARANIS_API_KEY=ara_live_...
export ARANIS=https://api.aranis.ai/v1
```

## List critical suppliers

```bash
curl -s "$ARANIS/suppliers?criticality=critical&limit=10" \
  -H "Authorization: Bearer $ARANIS_API_KEY" | jq '.data[] | {name, vendor_profile}'
```

## Walk every page

`meta.next_cursor` goes back in as `cursor`. It is opaque — do not build one yourself.

```bash
cursor=""
while :; do
  page=$(curl -s "$ARANIS/suppliers?limit=100&cursor=$cursor" \
    -H "Authorization: Bearer $ARANIS_API_KEY")
  echo "$page" | jq -r '.data[].name'
  cursor=$(echo "$page" | jq -r '.meta.next_cursor // empty')
  [ -z "$cursor" ] && break
done
```

## Assessments expiring in the next 30 days

```bash
cutoff=$(date -u -d '+30 days' +%Y-%m-%dT%H:%M:%SZ)
curl -s "$ARANIS/assessments?status=completed&expires_before=$cutoff" \
  -H "Authorization: Bearer $ARANIS_API_KEY" | jq '.data[] | {id, supplier_id, expires_at}'
```

## High-severity gaps for one assessment

```bash
curl -s "$ARANIS/assessments/$ASSESSMENT_ID/gaps?severity=high" \
  -H "Authorization: Bearer $ARANIS_API_KEY" \
  | jq '.data[] | {control_code, control_title, evidence_status}'
```

## Download a report PDF

The endpoint answers `302` with a URL signed for five minutes. `-L` follows it.

```bash
curl -sL "$ARANIS/reports/$REPORT_ID/pdf" \
  -H "Authorization: Bearer $ARANIS_API_KEY" -o report.pdf
```

## Create a supplier

`Idempotency-Key` is required on every POST. Derive it from the record you are syncing —
a fresh UUID per call means a retry creates a duplicate, which is the thing the header
exists to prevent.

```bash
curl -s -X POST "$ARANIS/suppliers" \
  -H "Authorization: Bearer $ARANIS_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: crm-vendor-8842" \
  -d '{
    "name": "Acme Cloud Inc",
    "domain": "acme.com",
    "email": "security@acme.com",
    "criticality": "high",
    "vendor_profile": "P2"
  }'
```

Send it twice and you get the same supplier back, created once.

## Mark an action plan item complete

```bash
curl -s -X PATCH "$ARANIS/action-plan-items/$ITEM_ID" \
  -H "Authorization: Bearer $ARANIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed", "note": "Evidence attached in ticket SEC-1042"}'
```

## Pull audit logs into a SIEM

```bash
since=$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)
curl -s "$ARANIS/audit-logs?from=$since&limit=200" \
  -H "Authorization: Bearer $ARANIS_API_KEY" | jq -c '.data[]'
```

## Read the rate limit budget

Present on every response, not just 429s.

```bash
curl -sD - -o /dev/null "$ARANIS/suppliers?limit=1" \
  -H "Authorization: Bearer $ARANIS_API_KEY" | grep -i 'x-ratelimit\|x-request-id'
```

## Inspect an error

```bash
curl -s "$ARANIS/suppliers?status=nonsense" \
  -H "Authorization: Bearer $ARANIS_API_KEY" | jq
```

```json
{
  "error": {
    "code": "invalid_request",
    "message": "`status` must be one of: active, inactive, pending.",
    "request_id": "req_01J8Z9K2M4N6P8Q0R2S4T6V8"
  }
}
```

Branch on `code`, never on `message`. Quote `request_id` to support.
