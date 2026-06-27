# Supabase Storage Security Audit — Executive Summary

**Audit date:** 2026-06-27  
**Scope:** Read-only review of Supabase Storage buckets, RLS policies, public URL exposure, signed URL flows, upload/download paths, frontend usage, and storage API logs.  
**Project:** `ykeryyraxmtjunnotoep` (production)  
**Site:** https://www.andiamoevents.com  
**Method:** Supabase MCP (`execute_sql`, `get_logs`, `get_advisors`), repository code search, safe anon HTTP spot checks (`scripts/security/storage-anon-spot-check.mjs`). **No production settings were changed.**

---

## Overall verdict

**Partially secure / materially insecure for sensitive data**

Public marketing buckets (`images`, `hero-images`) are broadly usable by design but allow **unauthenticated upload and delete** via storage RLS. Two buckets holding **highly sensitive data are misconfigured as public**:

1. **`tickets`** (1,431 QR PNGs) — encodes ticket `secure_token`; public URLs are stored in DB and emailed.
2. **`career-documents`** (112 applicant files) — CVs/resumes uploaded by candidates; public bucket + direct URL access.

Private buckets **`academy-payment-proofs`** and **`events`** follow a better pattern (service-role upload; admin signed URLs for proofs).

---

## Secure vs insecure (by area)

| Area | Status |
|------|--------|
| Academy payment proofs (private bucket + server signed URLs) | **Secure pattern** |
| Ticket QR storage (public bucket + public URLs) | **Insecure** |
| Career applicant documents (public bucket) | **Insecure** |
| Marketing/event images (public buckets) | **Partially secure** (expected public reads; unsafe anon write/delete) |
| Service role key exposure | **Secure** (server-only in API) |
| Frontend signed URL generation | **Secure** (none found) |
| Storage RLS on `tickets` / academy proofs upload | **Secure** (anon upload blocked) |

---

## Top findings

| ID | Severity | Finding |
|----|----------|---------|
| STG-001 | **Critical** | `tickets` bucket is **public**; QR PNGs encode `secure_token` and filenames include the token UUID. Anyone with the URL can download and scan. |
| STG-002 | **Critical** | `career-documents` bucket is **public**; 112 applicant documents (CVs, job applications) are world-readable via direct URL if path is known/leaked. |
| STG-003 | **High** | Anonymous users can **upload** to `images`, `career-documents`, and `hero-images` (verified HTTP 200). |
| STG-004 | **High** | Anonymous users can **delete** objects in `images` (verified HTTP 200). Policy `"Allow all operations for images"` grants **ALL** on `images`. |
| STG-005 | **High** | Anonymous users can **list** folders/objects in `images` bucket (verified HTTP 200; returns folder entries). |
| STG-006 | **Medium** | No bucket-level `file_size_limit` or `allowed_mime_types` on any bucket; client uploads accept broad file types. |
| STG-007 | **Medium** | Admin dashboard uploads use **browser Supabase client + anon key**; storage RLS is the only gate (no per-admin storage auth). |
| STG-008 | **Low** | Four harmless audit test `.txt` objects remain in `career-documents` / `hero-images` from spot checks (anon cannot delete career objects). |

---

## Urgent action needed?

**Yes — for `tickets` and `career-documents`.**

Ticket QR public exposure is an active ticket-fraud / unauthorized-entry risk. Career document public exposure is a **GDPR/privacy** risk (112 files).

Marketing bucket anon upload/delete is urgent for **abuse/storage-cost/defacement**, but lower confidentiality impact.

---

## Evidence index

| File | Contents |
|------|----------|
| [01-bucket-inventory.md](./01-bucket-inventory.md) | All buckets, counts, purpose, risk |
| [02-storage-policies.md](./02-storage-policies.md) | RLS policies and grants |
| [03-anon-access-tests.md](./03-anon-access-tests.md) | Safe HTTP test matrix |
| [04-public-bucket-review.md](./04-public-bucket-review.md) | Public URL / sensitive path review |
| [05-signed-url-review.md](./05-signed-url-review.md) | Signed URL flows |
| [06-upload-flow-review.md](./06-upload-flow-review.md) | All upload paths |
| [07-download-route-review.md](./07-download-route-review.md) | API download/signed routes |
| [08-frontend-storage-review.md](./08-frontend-storage-review.md) | Client bundle usage |
| [09-logs-review.md](./09-logs-review.md) | Storage logs summary |
| [10-risk-register.md](./10-risk-register.md) | Full risk register |
| [11-fix-plan-do-not-apply.md](./11-fix-plan-do-not-apply.md) | Remediation plan (not applied) |
| [12-final-go-no-go.md](./12-final-go-no-go.md) | Go/no-go decision |
