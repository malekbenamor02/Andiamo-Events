# 10 — Risk Register

| ID | Severity | Bucket / route / file | Evidence | Impact | Recommended fix | Priority |
|----|----------|----------------------|----------|--------|-----------------|----------|
| STG-001 | **Critical** | `tickets` bucket | Bucket `public: true`; 1,431 objects; `getPublicUrl` in `api/misc.js`, `admin-approve-order.js`; storage logs show public GET 200 | Anyone with QR URL can obtain ticket `secure_token` and forge/screuse entry | Set bucket private; stop storing permanent public URLs; use signed URLs (≤15 min) or email-embedded CID; migrate existing QRs | **P0** |
| STG-002 | **Critical** | `career-documents` bucket | Bucket public; 112 objects; `uploadCareerDocument` + `getPublicUrl`; anon upload HTTP 200 | Applicant CVs/resumes leaked to unauthorized parties; GDPR breach | Set bucket private; server-side upload API; admin signed URLs only; rotate URLs in DB | **P0** |
| STG-003 | **High** | `images` — policy `Allow all operations for images` | `pg_policies` CMD=ALL role=public; anon list/upload/delete verified | Site defacement, malware hosting, storage cost abuse, data destruction | Drop ALL policy; remove anon DELETE; restrict INSERT to authenticated admin role or server-only | **P1** |
| STG-004 | **High** | `images`, `hero-images`, `career-documents` anon INSERT | HTTP upload 200 in spot check; policies `Public can upload *` | Unauthenticated content injection, bucket flooding | Replace `{public}` INSERT with `authenticated` + admin claim or server proxy only | **P1** |
| STG-005 | **High** | `images`, `hero-images` anon DELETE | HTTP delete 200 on images; DELETE policies on both buckets | Loss of marketing assets, deliberate sabotage | Remove public DELETE policies; admin/service-role delete only | **P1** |
| STG-006 | **Medium** | All buckets — no `file_size_limit` / `allowed_mime_types` | SQL: all null | Large file DoS, executable content in public buckets | Set bucket limits; enforce MIME at API + bucket config | **P2** |
| STG-007 | **Medium** | Admin `Dashboard.tsx` → `upload.ts` | Client-side anon storage for admin media | Admin UI auth bypassed at storage layer | Route all admin uploads through `/api/media/upload` (R2) or authenticated storage JWT | **P2** |
| STG-008 | **Medium** | Ticket path `{secureToken}.png` | Filename equals token UUID | URL path discloses token even before scanning QR | Use opaque object keys; map in DB; QR content can remain token for scanner | **P2** |
| STG-009 | **Medium** | R2 ticket upload `r2-media.cjs` | Public CDN URL for QRs when R2 enabled | Same as STG-001 on Cloudflare path | Private R2 objects + signed URLs or scanner-only backend | **P2** |
| STG-010 | **Low** | Audit test artifacts | 2× `.txt` in career-documents, 2× in hero-images | Noise only | Service-role cleanup | **P3** |
| STG-011 | **Low** | `events` bucket (1 object) | No code reference; private | Orphan data | Inventory and remove if unused | **P3** |
| STG-012 | **Low** | Academy signed URL 3600s | `academyRoutes.cjs` | Window for URL sharing | Reduce to 900s; optional one-time tokens | **P3** |
| STG-013 | **Info** | Repo vs prod policy drift | `Allow all operations for images` not in migrations | Hardening rollback | Document change control; align prod with migration intent | **P3** |

---

## Positive controls (for completeness)

| ID | Severity | Item | Evidence |
|----|----------|------|----------|
| STG-P01 | OK | Academy proofs private + signed URL | Private bucket; no policies; admin route |
| STG-P02 | OK | Anon blocked from ticket upload | HTTP 403 spot check |
| STG-P03 | OK | Service role server-only | No frontend key; API env only |
| STG-P04 | OK | `/api/media/*` admin auth | `register-media-routes.cjs` |
