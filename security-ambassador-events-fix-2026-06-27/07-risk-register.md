# Risk register

| ID | Risk | Severity | Owner / action |
|----|------|----------|----------------|
| R-001 | Ambassador sees all sellable events (no per-ambassador assignment table) | Low | By design; same as pre-RLS behavior |
| R-002 | Completed events within 30-day lookback still listed | Low | Matches admin selector; intentional |
| R-003 | Other ambassador pages still use browser Supabase (Application settings) | Medium | Out of scope; separate audit |
| R-004 | Malek may have zero orders on current presale events | Info | Expected; UI shows empty order state |
| R-005 | Session cookie required for events API | Low | Same as orders; correct |
