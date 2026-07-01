# Ambassador Application Email Permission Fix

**Date:** 2026-06-29  
**Status:** Implemented locally, tested, **not deployed** (awaiting review)

---

## Root cause

Ambassador application approval, resend, and **rejection** flows called the **generic marketing email API**:

```
createApprovalEmail() / createRejectionEmail() → sendEmailWithDetails() / sendEmail()
  → POST /api/send-email → marketing:manage
```

Application reviewers have the **Applications** tab (`applications:manage`), not **Marketing** (`marketing:manage`). After the auth hardening and headers-sent fix, production correctly returned:

```json
{ "error": "Forbidden", "details": "Permission required: marketing:manage" }
```

This was a **permission/design mismatch**, not an SMTP failure and not caused by the `ERR_HTTP_HEADERS_SENT` fix (that fix only made the real 403 visible).

---

## Permission decision

| Action | Permission | Endpoint |
|--------|------------|----------|
| Marketing campaigns / bulk email | `marketing:manage` | `POST /api/send-email` (unchanged) |
| Approve application + send credentials | `applications:manage` | `POST /api/admin-update-application` (server-side email) |
| Reject application + send notification | `applications:manage` | `POST /api/admin-update-application` (server-side email) |
| Resend approval email | `applications:manage` | `POST /api/admin-ambassador-application-resend-email` |

**Why not grant `marketing:manage`?** That would give application reviewers access to arbitrary email sending, SMS balance, bulk campaigns, and marketing data sources — far beyond reviewing applications.

---

## Approval email — old broken flow

```
ApplicationsListCore "Resend" button
  → Dashboard.resendEmail()
  → createApprovalEmail({ to, subject, html, password })
  → POST /api/send-email
  → gateAdminPermission(..., 'marketing:manage')
  → 403 Forbidden
```

Same path for `handleApprove()` and manual ambassador create.

---

## Approval email — new secure flow

### Approve (Option A — preferred)

```
handleApprove()
  → POST /api/admin-update-application (applications:manage)
    body: { applicationId, status: 'approved', temporaryPassword }
  → server provisions ambassador + sends approval email via sendTransactionalEmail
  → response { approvalEmailSent, approvalEmailError }
  → frontend updates UI from response (no /api/send-email)
```

### Resend / manual create (Option B)

```
resendEmail() / manual ambassador create
  → POST /api/admin-ambassador-application-resend-email
     body: { applicationId, regeneratePassword?: boolean }
  → server loads application + ambassador from DB
  → builds HTML server-side, sends email
  → { success: true }
```

---

## Rejection email — old broken flow

```
handleReject()
  → POST /api/admin-update-application (applications:manage) — status update only
  → createRejectionEmail({ fullName, phone, email, city })
  → sendEmail() → POST /api/send-email
  → gateAdminPermission(..., 'marketing:manage')
  → 403 Forbidden (Applications-only admins)
```

---

## Rejection email — new secure flow

```
handleReject()
  → POST /api/admin-update-application (applications:manage)
     body: { applicationId, status: 'rejected', reapply_delay_date, rejectionNote? }
  → server rejects arbitrary to/subject/html/from/emailBody/campaignTemplate (400)
  → server updates application status in DB
  → server loads recipient email from application row
  → sendAmbassadorApplicationRejectionEmail() builds HTML server-side
  → response { rejectionEmailSent, rejectionEmailError }
  → frontend toasts:
       - rejected + email sent
       - rejected but email failed
       - reject failed (API error)
```

**Security controls on rejection path:**

- Rejects client `to`, `subject`, `html`, `from`, `emailBody`, `campaignTemplate`
- Resolves recipient email from DB only (`application.email`)
- Optional `rejectionNote` trimmed server-side (max 2000 chars), escaped in template
- Logs only `applicationId`, masked recipient — no email body or note content
- `/api/send-email` remains gated by `marketing:manage` with no changes

---

## Files changed

### Backend

