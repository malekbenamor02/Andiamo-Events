# Admin service-role auth audit — 2026-06-27

## 1. Summary verdict

**Production API layer (`api/*` on Vercel): PASS**

**Local dev (`server.cjs`): PASS** (synced 2026-06-27)

- All audited admin/private handlers in `api/` and `server.cjs` use **service role only** for protected tables (zero `supabaseService || supabase` anon fallback).
- Admin auth runs **before** service-role DB client creation in all spot-checked routes and automated source-order tests.
- Public service-role routes reviewed; field-limited selects enforced where flagged by static scan.
- Audit logging added for presale codes, event promo codes, bulk SMS, marketing campaigns, and ambassador CRUD.
- Automated checks: `npm run security:admin-auth`, `npm run security:public-routes`, `npm run test:admin-auth-order`, `npm run build` — all pass.

---

## 2. server.cjs cleanup completed

| Item | Status |
|------|--------|
| Removed all `supabaseService \|\| supabase` fallbacks | **74 → 0** (automated via `scripts/security/fix-server-cjs-service-role.mjs`) |
| Added `requireServiceRoleDb(res)` | Fail closed **503** when `SUPABASE_SERVICE_ROLE_KEY` missing |
| Added `getServiceRoleDbOrThrow()` | Internal helpers only |
| Added `getSecurityAuditDb()` | Security audit logs (service role only) |
| Added `getPublicAnonDb()` | Public routes only; not used by admin handlers |
| Removed “Using anon key instead” warning | Admin/private routes no longer degrade to anon |
| Auth before DB | Unchanged Express middleware order preserved |

**Verification:** `grep` finds zero `supabaseService || supabase` in `server.cjs`. `npm run security:admin-auth` reports **OK: server.cjs has no forbidden admin DB patterns.**

---

## 3. Public service-role route review

| Route / file | Service role why | Field limits | Validation | Abuse protection | Gateway / auth boundary |
|--------------|------------------|--------------|------------|------------------|-------------------------|
| `api/_lib/public-event-by-slug.js` | RLS blocks anon bulk event reads; curated public slug lookup | `PUBLIC_EVENT_COLUMNS` explicit list | Slug required; cancelled/test events filtered | Read-only GET | N/A (public read) |
| `api/scan.js` + `scanner-db.cjs` | Scanner/POS tables deny anon; JWT-scoped operations | Per-handler column lists | Scanner login + session JWT; admin scan routes use `requireScannerAdminAuth` | Login rate limit (`scanner-login-rate-limit.cjs`) | Scanner JWT, not admin cookie |
| `api/pos.js` | POS outlet operations bypass RLS | Outlet/order column subsets in handlers | Outlet slug + POS session auth | Login rate limit (6/15min/IP) | POS session; prod requires service role (503 if missing) |
| `api/clictopay-generate-payment.js` | Order read/update for payment registration | Order columns explicit in handler | `orderId` required; CORS | Payment gateway registration only | ClicToPay `register.do` — no admin auth |
| `api/misc.js` `/api/clictopay-confirm-payment` | Mark order PAID + ticket generation after gateway verify | Order passes: `id, quantity, pass_type, price, order_pass_id` (fixed this audit) | `orderId` only; gateway status verified server-side | Idempotent PAID check | **ClicToPay API status check before mutation** |
| `api/misc.js` `/api/aio-events/save-submission` | Public form insert to protected table | Insert allowlist in handler | Form field validation | reCAPTCHA / rate patterns per handler | Public POST |
| `api/misc.js` `/api/ambassador-application` | Public application insert | Insert allowlist | Phone/email uniqueness checks | Duplicate detection | Public POST |
| `api/misc.js` `/api/phone-subscribe` | Public subscriber insert | Minimal insert columns | Phone format validation | Duplicate handling | Public POST |
| `careerRoutes.cjs` public `/api/careers/*` | Public career pages + application submit | Domain/field scoped selects | reCAPTCHA, field validation, duplicate email/phone | Application closed flag | Public POST |
| Newsletter / contact | Via misc or dedicated handlers | Insert-only public fields | Input validation | Standard form validation | Public POST |

**Static scan:** `scripts/security/check-public-service-role-routes.mjs` — flags `select('*')` on sensitive tables in public route handlers only (admin sections excluded).

---

## 4. Audit logging completeness

| Mutation area | Audit destination | Status |
|---------------|-------------------|--------|
| Order approve/remove/resend/expiration | `order_logs` | Already present |
| Admin user tab access | `admin_logs` via `writeTabAccessAudit` | Already present |
| POS admin mutations | `pos_audit_log` | Already present (`admin-pos.js`) |
| Presale code CRUD / pause / limits | `admin_logs` via `writeAdminMutationAudit` | **Added** |
| Event promo code CRUD / revoke | `admin_logs` via `writeAdminMutationAudit` | **Added** |
| Bulk SMS send | `sms_logs` per message + `admin_logs` summary | **Added** (`marketing.bulk_sms.sent`) |
| Marketing campaign create/launch/patch | `admin_logs` | **Added** |
| Ambassador create/update/delete | `admin_logs` | **Added** |
| Career application status | `career_application_logs` | Already present (dedicated table; not duplicated to `admin_logs`) |
| Marketing send-batch / cron tick | `marketing_campaign_recipients` row status | **Intentionally no `admin_logs`** — high-volume per-recipient trail in recipient rows + `sms_logs`/email provider |
| Admin login/logout | Session + optional security logs | Auth events; not order mutations |
| Academy influencer actions | `admin_logs` via `academy-influencer-audit.cjs` | Already present |

