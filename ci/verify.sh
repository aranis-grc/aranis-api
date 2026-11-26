#!/usr/bin/env bash
#
# The checks of aranis-api, run by aranis-api-pipeline (aranis-infra
# verify-pipelines/, SCRUM-957) on every push to main. There is no deploy: the
# contract is read by developers.aranis.ai at its build. A failure goes to
# aranis-ops-alerts. It replaces validate.yml and secret-scan.yml: build and test
# live in AWS, the GitHub repository is only a repository (SCRUM-697).
#
# Every step runs even after one fails, so one red run shows every problem, and
# the script exits non-zero if any did.

set -uo pipefail
cd "$(dirname "$0")/.."

failed=()
step() {
  local name="$1"; shift
  echo
  echo "=== ${name}"
  if "$@"; then echo "--- ok: ${name}"; else echo "--- FAILED: ${name}"; failed+=("$name"); fi
}

# The SDK types are generated from the spec; a stale src/generated.ts is a
# client that does not match the contract it ships with.
sdk() {
  (
    cd sdk/typescript &&
      npm ci --no-audit --no-fund &&
      npm run generate &&
      { git diff --exit-code src/generated.ts || { echo "src/generated.ts is stale: run 'npm run generate' and commit"; exit 1; }; } &&
      npm run typecheck &&
      npm run build
  )
}

step "OpenAPI lint"                               npx redocly lint openapi.yaml
step "Postman collection covers every operation"  node scripts/check-postman-coverage.mjs
step "TypeScript SDK"                             sdk
step "Secrets (Gitleaks)"                         gitleaks detect --no-banner --redact --source .

echo
if [ ${#failed[@]} -gt 0 ]; then
  printf 'GATE FAILED (%d):\n' "${#failed[@]}"; printf '  - %s\n' "${failed[@]}"
  exit 1
fi
echo "GATE PASSED"
