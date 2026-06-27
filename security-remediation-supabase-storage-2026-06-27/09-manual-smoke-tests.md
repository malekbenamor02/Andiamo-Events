# Manual Smoke Tests

## Ticket / QR

- [ ] Approve or create order → tickets generated
- [ ] `qr_code_url` points to `/api/tickets/qr/{uuid}` (not supabase.co/storage)
- [ ] Open QR URL in browser → PNG displays
- [ ] Ticket email renders QR images (Brevo fetch to API URL)
- [ ] Scanner validates ticket via existing scan API

## Career

- [ ] Submit application with PDF on `/careers/{slug}/apply`
- [ ] `form_data` contains `storage:career-documents/...` ref (not public URL)
- [ ] Admin → Careers → view application → Download document opens via signed URL

## Admin media

- [ ] Upload event poster (Dashboard)
- [ ] Upload hero image
- [ ] Delete/replace image
- [ ] Public site still renders existing poster URLs

## Regression

- [ ] `npm run security:storage` all PASS (after migration)
- [ ] `npm run build` PASS

## Anon abuse (post-migration)

- [ ] Anon upload to `images` → rejected
- [ ] Anon delete from `images` → rejected
