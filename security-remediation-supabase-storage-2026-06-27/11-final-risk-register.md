# Remaining Risk Register (post-remediation)

| ID | Severity | Item | Notes |
|----|----------|------|-------|
| R-01 | Medium | Legacy ticket public URLs in old emails | API route replaces function; cached email images may still work until bucket private |
| R-02 | Medium | 1,431 legacy PNGs in private tickets bucket | Orphan storage cost; optional cleanup later |
| R-03 | Low | `events` bucket (1 object) | Legacy; review contents |
| R-04 | Low | Audit test `.txt` files in career-documents | From pre-remediation spot checks; delete with service role |
| R-05 | Low | Ticket QR rate limit 60/min/IP | Monitor; tune if Brevo prefetch triggers 429 |
| R-06 | Info | Migration not yet on production | Anon upload still possible until SQL applied |
