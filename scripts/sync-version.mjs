// Propagates the version from package.json into every other file that declares it.
//
// This repository states its version in four places, and until now nothing kept
// them together: the OpenAPI contract (`info.version`, which is what an
// integrator reads), the TypeScript SDK's package.json (what npm installs),
// VERSION (for anything that is not npm) and the root package.json (what
// changesets writes). Four hand-maintained copies of one number is three
// opportunities to publish a contract that claims a version it is not.
//
// Runs inside the release workflow, right after `changeset version`, so the
// propagation lands in the same "Version Packages" commit as the bump.
//
// Every target below is REQUIRED to match. A target that cannot be found is a
// hard failure and not a skip: a sync script that quietly syncs three of four
// files is worse than no script, because it reads as proof the files agree.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

// -- OpenAPI contract ---------------------------------------------------------
// Rewrites `version:` inside the `info:` block only. A blind search-and-replace
// on `version:` would also hit every other mapping that happens to carry one.
const specPath = join(root, 'openapi.yaml')
const lines = readFileSync(specPath, 'utf8').split('\n')
const infoAt = lines.findIndex((l) => /^info:\s*$/.test(l))
if (infoAt === -1) throw new Error('openapi.yaml: no top-level `info:` block')

let versionAt = -1
for (let i = infoAt + 1; i < lines.length; i++) {
  if (/^\S/.test(lines[i])) break // next top-level key: the info block ended
  if (/^\s+version:/.test(lines[i])) { versionAt = i; break }
}
if (versionAt === -1) throw new Error('openapi.yaml: `info.version` not found')

const indent = lines[versionAt].match(/^\s*/)[0]
lines[versionAt] = `${indent}version: "${version}"`
writeFileSync(specPath, lines.join('\n'))

// -- TypeScript SDK -----------------------------------------------------------
// The SDK is published from this repository and describes this contract, so it
// carries the contract's number rather than one of its own.
const sdkPath = join(root, 'sdk/typescript/package.json')
const sdk = JSON.parse(readFileSync(sdkPath, 'utf8'))
sdk.version = version
writeFileSync(sdkPath, JSON.stringify(sdk, null, 2) + '\n')

// -- Plain text ---------------------------------------------------------------
writeFileSync(join(root, 'VERSION'), `${version}\n`)

console.log(`openapi.yaml, sdk/typescript/package.json, VERSION -> ${version}`)
