// The Postman collection covers every operation of openapi.yaml, keeps auth at
// the collection level, and carries no real key. Moved verbatim from the inline
// step of .github/workflows/validate.yml (SCRUM-957).
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'

const spec = yaml.load(readFileSync('openapi.yaml', 'utf8'))
const raw = readFileSync('postman/aranis-api.postman_collection.json', 'utf8')
const col = JSON.parse(raw)
const METHODS = ['get', 'post', 'put', 'patch', 'delete']
const ops = Object.entries(spec.paths).flatMap(([p, item]) =>
  Object.keys(item).filter((m) => METHODS.includes(m)).map((m) => m.toUpperCase() + ' ' + p))
const reqs = col.item.flatMap((f) => f.item)
if (reqs.length !== ops.length) {
  console.error('collection has ' + reqs.length + ' requests, spec has ' + ops.length + ' operations')
  console.error('run: npx tsx scripts/generate-postman-collection.ts in the SaaS repo, then re-sync')
  process.exit(1)
}
// Auth must stay on the collection. Per-request auth is how a collection ends
// up with a real key pasted into one request and committed.
if (col.auth?.type !== 'bearer' || col.auth.bearer[0].value !== '{{apiKey}}') {
  console.error('collection auth must be bearer {{apiKey}} at the collection level')
  process.exit(1)
}
// A committed collection must never carry a real credential.
if (/ara_live_[A-Za-z0-9]{10,}/.test(raw)) {
  console.error('collection contains what looks like a real API key')
  process.exit(1)
}
console.log('collection covers all ' + ops.length + ' operations')