| File | Change |
|------|--------|
| `api/_lib/ambassador-approval-email-html.cjs` | **New** — server-side approval email HTML template |
| `api/_lib/ambassador-rejection-email-html.cjs` | **New** — server-side rejection email HTML template |
| `api/_lib/ambassador-application-approval-email.cjs` | Send helpers for approval + rejection; ambassador resolution; password regen |
| `api/_lib/ambassador-application-email-http.js` | **New** — HTTP handler for resend route |
| `api/misc.js` | Approve/reject send email server-side; forbidden email fields; new resend route |
| `vercel.json` | Rewrite for `/api/admin-ambassador-application-resend-email` |
| `server.cjs` | Forward resend route to `misc.js` (local dev parity) |

### Frontend

| File | Change |
|------|--------|
| `src/lib/api-routes.ts` | `ADMIN_AMBASSADOR_APPLICATION_RESEND_EMAIL` constant |
| `src/lib/adminApi.ts` | `resendAmbassadorApplicationApprovalEmail()`; typed approve/reject response fields |
| `src/pages/admin/Dashboard.tsx` | Approve/resend/reject use server-side email; removed `createRejectionEmail`/`sendEmail` from reject path |

### Tests

| File | Change |
|------|--------|
| `api/_lib/ambassador-application-email-permission.test.cjs` | Permission routing + rejection flow regression tests |

---

## UI mojibake fix

Replaced corrupted toast strings (e.g. `âŒ Email Failed to Send`) with plain text:

- `Email failed to send`
- `Email sent`
- `Warning: Email delivery failed`

(Left valid French `L'âge` strings unchanged.)

---

## Tests added/updated

`api/_lib/ambassador-application-email-permission.test.cjs`:

1. Resend route uses `applications:manage`
2. `/api/send-email` still uses `marketing:manage`
3. `admin-update-application` sends approval email server-side
4. `admin-update-application` sends rejection email server-side
5. `admin-update-application` rejects arbitrary email fields from client
6. Resend handler rejects arbitrary email fields
7. Approval HTML template escapes user input
8. Rejection HTML template escapes user/application input
9. Rejection helper requires `status === 'rejected'`
10. Dashboard does not call `createApprovalEmail` or `createRejectionEmail`
11. `handleReject` uses `rejectionEmailSent` (no `sendEmail` / `sendEmailWithDetails`)
12. `handleApprove` uses `approvalEmailSent` (no `sendEmail` in approve path)
13. Permission-denied branch does not clear admin cookie
14. `sendEmailWithDetails` only in `handleAddAdmin` (admin credentials — not application workflow)
15. Manual ambassador create uses resend API, not `/api/send-email`
16. Marketing test/bulk uses direct `fetch('/api/send-email')` under marketing tab gate

Existing `send-email-headers-sent.test.cjs` still passes.

---

## Commands run and results

```bash
grep -R "sendEmailWithDetails" -n src api
grep -R "API_ROUTES.SEND_EMAIL" -n src api
grep -R "createApprovalEmail" -n src api
grep -R "createRejection" -n src api

node --test api/_lib/ambassador-application-email-permission.test.cjs api/_lib/send-email-headers-sent.test.cjs
# 27/27 pass

npm run test:admin-auth-order
# 86/86 pass

npm run build
# exit 0
```

Grep verification (application workflow no longer uses `/api/send-email`):

| Pattern | Locations | Classification |
|---------|-----------|----------------|
| `sendEmailWithDetails` | `Dashboard.tsx` `handleAddAdmin` only (+ `email.ts` definition) | **Admin user credentials email** — not marketing, not ambassador |
| `fetch('/api/send-email')` | `Dashboard.tsx` `handleSendTestEmail`, `handleSendBulkEmails` | **Marketing tab** campaign test/bulk — correct `marketing:manage` path |
| `API_ROUTES.SEND_EMAIL` | `email.ts` only (`sendEmail` / `sendEmailWithDetails` helpers) | No Dashboard application/ambassador callers |
| `createApprovalEmail` / `createRejectionEmail` | `email.ts` only | Unused by Dashboard |

---

## Remaining `sendEmailWithDetails` classification (final review)

### What it is

The sole remaining `sendEmailWithDetails()` call is in **`handleAddAdmin`** (`Dashboard.tsx` ~4762):

```
handleAddAdmin()
  → adminApi.createAdmin()          // POST /api/admin/admins — admins:manage
  → createAdminCredentialsEmail() // client builds to/subject/html
  → sendEmailWithDetails()          // POST /api/send-email — marketing:manage
```

