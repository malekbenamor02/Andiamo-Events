# 02 — Storage RLS Policies & Grants

**Source:** `pg_policies` and `information_schema.role_table_grants` on schema `storage` (Supabase MCP)

RLS is **enabled** on `storage.buckets` and `storage.objects` (`relrowsecurity = true`).

---

## Policies on `storage.objects`

| Policy name | Table | CMD | Roles | USING | WITH CHECK | Safe? | Notes |
|-------------|-------|-----|-------|-------|------------|-------|-------|
| **Allow all operations for images** | objects | **ALL** | `{public}` | `bucket_id = 'images'` | `bucket_id = 'images'` | **No — Dangerous** | Supersedes hardening intent. Grants anon SELECT/LIST/UPDATE/DELETE/INSERT on entire `images` bucket. Not present in repo migrations — likely dashboard/manual. |
| Public can delete hero images | objects | DELETE | `{public}` | `bucket_id = 'hero-images'` | — | **No** | Any anonymous client can delete hero assets. |
| Public can delete images | objects | DELETE | `{public}` | `bucket_id = 'images'` | — | **No** | Confirmed by anon delete test (HTTP 200). |
| Public can upload career documents | objects | INSERT | `{public}` | — | `bucket_id = 'career-documents'` | **No** | Anon upload verified. No SELECT policy, but **bucket is public** so direct URL read still works. |
| Public can upload hero images | objects | INSERT | `{public}` | — | `bucket_id = 'hero-images'` | **No** | Anon upload verified. |
| Public can upload images | objects | INSERT | `{public}` | — | `bucket_id = 'images'` | **No** | Anon upload verified. |
| Service role can delete ticket QR codes | objects | DELETE | `{public}` | `bucket_id = 'tickets' AND auth.role() = 'service_role'` | — | **Yes** | Correctly scoped to service role. |
| Service role can update ticket QR codes | objects | UPDATE | `{public}` | `bucket_id = 'tickets' AND auth.role() = 'service_role'` | same | **Yes** | |
| Service role can upload ticket QR codes | objects | INSERT | `{public}` | — | `bucket_id = 'tickets' AND auth.role() = 'service_role'` | **Yes** | Anon ticket upload blocked (403). |
| Service role full access to tickets 1d5g1yf_1 | objects | INSERT | `{service_role}` | — | tickets + service_role | **Yes** | Duplicate service-role policies (dashboard-generated names). |
| Service role full access to tickets 1d5g1yf_2 | objects | UPDATE | `{service_role}` | tickets + service_role | — | **Yes** | |
| Service role full access to tickets 1d5g1yf_3 | objects | DELETE | `{service_role}` | tickets + service_role | — | **Yes** | |

### Removed policies (per migration `20260408000000-storage-policy-hardening.sql`)

The migration **removed** broad SELECT policies (`Public can view images`, `Public can view career documents`, `Public can view ticket QR codes`) to reduce **listing**. However:

- **Public buckets** still allow direct object GET via `/object/public/{bucket}/{path}` without SELECT policy.
- **`Allow all operations for images`** re-introduces full SELECT/list on `images`.

### Buckets with **no** `storage.objects` policies

| Bucket | Effect |
|--------|--------|
| `academy-payment-proofs` | No anon/authenticated access via PostgREST storage API. Service role bypasses RLS. **Correct.** |
| `events` | Same — private, no public policies. **Correct.** |

---

## Policies on `storage.buckets`

**None** (empty result from `pg_policies WHERE tablename = 'buckets'`).

Bucket metadata visibility is governed by table grants (below), not named policies.

---

## Table grants (anon / authenticated)

Grants exist on `storage.buckets`, `storage.objects`, and related storage tables for roles `anon` and `authenticated` including **SELECT, INSERT, UPDATE, DELETE** on `objects` and `buckets`.

**Important:** In Supabase Storage, **RLS policies** are the effective control layer; grants alone do not bypass RLS. The dangerous combination is:

1. `{public}` role policies on `storage.objects`, plus
2. **`public: true`** bucket flag for direct CDN/storage URLs.

---

## Dangerous patterns found

| Pattern | Present? | Location |
|---------|----------|----------|
| `USING (true)` on storage.objects | **No** (scoped to bucket_id) | — |
| `WITH CHECK (true)` on storage.objects | **No** | — |
| Broad `{public}` INSERT on private sensitive buckets | **No** for tickets/academy | — |
| `{public}` ALL on bucket | **Yes** | `Allow all operations for images` |
| Anon INSERT on public buckets | **Yes** | images, hero-images, career-documents |
| Anon DELETE on public buckets | **Yes** | images, hero-images |
| Authenticated read-all private files | **No** | — |
| Path-only policy without ownership | **Yes** | All `{public}` bucket_id-only policies |

---

## Repo vs production drift

| Item | Repo migration | Production |
|------|----------------|------------|
| Ticket public SELECT policy removed | Yes (`20260408000000`) | Confirmed absent |
| Career public SELECT policy removed | Yes | Confirmed absent — but bucket still **public** |
| `Allow all operations for images` | **Not in repo** | **Present in production** |

---

## Grants summary

Standard Supabase storage grants to `anon`/`authenticated` on `storage.objects` and `storage.buckets`. Effective access = grants **plus** RLS policy evaluation **plus** bucket `public` flag for direct URLs.
