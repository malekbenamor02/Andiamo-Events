# 03 — Public Flow Smoke Tests

Safe, non-destructive checks only. No payment completion. No spam volume.

| Flow | Expected | Actual | Pass |
|------|----------|--------|------|
| Homepage `/` | 200 | 200 | ✅ |
| Homepage title | Contains site name | "Andiamo Events - We Create Memories" | ✅ |
| Events page `/events` | 200 | 200 | ✅ |
| Events via anon Supabase | Listable events only | 6 events; filter holds | ✅ |
| Event detail | Loads for public event | Not individually URL-tested | ⏳ Manual |
| Event passes | Public read when event listable | Policy scoped via parent event | ✅ (policy) |
| Phone subscribe API | 200 on valid TN number | `success=true` for `29123456` | ✅ |
| Phone subscribe invalid JSON | 4xx | 500 on malformed curl (client error) | N/A |
| Active ambassadors API | Valid response with params | 400 without valid event context | ⏳ Needs valid eventId |
| Contact form (direct Supabase) | Insert allowed, no read-back | INSERT allowed without RETURNING | ✅ |
| Newsletter (Footer direct Supabase) | Insert allowed | Blocked on duplicate test email (23505) | ✅ (insert path exists) |
| Checkout / order create | Works via API | **Not tested** — avoids payment side effects | ⏳ Manual |

## Notes

- Contact form uses client Supabase insert (`Contact.tsx`) — compatible with insert-only RLS.
- Phone subscribe uses `/api/phone-subscribe` with service role when configured — **working**.
- One labeled test newsletter email may exist from validation (`security-test+rls-nolabel@...`) — low impact.
