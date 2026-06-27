# 07 — Tests output

## `npm run build`

```
✓ built in 14.85s
[prerender-academy] done
Exit code: 0
```

## `npm run security:storage`

```
PASS: 13  FAIL: 0
```

## Production route probes (current deploy)

| Test | Result |
|------|--------|
| Invalid UUID | 400 `{"error":"Invalid token"}` |
| Unknown valid UUID | 404 `{"error":"Not found"}` |
| Storage public GET tickets | 400 (private) |

## Code grep checks

| Check | Result |
|-------|--------|
| API email templates use `qr_code_url` in `<img>` | **None** in `api/*` |
| Frontend admin QR uses Storage URL | **Fixed** → `qr_display_url` |
| Service role in frontend bundle | security:storage PASS |
| `server.cjs` legacy img | Still present (local dev only) |

## Post-deploy manual matrix

- [ ] Admin legacy order QR preview
- [ ] Admin new order QR preview
- [ ] Email resend legacy ticket (CID)
- [ ] Email new ticket (CID)
- [ ] PDF QR renders
- [ ] Scanner validates token
- [ ] `GET /api/tickets/qr/{valid}` → image/png
