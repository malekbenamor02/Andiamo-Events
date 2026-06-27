# 08 — Risk register

| ID | Risk | Severity | Mitigation / next action |
|----|------|----------|--------------------------|
| R1 | QR fix not deployed to production | **High** | Deploy API + frontend; smoke admin + email |
| R2 | Token-in-URL for admin preview (`/api/tickets/qr/{uuid}`) | Medium | Acceptable for admin; short private cache; rate limited |
| R3 | Email CID + Brevo REST path | Low | SMTP preferred when attachments; inlineImage for API |
| R4 | `server.cjs` local dev still uses `qr_code_url` | Low | Document; optional follow-up |
| R5 | `src/lib/email.ts` invitation preview helpers | Low | Not production ticket path |
| R6 | Legacy DB rows missing `secure_token` | Medium | Show unavailable UI; investigate data |
| R7 | Production CORP `same-site` on JSON 404 | Low | Route sets `cross-origin` on PNG 200 after deploy |
| R8 | Scanner regression | Low | Unchanged; verify post-deploy |

## Resolved by this fix

- Admin broken QR images after bucket privatization
- Email broken QR hotlinks to Storage
- Email proxy blocking API hotlinks (CID avoids)
