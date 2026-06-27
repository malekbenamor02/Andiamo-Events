# 08 — Logs Review (Masked Summary)

Source: Supabase API logs (recent window during validation). No PII printed.

## Supabase API — patterns observed

| Pattern | Count (approx.) | Assessment |
|---------|-----------------|------------|
| `POST /rest/v1/site_logs` → **401** | Many | Expected — client logger blocked by RLS |
| `HEAD /rest/v1/admins` etc. → **200** | From validation script | Count-only HEAD; **0 rows** returned to anon |
| `GET /rest/v1/site_content` → 200 | Normal traffic | Public table |
| `POST /rest/v1/rpc/security_rls_policy_audit` → 200 | 1 | Validation script |
| `DELETE /rest/v1/contact_messages` → 204 | 1 | Validation test; **0 rows deleted** |
| Realtime websocket | 101 | Normal |

## Vercel

Not pulled in this session (CLI log export not run). Production deploy status from prior session: **READY** at www.andiamoevents.com.

## Error signals

| Signal | Severity |
|--------|----------|
| site_logs 401 storm from browsers | Low — noisy, not a data leak |
| No 500 spikes tied to admin bootstrap | — |
| phone-subscribe | 200 on valid test after JSON fix |

## RLS denials

Anon insert to private tables returns **42501** — confirms deny policies active.
