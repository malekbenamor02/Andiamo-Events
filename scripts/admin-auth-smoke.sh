#!/usr/bin/env bash
# Manual admin authorization smoke checklist.
# Usage: BASE_URL=http://localhost:3000 ./scripts/admin-auth-smoke.sh
# Requires: curl, jq (optional for pretty output)

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/andiamo-admin-smoke-cookies.txt}"

echo "=== Admin auth smoke test ==="
echo "Base URL: $BASE_URL"
echo ""

check_status() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  OK  $label (HTTP $actual)"
  else
    echo "  FAIL $label (expected HTTP $expected, got $actual)"
    exit 1
  fi
}

echo "1. Unauthenticated GET /api/verify-admin → 401"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/verify-admin")
check_status "verify-admin without cookie" "401" "$code"

echo ""
echo "2. Unauthenticated GET /api/admin/admins → 401"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/admin/admins")
check_status "admin list without cookie" "401" "$code"

echo ""
echo "3. POST /api/auto-reject-expired-orders without CRON_SECRET → 401/403"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/auto-reject-expired-orders")
if [ "$code" = "401" ] || [ "$code" = "403" ]; then
  echo "  OK  cron endpoint blocked without secret (HTTP $code)"
else
  echo "  FAIL cron endpoint should reject unauthenticated calls (got HTTP $code)"
  exit 1
fi

echo ""
echo "4. Login (set ADMIN_EMAIL + ADMIN_PASSWORD env vars to run)"
if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  rm -f "$COOKIE_JAR"
  resp=$(curl -s -w '\n%{http_code}' -c "$COOKIE_JAR" -X POST "$BASE_URL/api/admin-login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
  code=$(echo "$resp" | tail -n1)
  body=$(echo "$resp" | sed '$d')
  check_status "admin login" "200" "$code"
  echo "$body" | head -c 200
  echo "..."

  echo ""
  echo "5. Authenticated GET /api/verify-admin → 200 with allowedTabs"
  resp=$(curl -s -w '\n%{http_code}' -b "$COOKIE_JAR" "$BASE_URL/api/verify-admin")
  code=$(echo "$resp" | tail -n1)
  check_status "verify-admin with cookie" "200" "$code"
  body=$(echo "$resp" | sed '$d')
  if echo "$body" | grep -q 'allowedTabs'; then
    echo "  OK  response includes allowedTabs"
  else
    echo "  FAIL verify-admin response missing allowedTabs"
    exit 1
  fi
else
  echo "  SKIP login steps (export ADMIN_EMAIL and ADMIN_PASSWORD to run full flow)"
fi

echo ""
echo "=== Smoke checklist complete ==="
echo "Manual UI checks:"
echo "  - Regular admin: no Events / Settings / Marketing / Admins tabs"
echo "  - Regular admin: can access Overview, Applications, Orders, POS, Ambassador Sales"
echo "  - Super admin: all tabs visible; site_content writes succeed via API only"
echo "  - Browser DevTools: no direct Supabase INSERT/UPDATE/DELETE on admins, site_content, sponsors, team_members"