**Helper:** `api/_lib/admin-mutation-audit.js` — best-effort insert to `admin_logs`; failures logged to console, do not block mutation.

---

## 5. Files changed (this remediation)

| File | Change |
|------|--------|
| `server.cjs` | Service-role-only admin DB; `requireServiceRoleDb`; zero anon fallbacks |
| `scripts/security/fix-server-cjs-service-role.mjs` | **New** — automated server.cjs fallback removal |
| `scripts/security/check-admin-service-role-auth.mjs` | server.cjs failures block CI; exclude test files; expanded HTTP probe routes |
| `scripts/security/check-public-service-role-routes.mjs` | **New** — public route `select('*')` scan |
| `api/_lib/admin-mutation-audit.js` | **New** — shared admin mutation audit helper |
| `api/_lib/presale-route-admin-codes.js` | Audit logs on create/pause/unpause/limits/discounts |
| `api/_lib/event-promo-route-admin.js` | Audit logs on create/update/revoke/discounts |
| `api/_lib/admin-data-routes.js` | Ambassador create/update/delete audit logs |
| `api/misc.js` | Bulk SMS uses `authResult.admin.id`; marketing + bulk SMS audit; clictopay confirm order_passes column limit |
| `api/clictopay-generate-payment.js` | Service role only (`createServiceRoleClient`) |
| `api/_lib/admin-permission-routes.test.cjs` | **New** — super-admin route order + server.cjs hardening tests |
| `api/_lib/admin-route-auth-order.test.cjs` | Existing auth-before-DB regression tests |
| `careerRoutes.cjs` | Public/admin DB split (`supabase` vs `supabaseService`) |
| `package.json` | `security:public-routes`; `test:admin-auth-order` includes permission tests |

---

## 6. Tests run

| Command | Result |
|---------|--------|
| `npm run security:admin-auth` | **PASS** — api/ + server.cjs clean |
| `npm run security:public-routes` | **PASS** — no `select('*')` on sensitive tables in public handlers |
| `npm run test:admin-auth-order` | **PASS** — 13/13 tests |
| `npm run build` | **PASS** |

### Automated coverage

- **Admin static scan** — forbids anon/fallback patterns in admin context under `api/`, `careerRoutes.cjs` admin sections, and `server.cjs`.
- **Public route scan** — forbids `select('*')` on sensitive tables in public/service-role handlers.
- **Source order tests** — presale, promo, logs, approve-order, admin-pos, `requireAdmin()`.
- **Permission tests** — `order-qr-tickets`, `official-invitations` require super_admin before DB; server.cjs helpers.
- **Optional HTTP probe** — set `ADMIN_AUTH_PROBE_BASE_URL` to verify unauthenticated admin routes return 401/403 (includes QR tickets, official invitations, bulk SMS).

---

## 7. Remaining risks

| Priority | Item |
|----------|------|
| **Medium** | Run live HTTP probe: `ADMIN_AUTH_PROBE_BASE_URL=https://www.andiamoevents.com npm run security:admin-auth` |
| **Medium** | Integration tests with real admin JWT for regular admin **403** on super-admin routes (source-order tests cover structure only) |
| **Low** | `api/pos.js` dev-only anon fallback when `ALLOW_DEV_ANON_FALLBACK=1` — production fails closed; document for local POS testing |
| **Low** | `api/misc.js` clictopay confirm still selects `orders` with joined relations via template string (not bare `select('*')`); acceptable post-gateway-verify internal use |
| **Low** | Marketing cron `/api/marketing/cron/email-campaigns` uses `CRON_SECRET` — not admin audit logged (system actor) |

---

## 8. Deployment notes

1. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in **Vercel production** and local `.env` for `npm run server`.
2. Deploy changed `api/*` and `server.cjs` via normal git push → Vercel build.
3. No Supabase migration required (RLS unchanged).
4. Post-deploy smoke: admin login, presale codes, ambassador tab, bulk SMS, marketing launch.
5. Optional: `ADMIN_AUTH_PROBE_BASE_URL=https://www.andiamoevents.com npm run security:admin-auth`

---

## Appendix: canonical admin DB pattern

```javascript
const authResult = await verifyAdminAuth(req);
if (!authResult.valid) {
  return res.status(authResult.statusCode || 401).json({ error: authResult.error, valid: false });
}
if (!hasPermission(authResult.admin?.role, 'orders:manage')) {
  return res.status(403).json({ error: 'Forbidden' });
}

const dbClient = await createAdminDbClient(res);
if (!dbClient) return; // 503 if service role missing

// mutate...

await writeAdminMutationAudit(dbClient, {
  admin: authResult.admin,
  action: 'domain.action',
  targetType: 'resource_type',
  targetId: id,
  details: { /* safe metadata */ },
});
```

Public/webhook routes use `createServiceRoleClient()` with their own verification boundary — **not** `createAdminDbClient`.
