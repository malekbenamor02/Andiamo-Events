# 03 — Anonymous Access Tests (Safe Spot Checks)

**Script:** `scripts/security/storage-anon-spot-check.mjs`  
**Auth:** Publishable/anon key only (from local `.env` — key not printed)  
**Project URL:** `https://ykeryyraxmtjunnotoep.supabase.co`  
**Date:** 2026-06-27

No real customer files were downloaded. Tests used fake object names or harmless 9-byte `audit-test` payloads.

---

## Test matrix

| Test | Bucket | Operation | Expected (secure) | Actual | Pass/Fail |
|------|--------|-----------|-------------------|--------|-----------|
| list_images_root | images | LIST (prefix `''`, limit 1) | Deny or empty without auth | **HTTP 200** — returned folder entry `campaign-email` | **FAIL** |
| list_posters | images | LIST (prefix `posters`, limit 2) | Deny | **HTTP 200** — `[]` (no index leak at that prefix in test window) | **PARTIAL** |
| list_tickets_root | tickets | LIST | Deny | HTTP 200 — `[]` | **PASS** (empty; public GET still works) |
| list_tickets_prefix | tickets | LIST (prefix `tickets/`) | Deny | HTTP 200 — `[]` | **PASS** (no list leak; direct URL still public) |
| list_career_root | career-documents | LIST | Deny | HTTP 200 — `[]` | **PASS** (no list; direct URL public) |
| list_academy_proofs | academy-payment-proofs | LIST | Deny | HTTP 200 — `[]` | **PASS** |
| list_events | events | LIST | Deny | HTTP 200 — `[]` | **PASS** |
| list_hero_images | hero-images | LIST | Deny | HTTP 200 — `[]` | **PASS** |
| get_fake_tickets | tickets | GET public URL | 404 for missing object | HTTP 400 body `Object not found` | **N/A** |
| get_fake_career | career-documents | GET public URL | 404 | HTTP 400 `Object not found` | **N/A** |
| get_fake_academy | academy-payment-proofs | GET public URL | Bucket not accessible | HTTP 400 `Bucket not found` | **PASS** |
| get_fake_events | events | GET public URL | Bucket not accessible | HTTP 400 `Bucket not found` | **PASS** |
| upload_tickets | tickets | POST object | **403** | **403** RLS violation | **PASS** |
| upload_academy | academy-payment-proofs | POST | **403** | **403** | **PASS** |
| upload_events | events | POST | **403** | **403** | **PASS** |
| upload_images | images | POST `security-audit-test-*.txt` | **403** | **200** — upload succeeded | **FAIL** |
| upload_career | career-documents | POST | **403** | **200** — upload succeeded | **FAIL** |
| upload_hero | hero-images | POST | **403** | **200** — upload succeeded | **FAIL** |
| delete_images_test | images | DELETE test object | **403** | **200** `Successfully deleted` | **FAIL** |
| delete_hero_test | hero-images | DELETE test object | **403** | **400** (delete failed in cleanup run; upload had succeeded) | **INCONCLUSIVE** |
| delete_career_test | career-documents | DELETE | **403** | **400** | **PASS** (no delete policy) |

---

## Interpretation

### What anonymous users **cannot** do (good)

- Upload to **`tickets`**, **`academy-payment-proofs`**, **`events`** (RLS blocks).
- Access private buckets via **public URL endpoint** (returns bucket not found).
- List **`tickets`** object names via storage list API (empty in tests — direct URL remains the issue).

### What anonymous users **can** do (bad)

- **Upload arbitrary files** to `images`, `career-documents`, `hero-images`.
- **Delete files** in `images` (confirmed).
- **List** at least some **`images`** folder structure.

### Public read without list

For **`tickets`** and **`career-documents`**, even when list returns empty, **`public: true`** buckets allow:

```
GET /storage/v1/object/public/{bucket}/{path}
```

Storage logs show **HTTP 200** on real ticket QR paths (see `09-logs-review.md`).

---

## Test artifacts

Spot checks created small `security-audit-test-*.txt` files:

| Bucket | Count remaining | Anon delete? |
|--------|-----------------|--------------|
| career-documents | 2 | No (400) |
| hero-images | 2 | No (400 in cleanup) |
| images | 0 | Deleted by anon (200) |

**Recommendation:** Remove remaining audit `.txt` files with service role during remediation.

---

## Overall anon access verdict

| Capability | Dangerous? |
|------------|------------|
| Read/list ticket QR files | **Yes** — via public URL if path known (path contains token UUID) |
| Read career documents | **Yes** — public bucket |
| Upload to public buckets | **Yes** — abuse/storage cost |
| Delete marketing images | **Yes** — site defacement |
| Upload/read academy proofs | **No** — blocked |
