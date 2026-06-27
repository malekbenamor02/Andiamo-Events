# 07 — Frontend Bundle Review

## Build artifact scan (`dist/assets/*.js`)

| Pattern | Matches |
|---------|---------|
| `SUPABASE_SERVICE` / `service_role` | **0** |
| `password_hash` | **0** |
| Long JWT-like secrets | **0** in sampled grep |

## Client Supabase usage (`src/`)

### Still uses browser Supabase (expected public)

| Table | Usage |
|-------|-------|
| `events`, `event_passes` | Public listings |
| `site_content`, `sponsors`, `team_members` | Public CMS |
| `payment_options` | Public read |
| `contact_messages` | Contact form insert |
| `newsletter_subscribers` | Footer subscribe insert |
| `site_logs` | Client logging (**insert now denied — see FIND-003**) |

### Private tables — direct client access removed from admin dashboard

`Dashboard.tsx` no longer uses `.from('orders'|'tickets'|'admins'|...)` — routes through `adminApi.ts` / `/api/admin/*`.

### Remaining private-table client access (problematic)

| File | Table | Post-RLS effect |
|------|-------|-----------------|
| `useApplicationSelections.ts` | `ambassador_application_selections`, `_items` | Empty/broken |
| `logger.ts` | `site_logs` | Insert fails (401/RLS) |

## API responses

Unauthenticated admin endpoints return JSON `{ error, reason, valid: false }` — **no password hashes or row payloads**.

## Pass / fail

| Item | Result |
|------|--------|
| Service key in bundle | **Pass** |
| Direct private admin reads in dashboard | **Pass** |
| All private reads eliminated site-wide | **Partial fail** (selections hook + logger) |
