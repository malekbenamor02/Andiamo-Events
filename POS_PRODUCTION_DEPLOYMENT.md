# Point de Vente (POS) — Production Deployment Guide

Follow these steps to deploy the POS system to production (Vercel + Supabase).

---

## 1. Database: run migrations on production Supabase

Apply **all POS-related migrations** to your **production** Supabase project, in this order:

| Order | Migration file | Purpose |
|-------|----------------|---------|
| 1 | `20250901000000-create-pos-outlets-table.sql` | POS outlets |
| 2 | `20250901000001-create-pos-users-table.sql` | POS users |
| 3 | `20250901000002-create-pos-pass-stock-table.sql` | Stock per outlet/event/pass |
| 4 | `20250901000003-create-pos-audit-log-table.sql` | Audit log |
| 5 | `20250901000004-alter-orders-for-pos.sql` | Orders columns for POS |
| 6 | `20250901000005-alter-qr-tickets-for-pos-source.sql` | `qr_tickets` for POS |
| 7 | `20250901000006-alter-qr-tickets-payment-method-pos.sql` | `payment_method` in `qr_tickets` |
| 8 | `20250901000007-add-is-active-to-pos-pass-stock.sql` | `is_active` on pass types |

### Option A — Supabase CLI (linked to production)

```bash
# Link to production project (if not already)
npx supabase link --project-ref YOUR_PROJECT_REF

# Push all pending migrations
npx supabase db push
```

### Option B — Supabase Dashboard (SQL Editor)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your **production** project.
2. **SQL Editor** → New query.
3. For each file above, open `supabase/migrations/<filename>`, copy its contents, paste into the editor, run.

---

## 2. Vercel: environment variables

In **Vercel** → Project → **Settings** → **Environment Variables**, set these for **Production** (and Preview if you use it):

### Required for POS

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon key | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (backend only) | `eyJ...` |
| `JWT_SECRET` | Same secret used for admin JWT | strong random string |

### Required for POS emails & SMS

| Variable | Description |
|----------|-------------|
| `EMAIL_HOST` | SMTP host |
| `EMAIL_PORT` | e.g. `587` |
| `EMAIL_USER` | SMTP user |
| `EMAIL_PASS` | SMTP password |
| `WINSMS_API_KEY` | For order SMS (optional but recommended) |

### Frontend (build-time)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | Same as `SUPABASE_ANON_KEY` |

Copy from `env.example` and replace with your production values. Do **not** commit `.env` or real secrets.

---

## 3. Deploy to Vercel

### From Git (recommended)

```bash
# Commit and push
git add .
git commit -m "feat: POS system ready for production"
git push origin main
```

If the project is connected to Vercel, pushing `main` will trigger a production deploy.

### From Vercel CLI

```bash
npx vercel --prod
```

---

## 4. After deploy: sanity checks

1. **Admin Dashboard**
   - Log in as admin.
   - Open the **Point de Vente (POS)** tab.
   - Create an **Outlet** (name + slug, e.g. `Main Store` → `main-store`).
   - Create a **POS User** (outlet, name, email, password).
   - For an event, add **Stock** (outlet, event, pass, max quantity). Toggle **Active** to verify.

2. **POS Login**
   - Go to: `https://yourdomain.com/pos/main-store` (use your outlet slug).
   - Log in with the POS user.
   - Confirm **Event** is pre-selected and **Pass** list and steppers work.

3. **Create order**
   - Select passes, fill customer (name, phone, email), submit.
   - Check: success popup, SMS to customer (if `WINSMS_API_KEY` is set), order-received email.

4. **Admin: orders and tickets**
   - In POS tab → **Orders**: new order in **PENDING_ADMIN_APPROVAL**.
   - **Approve** → client should receive tickets email (if email configured).
   - **Resend** buttons (order-received / tickets) only when applicable (e.g. tickets only when **PAID**).

---

## 5. Routes already in `vercel.json`

These are already configured; no change needed:

- `/api/pos/:path*` → `api/pos.js` (login, verify, events, passes, orders/create)
- `/api/admin/pos-outlets`, `/api/admin/pos-outlets/:id`
- `/api/admin/pos-users`, `/api/admin/pos-users/:id`
- `/api/admin/pos-stock`, `/api/admin/pos-stock/:id`
- `/api/admin/pos-orders`, `.../approve`, `.../reject`, `.../remove`, `.../resend-order-received`, `.../resend-tickets-email`, `.../:id` (PATCH email)
- `/api/admin/pos-statistics`, `/api/admin/pos-audit-log`, `/api/admin/pos-events`

---

## 6. Optional: storage and RLS

- **Tickets bucket**: if you use `tickets` for QR images, ensure the bucket exists in production and RLS/storage policies allow your backend (service role) to read/write.
- **RLS**: `pos_outlets`, `pos_users`, `pos_pass_stock`, `pos_audit_log` and related tables should have policies that match your design (e.g. service role for server, anon/authenticated as needed). Default migrations are intended to work with the service role used in `api/pos.js` and `api/admin-pos.js`.

---

## Quick checklist

- [ ] All 8 POS migrations applied on **production** Supabase
- [ ] Production env vars set in Vercel (Supabase, JWT, Email, optional WinSMS)
- [ ] `git push` or `vercel --prod` done
- [ ] Admin: create outlet, POS user, and stock
- [ ] POS: login at `/pos/<slug>`, create order, check SMS/email
- [ ] Admin: approve order, resend tickets when PAID
