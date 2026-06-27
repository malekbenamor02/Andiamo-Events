# 05 — Frontend Supabase Usage

All findings from static grep of `src/**`, `src/integrations/supabase/client.ts`, and `src/lib/ticketGenerationService.tsx`.  
**Client:** `@/integrations/supabase/client` uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (publishable anon key).  
**Side:** All entries below are **client-side** (browser bundle) unless noted.

**Env note:** Project uses `VITE_*` (Vite), not `NEXT_PUBLIC_*`. No `NEXT_PUBLIC_SUPABASE` references found in repo.

---

## Supabase client initialization

| File | Lines | Table | Op | Risk | Fix |
|------|------:|-------|----|----|-----|
| `src/integrations/supabase/client.ts` | 19–25 | (client) | N/A | Medium | Anon key in bundle is expected; RLS must deny by default |
| `src/lib/ticketGenerationService.tsx` | 76–83 | (alt client) | N/A | High | Creates own client with anon key for ticket ops |

---

## admins

| File | Lines | Table | Op | Risk | Fix |
|------|------:|-------|----|----|-----|
| — | — | admins | — | — | **No direct `from('admins')` in src/** |

---

## orders

| File | Lines | Table | Op | Risk | Fix |
|------|------:|-------|----|----|-----|
| `src/lib/orders/orderService.ts` | 122, 187, 223, 250 | orders | SELECT/UPDATE | **Critical** | Move to API; fix RLS |
| `src/lib/orders/cancellationService.ts` | 119 | orders | SELECT/UPDATE | **Critical** | API-only |
| `src/lib/ambassadorOrders.ts` | 45, 54, 96, 123, 153 | orders | SELECT/UPDATE | **High** | Ambassador API routes exist — use exclusively |
| `src/lib/ambassadors/ambassadorSalesService.ts` | 26, 121 | orders | SELECT | **High** | API-only |
| `src/lib/ticketGenerationService.tsx` | 455 | orders | SELECT | **Critical** | Server-side ticket generation only |

---

## tickets

| File | Lines | Table | Op | Risk | Fix |
|------|------:|-------|----|----|-----|
| `src/lib/ticketGenerationService.tsx` | 140, 153, 180, 229, 243, 256, 434, 490, 498 | tickets | SELECT/INSERT/UPDATE | **Critical** | Backend-only; tokens must not be client-writable |
| `src/lib/ticketGenerationService.tsx` | 567 | qr_tickets | INSERT | **High** | Server-only |

---

## ambassadors / applications

| File | Lines | Table | Op | Risk | Fix |
|------|------:|-------|----|----|-----|
| `src/pages/admin/Dashboard.tsx` | 745, 2437, 3290, 4780, 5547–5549, 5661+ (many) | ambassadors, ambassador_applications | SELECT/UPDATE/INSERT/DELETE | **Critical** | Admin API routes in misc.js |
| `src/lib/ambassadors/ambassadorService.ts` | 33, 59, 76, 96 | ambassadors | SELECT/UPDATE | **High** | API |
| `src/lib/analytics/reportsExcelExport.ts` | 352, 377 | ambassadors | SELECT | **High** | Admin export API |
| `src/pages/admin/hooks/useApplicationSelections.ts` | 41–252 | ambassador_application_selections, _items | ALL | **High** | API |
| `src/pages/admin/components/AmbassadorsTab.tsx` | 1015 | ambassador_applications | SELECT | High | API |

---

## events / passes (public + admin)

| File | Lines | Table | Op | Risk | Fix |
|------|------:|-------|----|----|-----|
| `src/hooks/useEvents.ts` | 54, 75, 123, 145, 191, 214 | events, event_passes | SELECT | Medium | Public read OK if RLS scoped; admin writes should use API |
| `src/pages/PassPurchase.tsx` | 710, 721, 736 | events | SELECT | Medium | Line 721 `select('*')` — avoid over-fetch |
| `src/pages/admin/Dashboard.tsx` | 5417, 5548 | events, event_passes | SELECT | High | Admin API |
| `src/lib/analytics/reportsExcelExport.ts` | 340, 437, 453 | event_passes, order_passes | SELECT | High | API |

---

## contact / subscribers / messages

| File | Lines | Table | Op | Risk | Fix |
|------|------:|-------|----|----|-----|
| `src/pages/Contact.tsx` | 113 | contact_messages | INSERT | Low | OK for public submit; fix SELECT RLS |
| `src/pages/admin/Dashboard.tsx` | 8571, 8785, 8807 | contact_messages | SELECT/UPDATE | **High** | Admin API |
| `src/pages/admin/Dashboard.tsx` | 3252–3946 | phone_subscribers, newsletter_subscribers | SELECT/UPDATE/DELETE | **Critical** | Admin API |
| `src/components/layout/Footer.tsx` | 147 | newsletter_subscribers | INSERT | Low | OK |

---

## site_content / CMS

| File | Lines | Table | Op | Risk | Fix |
|------|------:|-------|----|----|-----|
| `src/hooks/useSiteContent.ts` | 13, 44 | site_content | SELECT/UPDATE | Medium | Public read OK |
| `src/pages/admin/Dashboard.tsx` | 1976+ (multiple) | site_content | SELECT/UPSERT | Medium | Prefer `/api/admin/site-content/*` |
| `src/lib/favicon.ts` | 128, 144, 198, 238 | site_content | UPDATE | Medium | API |

---

## logs

| File | Lines | Table | Op | Risk | Fix |
|------|------:|-------|----|----|-----|
| `src/lib/logger.ts` | 78 | site_logs | INSERT | Medium | Open INSERT policy |
| `src/pages/admin/Dashboard.tsx` | 4205, 4230 | sms_logs, site_logs | SELECT | High | Admin API |

---

## storage (Supabase Storage)

| File | Lines | Bucket | Op | Risk | Fix |
|------|------:|--------|----|----|-----|
| `src/lib/favicon.ts` | 101–123, 193 | images | list/upload/remove | Medium | Storage policies not in scope; verify bucket RLS |

---

## localStorage / sessionStorage

| File | Lines | Usage | Risk | Fix |
|------|------:|-------|------|-----|
| `src/integrations/supabase/client.ts` | 21 | Supabase Auth persistence | Low | Not used for admin JWT |
| `src/lib/admin-verify-cache.ts` | 6 | `ADMIN_SESSION_PENDING_KEY` | Low | Verify cache only |
| `src/pages/admin/Login.tsx` | 320 | sessionStorage pending flag | Low | OK |
| `src/pages/scanner/*.tsx` | 26, 54, 64 | Scanner event session | Medium | Separate from admin |
| `src/hooks/usePhoneCapture.ts` | 14+ | Marketing popup state | Low | OK |
| `src/App.tsx` | 93, 113 | Theme preference | Low | OK |

**adminSession / ambassadorSession:** No variable named `adminSession` or `ambassadorSession` in localStorage. Ambassador session is server cookie/API (`src/lib/api-client.ts` lines 59–93).

---

## Highest-risk client paths (priority fix)

1. `src/pages/admin/Dashboard.tsx` — bulk direct access to PII tables  
2. `src/lib/ticketGenerationService.tsx` — ticket/token mutations from browser  
3. `src/lib/orders/*.ts` — order reads/writes from browser  
4. `src/lib/ambassadorOrders.ts` — order access from ambassador portal  

---

## Search terms executed

See `10-code-search-log.md` for full search log including `createClient(`, `supabase.from(`, `from('admins'`, `from('orders'`, `from('tickets'`, `localStorage`, `adminSession`, `ambassadorSession`, `NEXT_PUBLIC_SUPABASE`, `VITE_SUPABASE`.
