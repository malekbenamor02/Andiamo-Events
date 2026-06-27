# 03 — Email CID QR fix

## Strategy

At send time:

1. `prepareTicketsByPassTypeForEmail` or `prepareQrCodesForInvitationEmail` generates PNG per `secure_token`
2. Attach as nodemailer CID (`contentDisposition: inline`)
3. HTML: `<img src="cid:ticket-qr-{ticketId}">`

No hotlinked Storage URLs. No API URL as primary email image (avoids CORP/proxy issues).

## Files updated

| Flow | File | Helper |
|------|------|--------|
| Online first ticket / CTP success | `misc.js` | `prepareTicketsByPassTypeForEmail` + `buildOnlineTicketEmailHtml` |
| Admin resend tickets | `misc.js` | same |
| Official invitation create | `misc.js` | `prepareQrCodesForInvitationEmail` + `official-invitation-email-html.cjs` |
| Official invitation resend | `misc.js` | same |
| Ambassador order approve | `admin-approve-order.js` | CID in inline HTML |
| POS approve / resend | `admin-pos.js` | `buildPosTicketsReadyEmail` → shared dark template |

## Templates

- `online-ticket-email-html.cjs` — `cid:${ticket.qr_image_cid}`
- `official-invitation-email-html.cjs` — `cid:${qr.qr_image_cid}`

## Transport

`transactional-email.cjs`:

- SMTP (nodemailer): standard `attachments` with `cid`
- Brevo REST: `inlineImage` array when `att.cid` set

## Email clients

CID inline attachments are the reliable path for Gmail, Outlook, Apple Mail. Data-URI and cross-origin API hotlinks avoided.

## Security

- Filenames: `ticket-qr-{ticketId}.png` (no token in filename)
- Logs use `maskTokenForLogs` on generation failure only
- Token snippet removed from email HTML bodies

## Manual test (post-deploy)

1. Resend ticket email for legacy order → QR visible in inbox
2. Approve new POS order → QR in email
3. Resend official invitation → QR in email
4. View raw email source → `Content-ID` attachments present
