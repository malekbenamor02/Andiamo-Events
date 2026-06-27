# Pre-migration route checks (after code deploy, before SQL migration)

**Status: BLOCKED** — Remediation code is **not deployed** to production as of 2026-06-27. Do not apply storage migration until this section passes.

## Deployment gate (all must be true)

| Gate | Status |
|------|--------|
| Code deployed successfully to Vercel production | **FAIL** — not deployed |
| Production routes live (see HTTP checks below) | **FAIL** |
| `SUPABASE_SERVICE_ROLE_KEY` in Vercel production | **UNVERIFIED** (owner action) |
| New tickets/careers no longer depend on public Storage URLs | **PASS in code**; migration pending |
| Migration idempotent | **PASS** (see `03-create-drop-policy-check.md`) |
| Storage regression script exists | **PASS** (`npm run security:storage`) |
| PITR/backups confirmed in Supabase dashboard | **UNVERIFIED** (owner action) |

**If any gate fails → STOP. Do not run migration.**

## HTTP checks (production — run immediately after code deploy)

Target: `https://www.andiamoevents.com`

| Route | Method | Expected (no auth) | 2026-06-27 probe | Result |
|-------|--------|-------------------|------------------|--------|
| `/api/tickets/qr/{random-valid-uuid}` | GET | 404 (unknown token) or 200 (known test token); **not 500** | `00000000-0000-4000-8000-000000000001` → **500** | **FAIL** (code not live) |
| `/api/careers/upload-document` | POST (no file) | **400** (not 404) | **500** | **FAIL** |
| `/api/admin/media/upload` | POST (no cookie) | **401** | **504** (gateway timeout) | **FAIL** |

## Local / static verification (completed pre-deploy)

| Check | Result |
|-------|--------|
| `require('./api/_lib/register-storage-security-routes.cjs')` | **MODULE_LOAD_OK** |
| `require('./api/_lib/ticket-qr-route.cjs')` | OK |
| `require('./api/_lib/career-document-storage.cjs')` | OK |
| `vercel.json` rewrites for `/api/tickets/qr/:secureToken`, `/api/careers/upload-document`, `/api/admin/media/*` | Present |
| `npm run build` | **PASS** (see `09-build-output.txt`) |

## Post code-deploy checklist (owner)

1. Redeploy production from branch containing storage remediation.
2. Confirm `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` in Vercel Production env.
3. Re-run HTTP table above; all three routes must meet expected status codes.
4. Smoke: admin poster upload, career document upload, new order QR email shows `/api/tickets/qr/` URL.
5. Only then apply `02-storage-migration.sql` in Supabase SQL editor.
6. Run `npm run security:storage` — must exit 0.