This is **neither** a Marketing tab campaign path **nor** a manual ambassador create path. It is an **admin-user credentials email** sent after creating a new admin account.

### What it is not

| Path | Status |
|------|--------|
| Marketing test/bulk email | Uses direct `fetch('/api/send-email')` with `campaignTemplate: true` in `handleSendTestEmail` / `handleSendBulkEmails`; UI only under `activeTab === "marketing"` + `canAccessTab("marketing")` — **correct, intentionally kept** |
| Manual ambassador create credentials | **Fixed** — `createAmbassador` (`ambassadors:manage`) + `resendAmbassadorApplicationApprovalEmail` (`applications:manage`); no `/api/send-email` |
| Approve / reject / resend application | **Fixed** — server-side in `admin-update-application` / resend route |

### Fixed or intentionally kept?

**Intentionally not changed in this PR.** The admin-credentials mismatch (`admins:manage` UI vs `marketing:manage` email API) is the same anti-pattern but a **separate permission domain**. Fixing it requires a new `admins:manage`-gated endpoint (e.g. send credentials on `POST /api/admin/admins` or a dedicated resend route) — follow-up work, not part of the Ambassador Application Email Permission Fix.

**Impact:** Super admins who create admins typically have all permissions. A tab-restricted admin with `admins:manage` but not `marketing:manage` could create an admin account but fail to email credentials — same class of bug, different tab.

### Manual ambassador create — ambassadors-only admin

| Step | Permission | Notes |
|------|------------|-------|
| Create ambassador row | `ambassadors:manage` | `POST /api/admin/ambassadors` |
| Send credentials email | `applications:manage` | `resendAmbassadorApplicationApprovalEmail` (requires linked approved application row) |

An **ambassadors-only** admin (no Applications tab) can create the ambassador record but credential email may fail with 403 unless they also have `applications:manage`. This is intentional: credential email is tied to the application workflow endpoint. UI falls back to “use Resend Email after refresh” when no application row exists.

---

## Remaining risks

| Risk | Severity | Notes |
|------|----------|-------|
| **Admin create credentials email** still uses `/api/send-email` | Medium | Separate follow-up: move to `admins:manage` server-side path (out of scope for this deploy) |
| **Manual ambassador create** if no linked `ambassador_applications` row | Low | UI shows message to use Resend after refresh; does not call invalid application id. |
| **Ambassadors-only admin without applications:manage** | Low | Create succeeds; credential email requires Applications permission or Resend after application row exists. |
| **Resend regenerates password** | Low | By design — server cannot retrieve prior plaintext; email always contains fresh credentials. |
| **Local `server.cjs` `admin-update-application`** | Low | Still simplified handler without server-side approve/reject email; Vercel uses `misc.js` via rewrite. Resend forwards to `misc.js`. |
| **Rejection note UI** | Low | Backend accepts optional `rejectionNote`; UI does not yet collect one — email uses default template text only. |

---

## Final deploy verdict

**Ambassador Application Email Permission Fix — clear to deploy after review.**

Ambiguity resolved:

1. No approve/reject/resend application workflow calls `sendEmailWithDetails`, `sendEmail()`, `API_ROUTES.SEND_EMAIL`, `createApprovalEmail()`, or `createRejectionEmail()`.
2. `/api/send-email` still requires `marketing:manage`.
3. Applications-only admin can approve, reject, and resend without `marketing:manage`.
4. Manual ambassador create is off `/api/send-email`; credential email uses `applications:manage` (not `ambassadors:manage`).
5. Remaining `sendEmailWithDetails` is **admin-user credentials only** — documented follow-up, **does not block** this deploy.

After review:

1. Deploy to Vercel preview
2. Test with an admin who has **Applications** tab only (no Marketing):
   - Approve application → credentials email received
   - Reject application → rejection email received (no `marketing:manage` error)
   - Resend approval email → success
3. Confirm Marketing tab bulk/test email still requires `marketing:manage`
4. Promote to production

**Follow-up (separate PR):** Move admin create credentials email to an `admins:manage` server-side endpoint.
