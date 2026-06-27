# 04 — PDF QR verification

## File

`api/_lib/render-premium-ticket-pdf.cjs`

## Behavior (unchanged by this fix)

- QR embedded via `generateTicketQrDataUrl(t.secure_token)` (~322–328)
- Does **not** fetch `qr_code_url` or Storage
- Invitation PDF passes `secure_token` from `qr_tickets` rows (~396)

## Verification

- No code changes required for PDF path in this remediation
- PDF attachment flow in all email senders still calls `tryBuildPremiumTicketsPdfAttachment` unchanged
- Build passes with PDF module present

## Post-deploy smoke

1. Approve/resend order with PDF attachment enabled
2. Open PDF → QR renders at bottom of ticket card
