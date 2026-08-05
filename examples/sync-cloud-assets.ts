/**
 * Syncing a cloud inventory into Aranis.
 *
 *   ARANIS_API_KEY=ara_live_... npx tsx sync-cloud-assets.ts
 *
 * `PUT /v1/assets` is declarative: send the current state of your inventory and run it
 * as often as you like. The natural key is `(source, cloud_provider, external_id)`, so
 * the operation is idempotent by construction and needs no Idempotency-Key.
 *
 * Requires the `assets:write` scope.
 */

import { AranisClient, AranisApiError } from '@aranis/api'

const aranis = new AranisClient({ apiKey: process.env.ARANIS_API_KEY! })

/** Stand-in for whatever you actually call — describe_instances, a CMDB export, etc. */
async function fetchFromAws() {
  return [
    {
      external_id: 'i-0abc123',
      name: 'prod-api-01',
      asset_type: 'infrastructure' as const,
      technical_criticality: 'high' as const,
      exposure: 'exposed' as const,
      region: 'us-east-1',
      cloud_metadata: { instance_type: 'm5.large', vpc: 'vpc-0f1e2d' },
    },
    {
      external_id: 'i-0def456',
      name: 'prod-worker-01',
      asset_type: 'infrastructure' as const,
      technical_criticality: 'medium' as const,
      exposure: 'internal' as const,
      region: 'us-east-1',
    },
  ]
}

/** The endpoint accepts at most 500 items per request. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function main() {
  const inventory = await fetchFromAws()
  console.log(`Discovered ${inventory.length} assets.`)

  let created = 0
  let updated = 0
  const skipped: Array<{ external_id: string | null; reason: string }> = []

  for (const batch of chunk(inventory, 500)) {
    try {
      const result = await aranis.upsertAssets({
        source: 'cloud',
        cloud_provider: 'aws',
        assets: batch,
      })
      created += result.created ?? 0
      updated += result.updated ?? 0
      skipped.push(...(result.skipped ?? []))
    } catch (err) {
      if (err instanceof AranisApiError) {
        // A whole-batch rejection is a shape problem — a bad `source`, an oversized
        // batch — not one bad row. Individual bad rows come back in `skipped` instead.
        console.error(`Batch rejected (${err.code}): ${err.message}`)
        if (err.requestId) console.error(`request_id: ${err.requestId}`)
        process.exitCode = 1
        return
      }
      throw err
    }
  }

  console.log(`Created ${created}, updated ${updated}.`)

  // Worth surfacing rather than swallowing: these are assets your inventory has and
  // Aranis does not, which is exactly the drift a sync is supposed to remove.
  if (skipped.length > 0) {
    console.warn(`\n${skipped.length} asset(s) skipped:`)
    for (const item of skipped) {
      console.warn(`  ${item.external_id ?? '(no external_id)'}: ${item.reason}`)
    }
    process.exitCode = 1
  }

  // Note what the sync deliberately did not do: an asset someone reviewed and marked
  // `confirmed` in Aranis stays confirmed. A discovery run updates its attributes and
  // leaves the human decision alone.
  const confirmed = await aranis.collect(
    params => aranis.listAssets(params),
    { source: 'cloud', review_status: 'confirmed' }
  )
  console.log(`${confirmed.length} cloud asset(s) are human-confirmed.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
