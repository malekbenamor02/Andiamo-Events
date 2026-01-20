# Point de Vente (POS) – Implementation Plan

> **Scope:** Plan only. No code changes until approved.

---

## 1. Overview

**Point de Vente (POS)** is a separate sales channel where:

- **Multiple Points de Vente (outlets):** Admin/super_admin can create **more than one** point de vente. Each has a **name** and a **unique link** (URL slug derived from the name, e.g. `paris-store`, `tunis-mall`). The **link is the identifier** of that outlet: e.g. `/pos/paris-store/login`, `/pos/paris-store/dashboard`. Each outlet has its own **pos_users** and its own **pos_pass_stock**.
- POS users log in at **their outlet’s URL** (e.g. `/pos/paris-store`) and create orders (full name, phone, email, pass selection) for **all pass types**.
- On submit: client receives **SMS + email** (same style as pass-purchase order confirmation).
- Orders are **pending** until an **admin** approves, rejects, or removes them.
- POS uses **its own pass stock per outlet** and **its own metrics**; it does **not** affect main `event_passes` stock or official order analytics.

**Admins (admin and super_admin – same capabilities):**

- **POS outlets:** create (name → slug/link), edit, remove.
- **POS users:** create (under an outlet), edit, remove, pause. **Admin can edit the password of any pos_user (all points de vente).** Password change via PATCH; no previous-password check; never return `password` or `password_hash` in any API response.
- **POS stock:** per outlet; edit per event/pass at any time.
- **POS orders:** view, approve, reject, remove, view full info, **resend email**, **edit client email** (then resend).
- **Auditability:** every admin action is logged with **who** did it (admin_id, email), **when**, **what** (action, target), and **context** (IP, user-agent, old/new values where relevant). Same for POS-created orders (pos_user_id).

**POS users:**

- See **remaining** and **sold** per pass (from POS stock only).

---

## 2. Architecture Summary

| Layer | Detail |
|-------|--------|
| **URL** | `/pos/:outletSlug` (e.g. `/pos/paris-store`, `/pos/tunis-mall`). The **link is the outlet slug** (from the outlet name). Each outlet has a **specific link**; multiple outlets = multiple links. |
| **Outlets** | Table `pos_outlets` (id, name, slug UNIQUE, is_active, created_by, timestamps). Admin creates many; slug derived from name (lowercase, spaces→hyphens, `[a-z0-9-]`); must be unique. |
| **Auth** | POS login at `/pos/:outletSlug/login`. JWT contains `pos_user_id`, `pos_outlet_id`; no Supabase Auth. **Backend only** validates outlet (by slug) and user (email+password, is_active, !is_paused). Never trust frontend for auth state. |
| **Orders** | `orders.source = 'point_de_vente'`, `orders.pos_user_id`, `orders.pos_outlet_id`, `payment_method = 'pos'`. |
| **Stock** | `pos_pass_stock` **per outlet**: (pos_outlet_id, event_id, pass_id, max_quantity, sold_quantity). **Never** touch `event_passes.sold_quantity` for POS. |
| **SMS/Email** | Reuse/adapt: client SMS + order confirmation email on **create**; completion email (with tickets) on **approve**. |
| **Audit** | `pos_audit_log` for every change: who (admin or pos_user), what, when, IP, user_agent. |
| **Trust** | **Never trust frontend.** All auth, stock, prices, and business rules enforced **server-side only**. No sensitive data (passwords, JWT, PII) in API responses, console, or storage. |

---

## 3. Database

### 3.1 New Tables

#### `pos_outlets`

Admin/super_admin can create **more than one** point de vente. Each has a **name** and a **slug** used as the **link** (e.g. `/pos/paris-store`).

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK, `gen_random_uuid()` |
| `name` | TEXT | NOT NULL. Display name (e.g. "Paris Store", "Tunis Mall"). |
| `slug` | TEXT | NOT NULL, UNIQUE. URL-safe: lowercase, `[a-z0-9-]`, derived from name (spaces→hyphens). This is the **link** for that outlet (e.g. `paris-store` → `/pos/paris-store`). |
| `is_active` | BOOLEAN | NOT NULL, default true. When false, login at this outlet is blocked. |
| `created_by` | UUID | FK `admins(id)` ON DELETE SET NULL |
| `created_at` | TIMESTAMPTZ | default NOW() |
| `updated_at` | TIMESTAMPTZ | default NOW() |

- **Slug rules:** Max length (e.g. 64). Sanitize: `[^a-z0-9-]` → `-`, trim `-`, collapse repeated `-`. If slug exists, API returns 400 with suggested alternatives (e.g. `paris-store-2`). Admin can optionally override slug on create/edit.
- RLS: backend only. No direct Supabase client access.
- Indexes: `(slug)` UNIQUE, `(is_active)`.

#### `pos_users`

Each pos_user belongs to **one** `pos_outlets`. Email is unique **per outlet** (same email can exist in different outlets).

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK, `gen_random_uuid()` |
| `pos_outlet_id` | UUID | NOT NULL, FK `pos_outlets(id)` ON DELETE CASCADE (or SET NULL per product choice). |
| `name` | TEXT | NOT NULL |
| `email` | TEXT | NOT NULL |
| `password_hash` | TEXT | NOT NULL. **Never** exposed in any API response. |
| `is_active` | BOOLEAN | NOT NULL, default true |
| `is_paused` | BOOLEAN | NOT NULL, default false. When true, login blocked. |
| `created_by` | UUID | FK `admins(id)` ON DELETE SET NULL |
| `created_at` | TIMESTAMPTZ | default NOW() |
| `updated_at` | TIMESTAMPTZ | default NOW() |

- UNIQUE `(pos_outlet_id, LOWER(email))`.
- RLS: backend only. No direct Supabase client access.
- Indexes: `(pos_outlet_id)`, `(pos_outlet_id, LOWER(email))`, `(is_active)`, `(is_paused)`, `(created_by)`.
- **Password:** Admin can **edit the password of any pos_user** (all outlets) via PATCH. Never return `password` or `password_hash` in GET/POST/PATCH responses.

#### `pos_pass_stock`

Stock is **per outlet**. Each outlet has its own `max_quantity` and `sold_quantity` per (event_id, pass_id).

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `pos_outlet_id` | UUID | NOT NULL, FK `pos_outlets(id)` ON DELETE CASCADE |
| `event_id` | UUID | NOT NULL, FK `events(id)` ON DELETE CASCADE |
| `pass_id` | UUID | NOT NULL, FK `event_passes(id)` ON DELETE CASCADE |
| `max_quantity` | INTEGER | NULL = unlimited |
| `sold_quantity` | INTEGER | NOT NULL, default 0 |
| `updated_at` | TIMESTAMPTZ | default NOW() |

- UNIQUE `(pos_outlet_id, event_id, pass_id)`.
- Check: `sold_quantity >= 0`, `max_quantity IS NULL OR max_quantity >= 0`, `max_quantity IS NULL OR sold_quantity <= max_quantity`.
- RLS: admin full access; POS users read-only via API (filtered by their `pos_outlet_id`).
- **Admin can change `max_quantity` and `sold_quantity` at any time** (e.g. corrections, manual allocation).

**Initial data:** Admin creates rows per outlet when configuring POS stock for an event. `sold_quantity` starts at 0.

#### `pos_audit_log` (auditability: who did what, when, and context)

Every admin and POS action that changes data is recorded so it is always possible to know **who** did **what** and **when**.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK, `gen_random_uuid()` |
| `action` | TEXT | NOT NULL. One of: `create_pos_outlet`, `update_pos_outlet`, `delete_pos_outlet`, `create_pos_user`, `update_pos_user`, `delete_pos_user`, `pause_pos_user`, `unpause_pos_user`, `create_pos_stock`, `update_pos_stock`, `create_pos_order`, `approve_pos_order`, `reject_pos_order`, `remove_pos_order`, `resend_pos_order_email`, `update_pos_order_email`. |
| `performed_by_type` | TEXT | NOT NULL. `'admin'` or `'pos_user'`. |
| `performed_by_id` | UUID | NOT NULL. `admins.id` or `pos_users.id`. |
| `performed_by_email` | TEXT | Denormalized for display and search (admin or pos_user email). |
| `pos_outlet_id` | UUID | NULL, FK `pos_outlets(id)`. Set when the action concerns an outlet or a user/order/stock of that outlet. Enables "show all for this outlet". |
| `target_type` | TEXT | NOT NULL. `'pos_outlet'`, `'pos_user'`, `'pos_pass_stock'`, `'order'`. |
| `target_id` | UUID | NOT NULL. PK of the affected row. |
| `details` | JSONB | Optional. `old_value`, `new_value`, `reason`, `field_changed`, etc. No passwords, tokens, or full PII. |
| `ip_address` | TEXT | Client IP (from `X-Forwarded-For`, `X-Real-IP`, or `req.ip`). |
| `user_agent` | TEXT | Request `User-Agent`. |
| `created_at` | TIMESTAMPTZ | NOT NULL, default NOW(). |

- **RLS:** Access only via backend (service_role). Admins read via `GET /api/admin/pos-audit-log` with filters.
- **Indexes:** `(action)`, `(performed_by_type, performed_by_id)`, `(target_type, target_id)`, `(created_at)`.
- **When to write:** On every POS-related create/update/delete/approve/reject/remove/resend/update-email. Never log passwords, tokens, or full PII in `details`.

### 3.2 Changes to Existing Tables

#### `orders`

- `source`: add `'point_de_vente'` to `CHECK (source IN ('platform_cod', 'platform_online', 'ambassador_manual', 'official_invitation', 'point_de_vente'))`.
- `pos_outlet_id` UUID NULL, FK `pos_outlets(id)` ON DELETE SET NULL. Set when `source = 'point_de_vente'`. **Which outlet** the order was created at.
- `pos_user_id` UUID NULL, FK `pos_users(id)` ON DELETE SET NULL. Set only when `source = 'point_de_vente'`. **Who created** the POS order.
- `payment_method`: add `'pos'` to existing check. Used when `source = 'point_de_vente'`.
- **Auditability (who did what):** `approved_by` UUID NULL FK `admins(id)`, `rejected_by` UUID NULL FK `admins(id)`, `removed_by` UUID NULL FK `admins(id)`. Set on approve/reject/remove; used for quick display; full history in `pos_audit_log`.

#### `order_passes`

- No schema change. `order_id` → `orders`; `pass_id` → `event_passes`. POS orders use the same structure.

#### `qr_tickets`

- `source`: add `'point_de_vente'` where applicable in the CHECK / allowed sources so tickets can be generated for approved POS orders.

#### `event_passes` and `sold_quantity`

- **No change.** POS must **never** increment/decrement `event_passes.sold_quantity`. Any existing trigger or app logic that updates `event_passes.sold_quantity` from `order_passes` must **exclude** `orders` with `source = 'point_de_vente'` (if any such logic exists).

### 3.3 Migrations to Add

1. `create-pos-outlets-table.sql`
2. `create-pos-users-table.sql` (includes `pos_outlet_id` FK)
3. `create-pos-pass-stock-table.sql` (includes `pos_outlet_id`; UNIQUE `(pos_outlet_id, event_id, pass_id)`)
4. `create-pos-audit-log-table.sql` (includes `pos_outlet_id` nullable; `target_type` includes `'pos_outlet'`)
5. `alter-orders-for-pos.sql` (source, pos_outlet_id, pos_user_id, payment_method, approved_by, rejected_by, removed_by)
6. `alter-qr-tickets-for-pos-source.sql` (if needed)
7. RLS and triggers for `pos_outlets`, `pos_users`, `pos_pass_stock`, `pos_audit_log`

---

## 4. Backend (API)

### 4.1 POS Auth (per outlet: `/api/pos/:outletSlug/...`)

All POS routes include **`:outletSlug`** in the path. The backend **resolves the outlet by slug** (never from body or headers). **Never trust frontend** for outlet identity.

- **POST `/api/pos/:outletSlug/login`**  
  - Body: `{ email, password }`.  
  - **Backend:** Resolve `pos_outlets` by `slug = :outletSlug`; 404 if not found or `is_active = false`.  
  - Find `pos_users` where `pos_outlet_id = outlet.id` and `LOWER(email) = LOWER($email)`.  
  - Verify `password_hash` (bcrypt), `is_active = true`, `is_paused = false`. **Re-check from DB;** do not trust any frontend flag.  
  - Return JWT with `pos_user_id`, `pos_outlet_id`, `role: 'pos'` (no password, no `password_hash`).  
  - Set HTTP-only, Secure, SameSite cookie or `Authorization: Bearer`. **Never** put JWT in response JSON body or in `localStorage`/`sessionStorage` (cookie preferred so it does not enter JS).

- **POST `/api/pos/:outletSlug/logout`**  
  - Clear POS session/cookie.

- **GET `/api/pos/:outletSlug/verify`**  
  - Resolve outlet by `:outletSlug`; verify JWT has `pos_outlet_id === outlet.id` and `pos_user_id`.  
  - **Re-validate from DB:** user exists, `is_active`, `!is_paused`. Return 401 if invalid or paused.

**Middleware:** `requirePosAuth(outletSlug)` — resolve outlet by slug; verify JWT `pos_outlet_id` matches `outlet.id` and `pos_user_id`; optionally re-check user `is_paused` from DB. **Never** use frontend-supplied outlet or user state for auth.

### 4.2 Admin: POS Outlets (Admin and Super Admin – same)

Admin can create **more than one** point de vente. Each has a **name** and a **slug** (the **link**). The slug is derived from the name; admin can override.

- **GET `/api/admin/pos-outlets`**  
  - List all `pos_outlets` (id, name, slug, is_active, created_at, created_by). Include **full link** (e.g. `https://site.com/pos/paris-store`) for copying. **Never** return secrets.  
  - `requireAdminAuth`.

- **POST `/api/admin/pos-outlets`**  
  - Body: `{ name, slug? }`. If `slug` omitted, derive from `name` (lowercase, spaces→`-`, `[a-z0-9-]`). If `slug` exists, return 400 with `suggestedSlugs`.  
  - Create `pos_outlets`.  
  - **Audit:** `pos_audit_log`: action=`create_pos_outlet`, performed_by=admin, target=pos_outlet, pos_outlet_id, + IP, user_agent.  
  - `requireAdminAuth`.

- **PATCH `/api/admin/pos-outlets/:id`**  
  - Body: `{ name?, slug?, is_active? }`. If `slug` changed, must stay unique.  
  - **Audit:** `pos_audit_log`: action=`update_pos_outlet`, performed_by=admin, target=pos_outlet, details={ old, new }.  
  - `requireAdminAuth`.

- **DELETE `/api/admin/pos-outlets/:id`**  
  - Soft or hard delete. If hard: `pos_users.pos_outlet_id` and `orders.pos_outlet_id` SET NULL or CASCADE per design.  
  - **Audit:** `pos_audit_log`: action=`delete_pos_outlet`, performed_by=admin, target=pos_outlet.  
  - `requireAdminAuth`.

### 4.3 Admin: POS Users (Admin and Super Admin – same)

- **GET `/api/admin/pos-users`**  
  - Query: `?pos_outlet_id=` (optional). List `pos_users` (id, name, email, is_active, is_paused, pos_outlet_id, created_at, created_by). **Never** return `password`, `password_hash`, or any secret.  
  - `requireAdminAuth`.

- **POST `/api/admin/pos-users`**  
  - Body: `{ pos_outlet_id, name, email, password }`. `pos_outlet_id` required. Create `pos_users`, hash password.  
  - **Audit:** `pos_audit_log`: action=`create_pos_user`, performed_by=admin, target=pos_user, pos_outlet_id, + IP, user_agent.  
  - `requireAdminAuth`.

- **PATCH `/api/admin/pos-users/:id`**  
  - Body: `{ name?, email?, password?, is_active?, is_paused? }`.  
  - **Admin can edit the password of any pos_user (all points de vente).** No previous-password check. If `password` provided, rehash and store; in audit `details` use `password_changed: true` only, **never** the value.  
  - **Audit:** `pos_audit_log`: action=`update_pos_user` or `pause_pos_user`/`unpause_pos_user`; performed_by=admin; details={ old, new } (no passwords).  
  - **Never** return `password` or `password_hash` in the PATCH response.  
  - `requireAdminAuth`.

- **DELETE `/api/admin/pos-users/:id`**  
  - Soft or hard delete. If hard, `orders.pos_user_id` → SET NULL.  
  - **Audit:** `pos_audit_log`: action=`delete_pos_user`, performed_by=admin, target=pos_user.  
  - `requireAdminAuth`.

### 4.4 Admin: POS Stock (Admin and Super Admin – same)

Stock is **per outlet**. All stock endpoints require `pos_outlet_id`.

- **GET `/api/admin/pos-stock?event_id=...&pos_outlet_id=...`**  
  - `pos_outlet_id` required. For that outlet and `event_id`, return `pos_pass_stock` joined with `event_passes` (pass name, price, etc.) and `remaining = max_quantity - sold_quantity` (null if unlimited).  
  - `requireAdminAuth`.

- **PUT `/api/admin/pos-stock/:id` or `PATCH`**  
  - Body: `{ max_quantity?, sold_quantity? }`.  
  - Validation: `sold_quantity >= 0`; if `max_quantity` is set and not null, `sold_quantity <= max_quantity`.  
  - **Audit:** `pos_audit_log`: action=`update_pos_stock`, performed_by=admin, target=pos_pass_stock, pos_outlet_id, details={ old, new }.  
  - `requireAdminAuth`.

- **POST `/api/admin/pos-stock`**  
  - Body: `{ pos_outlet_id, event_id, pass_id, max_quantity, sold_quantity? }`. `pos_outlet_id` required. Create row if missing for (pos_outlet_id, event_id, pass_id).  
  - **Audit:** `pos_audit_log`: action=`create_pos_stock`, performed_by=admin, target=pos_pass_stock, pos_outlet_id.  
  - `requireAdminAuth`.

### 4.5 Admin: POS Orders (Admin and Super Admin – same)

- **GET `/api/admin/pos-orders`**  
  - Query params: `status`, `event_id`, `pos_outlet_id`, pagination.  
  - Filter: `orders.source = 'point_de_vente'`. Include `pos_outlet_id` and outlet (name, slug) for "which outlet"; `approved_by`, `rejected_by`, `removed_by` joined to `admins` (id, email) for "who did it" in list/detail.  
  - Exclude from main "official" order lists and analytics.  
  - `requireAdminAuth`.

- **POST `/api/admin/pos-orders/:id/approve`**  
  - Set `orders.status = 'PAID'`, `orders.approved_by = req.admin.id`.  
  - Generate tickets; call completion-email flow (ambassador-optional for `point_de_vente`).  
  - Do **not** touch `event_passes.sold_quantity`.  
  - **Audit:** `pos_audit_log`: action=`approve_pos_order`, performed_by=admin, target=order.  
  - `requireAdminAuth`.

- **POST `/api/admin/pos-orders/:id/reject`**  
  - Body: `{ reason? }`.  
  - Set `orders.status = 'REJECTED'`, `cancelled_by='admin'`, `cancellation_reason`, `cancelled_at`, `orders.rejected_by = req.admin.id`.  
  - **Decrement `pos_pass_stock.sold_quantity`** for each `order_passes` row, where `pos_pass_stock.pos_outlet_id = order.pos_outlet_id` and (event_id, pass_id) match.  
  - **Audit:** `pos_audit_log`: action=`reject_pos_order`, performed_by=admin, target=order, details={ reason }.  
  - `requireAdminAuth`.

- **POST `/api/admin/pos-orders/:id/remove`**  
  - Set `orders.status = 'REMOVED_BY_ADMIN'`, `orders.removed_by = req.admin.id`.  
  - **Decrement `pos_pass_stock.sold_quantity`** for each `order_passes` row, where `pos_pass_stock.pos_outlet_id = order.pos_outlet_id` and (event_id, pass_id) match.  
  - **Audit:** `pos_audit_log`: action=`remove_pos_order`, performed_by=admin, target=order.  
  - `requireAdminAuth`.

- **POST `/api/resend-order-completion-email` (existing)**  
  - Extend to support `source = 'point_de_vente'` (no ambassador in template).  
  - **Audit:** `pos_audit_log`: action=`resend_pos_order_email`, performed_by=admin, target=order.  
  - `requireAdminAuth` (or ensure already present).

- **POST `/api/admin/update-order-email` (existing)**  
  - Ensure it applies to POS orders (`source = 'point_de_vente'`).  
  - **Audit:** `pos_audit_log`: action=`update_pos_order_email`, performed_by=admin, target=order, details={ field: 'user_email' } (no raw emails in details).  
  - `requireAdminAuth`.

- **GET `/api/admin/pos-audit-log`**  
  - Query params: `action`, `performed_by_id`, `target_type`, `target_id`, `from`, `to`, limit, offset.  
  - Returns `pos_audit_log` rows. For `update_pos_order_email`, do not expose raw old/new email.  
  - `requireAdminAuth`.

### 4.6 POS: Orders (POS User)

- **POST `/api/pos/:outletSlug/orders/create`**  
  - `requirePosAuth(outletSlug)`: resolve outlet by `:outletSlug`; verify JWT `pos_outlet_id === outlet.id` and `pos_user_id`. **Never** trust frontend for outlet or user.  
  - Body: `{ customerInfo: { full_name, phone, email [, city, ville ] }, passes: [ { passId, passName, quantity, price } ], eventId }`.  
  - Validations **server-side only:** `event_id`, `pass_id` exist and `pass_id` belongs to `event_id`; for each pass, **POS stock for this outlet** (`pos_pass_stock` where `pos_outlet_id = outlet.id`): if `max_quantity` is not null, `sold_quantity + quantity <= max_quantity`. **Do not** read or write `event_passes.sold_quantity`.  
  - Insert `orders`: `source = 'point_de_vente'`, `pos_outlet_id = outlet.id`, `pos_user_id`, `payment_method = 'pos'`, `event_id`, `user_name`, `user_phone`, `user_email`, `city`, `ville`, `quantity` (total), `total_price`, `status = 'PENDING_ADMIN_APPROVAL'`, `ambassador_id = NULL`, `stock_released` false.  
  - Insert `order_passes` with `pass_id`, `pass_type`, `quantity`, `price`.  
  - **Increment `pos_pass_stock.sold_quantity`** by `quantity` for each (pos_outlet_id, event_id, pass_id) of **this outlet**.  
  - **Audit:** `pos_audit_log`: action=`create_pos_order`, performed_by=pos_user, target=order, pos_outlet_id, + IP, user_agent.  
  - Then: **SMS to client** (POS template, no ambassador), **Email to client** (order received, pending approval).  
  - Return created order (with `order_passes`). **Never** include `password`, `password_hash`, or internal-only fields in the response.

### 4.7 POS: Passes and Stock (Read-Only for POS)

- **GET `/api/pos/:outletSlug/events`** – `requirePosAuth(outletSlug)`. Return events that have at least one `pos_pass_stock` row for `pos_outlet_id = outlet.id`.  
- **GET `/api/pos/:outletSlug/passes/:eventId`** – `requirePosAuth(outletSlug)`. From `pos_pass_stock` (where `pos_outlet_id = outlet.id`) + `event_passes`: `remaining`, `sold_quantity`. **Never** trust frontend for stock numbers; always from DB.

### 4.8 SMS and Email Adaptations

- **Client SMS (on POS order create):** POS-specific or ambassador-optional template; no ambassador.
- **Client email (on POS order create):** "Order received, pending admin approval."
- **Completion email (on admin approve):** ambassador block optional for `source = 'point_de_vente'`; ticket generation as for COD.

---

## 5. Frontend

### 5.1 Routes and Layout

- Base path: **`/pos/:outletSlug`**. The **link is the outlet slug** (e.g. `/pos/paris-store`, `/pos/tunis-mall`). Each outlet has a **specific link**; multiple outlets = multiple links.  
- Layout similar to `/scanner` (no main nav).  
- `/pos/:outletSlug`, `/pos/:outletSlug/login` → POS login; `/pos/:outletSlug/dashboard` → POS dashboard (protected).  
- **`outletSlug` from URL only;** never from request body or storage for auth. The frontend passes `outletSlug` in the path; the backend resolves the outlet and **never trusts frontend** for outlet identity or auth state.

### 5.2 POS Login Page

- **`outletSlug` from route params** (e.g. `/pos/paris-store/login` → `paris-store`).  
- Email, password → `POST /api/pos/${outletSlug}/login`; on success redirect to `/pos/${outletSlug}/dashboard`.  
- **No sensitive data in console:** no `console.log` of credentials, JWT, or tokens. No `localStorage`/`sessionStorage` of passwords or JWT (prefer HttpOnly cookie so it never enters JS).

### 5.3 POS Dashboard

- **`outletSlug` from route params.**  
- Event selector, pass selection (with **remaining** and **sold** from `GET /api/pos/${outletSlug}/passes/:eventId` — **never** trust or cache stock from frontend for business logic), customer form (full name, phone, email, city/ville), submit → `POST /api/pos/${outletSlug}/orders/create`.

### 5.4 Admin Dashboard: New Tabs (Admin and Super Admin – same)

All POS tabs are visible to **admin** and **super_admin**; same actions.

1. **"POS Outlets"**  
   - List: name, slug, **link** (e.g. `https://site.com/pos/paris-store`), is_active, # users, created. **Copy link** for each outlet.  
   - Create: name, slug (optional; auto from name, or override).  
   - Edit: name, slug, is_active. Delete.  
   - **Never** display or log `password`, `password_hash`, or secrets.

2. **"POS Users"**  
   - List with filter by **outlet** (`pos_outlet_id`). Create: select **outlet**, then name, email, password. Edit: name, email, **password** (admin can change **any** pos_user’s password), is_active, is_paused. Remove, pause.  
   - **Audit:** all changes logged; admin can open "POS Audit" to see who did what.  
   - **Never** display or log `password` or `password_hash`; form sends password to API only on create/change.

3. **"POS Orders"**  
   - List with filters (status, event, **outlet**). Columns: order id, **Outlet**, customer, event, passes, total, status, **Created by (pos_user)**, **Approved by**, **Rejected by**, **Removed by** (from `orders` and `admins`).  
   - Row actions: View, Approve, Reject, Remove, Resend email.  
   - **View/detail:** full order, **Edit client email** + Save, **Resend email**.  
   - Approve / Reject / Remove → set `approved_by` / `rejected_by` / `removed_by` = current admin.

4. **"POS Stock"** (tab or sub-tab)  
   - **Outlet selector** (required), then event selector. Table: pass, max_quantity, sold_quantity, remaining; inline or modal edit.

5. **"POS Audit"** (tab or sub-tab, or embedded in each)  
   - `GET /api/admin/pos-audit-log` with filters: action, performed_by, target, date range.  
   - Table: action, who (performed_by_email), target, when, IP (optional), details (sanitized).

### 5.5 App and Routing

- `App.tsx`: **`/pos/:outletSlug/*`** → `PosApp` (outletSlug in path; each outlet has its own link).  
- `api-routes.ts`: `ADMIN_POS_OUTLETS`, `ADMIN_POS_OUTLET(id)`, `ADMIN_POS_USERS`, `ADMIN_POS_USER(id)`, `ADMIN_POS_STOCK`, `ADMIN_POS_ORDERS`, `ADMIN_POS_ORDER_APPROVE(id)`, `ADMIN_POS_ORDER_REJECT(id)`, `ADMIN_POS_ORDER_REMOVE(id)`, `ADMIN_POS_AUDIT_LOG`. For POS (outlet-scoped): build URLs with `outletSlug` in path: `/api/pos/${outletSlug}/login`, `/api/pos/${outletSlug}/logout`, `/api/pos/${outletSlug}/verify`, `/api/pos/${outletSlug}/events`, `/api/pos/${outletSlug}/passes/:eventId`, `/api/pos/${outletSlug}/orders/create`.

---

## 6. Order Status and Flows

- **Create (POS):** `status = 'PENDING_ADMIN_APPROVAL'`, `source = 'point_de_vente'`, `payment_method = 'pos'`, `pos_user_id` set.  
- **Approve:** `status = 'PAID'`, `approved_by = admin_id`; generate tickets; completion email.  
- **Reject:** `status = 'REJECTED'`, `rejected_by = admin_id`; decrement `pos_pass_stock.sold_quantity`.  
- **Remove:** `status = 'REMOVED_BY_ADMIN'`, `removed_by = admin_id`; decrement `pos_pass_stock.sold_quantity`.

---

## 7. Separation from Official Orders and Main Stock

- **Orders:** All "official" order queries (KPIs, online orders, ambassador sales, tickets, exports) **exclude** `source = 'point_de_vente'`.
- **Stock:** `event_passes.sold_quantity` is **never** read or written by POS. All POS logic uses `pos_pass_stock`.
- **Analytics:** Main dashboard does **not** include POS.

---

## 8. Security and RLS (Maximum Security)

### 8.1 Access Control and RLS

- **pos_outlets:** No direct Supabase client access. Backend only; CRUD via admin API. **Never** return secrets. Slug is the public identifier for the outlet link.
- **pos_users:** No direct Supabase client access. Backend only; CRUD via admin API. Passwords bcrypt (cost ≥ 10). **Never** return `password` or `password_hash` in any response. Admin can edit **any** pos_user’s password via PATCH.
- **pos_pass_stock:** POS read-only via API (filtered by `pos_outlet_id` from JWT); admins full CRUD via API. RLS: service_role or admin-only.
- **pos_audit_log:** Insert by backend only; select by admins via `GET /api/admin/pos-audit-log`. RLS: service_role for insert; admin for select.
- **orders `source = 'point_de_vente'`:** Insert only via `POST /api/pos/:outletSlug/orders/create` with valid POS JWT (`pos_outlet_id` matches outlet from `:outletSlug`). Select/update only via admin endpoints. RLS: exclude from ambassador and anon; admins see all.
- **JWT (POS):** Contains `pos_user_id`, `pos_outlet_id` (no password, no secret). Short-lived (e.g. 8–12 h). Stored in HTTP-only, Secure, SameSite=Strict cookie, or `Authorization: Bearer`—**never** in response JSON or in `localStorage`/`sessionStorage`. On each request: verify signature, exp; (optional) DB check that user is not `is_paused` and outlet is active.

### 8.2 Rate Limiting

- **POST `/api/pos/:outletSlug/login`:** 5 attempts per 15 min per IP (and optionally per email). Return 429 when exceeded.
- **POST `/api/pos/:outletSlug/orders/create`:** 10 requests per min per POS user (from JWT) or per IP if auth fails. 429 when exceeded.
- **Admin POS endpoints** (`/api/admin/pos-*`): 60–120 requests per min per admin. 429 when exceeded.
- Use a single rate-limit middleware (e.g. in-memory or Redis) for these routes.

### 8.3 Brute-Force and Lockout

- **POS login:** After N failed attempts (e.g. 5) for the same email in a short window (e.g. 15 min): temporary lockout (e.g. 15–30 min) or exponential backoff. Log failed attempts (no passwords) to `pos_audit_log` or a dedicated `pos_login_attempts` (ip_address, email, success, created_at). Optionally lock by IP if same IP fails for multiple emails.
- **Admin:** Rely on existing admin lockout/session rules if any; otherwise same idea for `/api/admin-login`.

### 8.4 Password Policy (POS Users)

- **Creation (admin):** Min length 8; require at least: one digit, one letter. Optional: one special char, one upper. Reject common/compromised passwords (e.g. via a small blocklist or `haveibeenpwned`-style check if feasible).
- **Storage:** bcrypt with cost ≥ 10 (or 12 if acceptable for login latency).
- **Update:** Same rules when admin changes password via PATCH.

### 8.5 Input Validation and Sanitization

- **All POS and admin POS inputs:**  
  - Email: format, max length, trim; reject invalid.  
  - Phone: format (E.164 or national), max length.  
  - Quantities: integer > 0, max cap (e.g. 1000) to avoid abuse.  
  - Names, city, ville: max length, trim; strip or reject control chars and dangerous patterns (e.g. `<>`, `script`).  
  - `event_id`, `pass_id`, `orderId`: UUID format.  
  - JSON body: max size (e.g. 64 KB); reject malformed or oversized.
- **Output and errors:** Generic messages for auth (e.g. "Invalid credentials"); no "email already exists" on POS user create. No stack traces or DB errors to client. No PII (email, phone) in app logs; redact or hash in `pos_audit_log` `details` where needed.

### 8.6 CORS and CSRF

- **CORS:** Restrict `/api/pos*` and `/api/admin/pos*` to known origins (same as main app). No `*` for credentials.
- **CSRF:** If POS or admin uses cookie-based session, send CSRF token (e.g. in header `X-CSRF-Token`) for state-changing requests and validate. If Bearer-only in `Authorization`, CSRF risk is lower; still recommended for cookie-based flows.

### 8.7 Security Headers and HTTPS

- For `/pos` and `/api/pos*` (and ideally all `/api`):  
  - `X-Content-Type-Options: nosniff`  
  - `X-Frame-Options: DENY` or `SAMEORIGIN`  
  - `Strict-Transport-Security` (HSTS) in production  
  - `Content-Security-Policy` as per main app
- **HTTPS only** in production for `/pos` and all POS/admin POS APIs.

### 8.8 IP and User-Agent

- **Capture:** For every POS-related and admin POS request: `ip_address` (from `X-Forwarded-For`, `X-Real-IP`, or `req.ip`), `user_agent`.  
- **Store:** In `pos_audit_log` for every audited action. Optionally in a separate security log for login attempts (success and failure).

### 8.9 SQL and Injection

- **All DB access:** Parameterized queries or ORM only. No string concatenation for SQL.  
- **IDs and filters:** Validate UUIDs and enums before querying.

### 8.10 Logging and Monitoring

- **Security events (no PII, no secrets):**  
  - POS login: success/failure, ip, (optional) email hash or truncated.  
  - Lockout triggered.  
  - Admin POS: sensitive actions (create/delete pos_user, approve/reject/remove order, bulk stock change) in `pos_audit_log` and optionally in existing `security_audit_logs` or `site_logs` with `module = 'pos'`.
- **Alerts:** Optional: notify on many failed POS logins from one IP, or on repeated 401/403 for admin POS.

### 8.11 Idempotency (Optional)

- **POST `/api/pos/:outletSlug/orders/create`:** Accept optional `Idempotency-Key` header. If same key seen within a window (e.g. 24 h) for same pos_user, return the existing order instead of creating a duplicate. Reduces double-submit from UI.

### 8.12 Never Trust the Frontend

- **All authorization and business rules are enforced only on the backend.** Do not rely on the frontend for: `is_active`, `is_paused`, `role`, `pos_outlet_id`, `pos_user_id`, stock numbers, prices, or any decision that affects security or money.
- **Outlet identity:** The outlet is determined by **`:outletSlug` in the URL path**; the backend resolves `pos_outlets` by slug. Never use an outlet id/slug from the request body, `localStorage`, or headers for auth or authorization.
- **JWT:** `pos_user_id` and `pos_outlet_id` in the JWT are verified server-side. For sensitive actions, **re-validate from DB** (e.g. user exists, `is_active`, `!is_paused`) instead of trusting the JWT alone.
- **Stock, prices, availability:** Always read from DB on the server. Never trust frontend-cached or -computed values for: remaining stock, sold, price, or “can create order”.

### 8.13 No Sensitive Data in Console, Responses, or Storage

- **API responses:** **Never** include `password`, `password_hash`, JWT (or raw token), or any secret in any JSON/response. For `pos_users`: return only id, name, email, is_active, is_paused, pos_outlet_id, created_at, created_by (and similar safe fields). For POS login: return only success, user id, outlet id; put the JWT in an **HttpOnly, Secure, SameSite** cookie (or `Authorization` header) so it **never appears in response body or in JS**.
- **Frontend / console:**  
  - **No `console.log`, `console.debug`, or `console.info`** of: credentials, passwords, JWT, tokens, or PII (full email, phone) in production. In development, avoid or redact.  
  - **No `localStorage`, `sessionStorage`, or any JS-accessible storage** for passwords or JWT. Prefer HttpOnly cookie for JWT so it is not exposed to JS.  
  - No sensitive data in React state that could be dumped via devtools or error boundaries (e.g. never put `password` or JWT in top-level state that is logged or serialized).
- **Error messages to client:** Generic only (e.g. "Invalid credentials", "Unauthorized", "Invalid request"). **No** stack traces, DB error strings, or internal IDs that could help an attacker.
- **Build:** In production, strip or no-op `console.log`/`console.debug` for sensitive paths, or use a logger that is disabled in prod.
- **Logging (server):** No PII (full email, phone) or secrets in app logs; redact or hash in `pos_audit_log` `details` where needed.

---

## 9. Files to Touch (Summary)

- **Supabase:** `pos_outlets`, `pos_users` (with `pos_outlet_id`), `pos_pass_stock` (with `pos_outlet_id`; UNIQUE per outlet), `pos_audit_log` (with `pos_outlet_id`; actions for outlets), `alter-orders-for-pos` (pos_outlet_id, pos_user_id, etc.), `alter-qr-tickets-for-pos`, RLS.
- **Backend:** `requirePosAuth(outletSlug)`; `/api/pos/:outletSlug/login`, `logout`, `verify`; `/api/admin/pos-outlets` CRUD; `/api/admin/pos-users` CRUD (pos_outlet_id on create; **admin can edit any pos_user password**; never return password/password_hash); `/api/admin/pos-stock` CRUD (pos_outlet_id required); `/api/admin/pos-orders`, approve, reject, remove, resend, update-email; `/api/admin/pos-audit-log`; `/api/pos/:outletSlug/events`, `passes/:eventId`, `orders/create`; SMS/email adaptations; **audit on every POS action**; **rate limiting, lockout, validation, CORS, headers**; **never trust frontend; no sensitive data in responses or logs**.
- **Frontend:** `App.tsx` (`/pos/:outletSlug/*`), `api-routes.ts`, `pages/pos/PosLogin`, `PosDashboard`, `PosApp` (outletSlug from route); `Dashboard.tsx` tabs: **POS Outlets**, POS Users, POS Orders, POS Stock, POS Audit (outlet selector where needed). **No `console.log` of credentials, JWT, or PII; no `localStorage`/`sessionStorage` of passwords or JWT.**
- **Types:** `source`, `payment_method` include `'point_de_vente'` and `'pos'`; `Order` has `pos_outlet_id`, `pos_user_id`, `approved_by`, `rejected_by`, `removed_by`.

---

## 10. Dependencies and Order of Work

1. **DB:** migrations for `pos_outlets`, `pos_users` (with `pos_outlet_id`), `pos_pass_stock` (with `pos_outlet_id`), `pos_audit_log` (with `pos_outlet_id` and outlet actions), `orders`/`qr_tickets` (pos_outlet_id).  
2. **Auth:** `/api/pos/:outletSlug/login`, `logout`, `verify`, `requirePosAuth(outletSlug)`, rate limit and lockout for login.  
3. **Admin POS outlets:** CRUD + audit + "POS Outlets" tab (list, create with name/slug, edit, delete; **copy link** per outlet).  
4. **Admin POS users:** CRUD (pos_outlet_id on create; **password editable for any pos_user**; never return password/password_hash) + audit + "POS Users" tab (filter by outlet).  
5. **Admin POS stock:** CRUD (pos_outlet_id required) + audit + "POS Stock" tab (outlet + event selector).  
6. **POS read:** `/api/pos/:outletSlug/events`, `/api/pos/:outletSlug/passes/:eventId` (stock for that outlet only).  
7. **POS create:** `/api/pos/:outletSlug/orders/create` + audit + SMS/email; set `orders.pos_outlet_id`.  
8. **Admin POS orders:** list (outlet, approved_by, rejected_by, removed_by), approve, reject, remove, resend, update-email, + audit; "POS Orders" tab.  
9. **Admin POS audit:** `GET /api/admin/pos-audit-log` + "POS Audit" tab.  
10. **Frontend:** `/pos/:outletSlug` app (login + dashboard; outletSlug from route), then admin tabs (POS Outlets, POS Users, POS Orders, POS Stock, POS Audit). **No sensitive data in console or storage.**  
11. **Security:** Rate limits, lockout, password policy, validation, CORS, CSRF, headers, IP/UA in audit, no PII in logs; **never trust frontend (8.12); no sensitive data in console, responses, or storage (8.13)**.  
12. **Guards:** Exclude `point_de_vente` from all main order/analytics/stock; never touch `event_passes.sold_quantity` from POS.

---

## 11. Open Questions / Decisions

- **City / ville:** Required or optional in POS customer form?  
- **POS `sold_quantity` edits:** Allow setting above current (e.g. to correct)? Plan allows if `<= max_quantity`.  
- **Resend for pending POS orders:** "Resend order received" in addition to "resend completion" for approved?  
- **Soft-delete for `pos_users`:** Prefer `is_active = false` vs hard delete with `orders.pos_user_id` → NULL?  
- **Slug for new outlets:** If derived slug exists (e.g. `paris-store`), return 400 with `suggestedSlugs: ['paris-store-2', 'paris-store-3']` or let admin override on create.  
- **Delete `pos_outlets`:** On hard delete, `pos_users.pos_outlet_id` and `orders.pos_outlet_id` → SET NULL or CASCADE? Decide in migration.

---

## 12. Gaps and Additions Before Build

Items to **decide or add** so implementation is unambiguous. **Use as a pre-build checklist;** resolve each before or during implementation.

### 12.1 Database and schema

- **`order_number` for POS orders:** The existing `orders` table has a default `order_number` (random, from `generate_random_order_number()`). **Confirm** the trigger/default applies to all INSERTs (no `WHERE source != 'point_de_vente'`). POS orders should get `order_number` like others; no change if the trigger is unconditional.
- **`orders.city` / `ville` nullability:** If city/ville are **optional** in the POS form, ensure `orders.city` and `orders.ville` allow NULL, or define a default (e.g. `''` or `'N/A'`). Check current schema and any NOT NULL constraints.
- **`pos_audit_log` index:** Add `(pos_outlet_id)` or `(pos_outlet_id, created_at)` for "show all for this outlet" and for admin filters.

### 12.2 Outlet slug and routing

- **Reserved / forbidden slugs:** Disallow outlet slugs that would clash with app routes. Minimum: `login`, `logout`, `dashboard`, `admin`, `api`, `events`, `scanner`, `ambassador`, `pos` (if used as prefix in another way). Validate on create/update; return 400 if slug is reserved.
- **Invalid or unknown `outletSlug` in URL:** If user opens `/pos/wrong-slug` or `/pos/does-not-exist`: return **404** (or "Outlet not found" / "Invalid link") in API and in frontend. Define the exact message and HTTP status (404 for GET /pos/:outletSlug, 404 for /api/pos/:outletSlug/login when outlet not found).
- **Case-sensitivity of `outletSlug`:** Slugs are stored in lowercase. When resolving outlet from the URL, **normalize** `:outletSlug` to lowercase before the DB lookup so `/pos/Paris-Store` and `/pos/paris-store` behave the same.
- **`/pos` without slug:** Behaviour when path is exactly `/pos` (no slug): **404** is simpler. Alternatively: redirect to the single active outlet if there is exactly one. Plan recommends **404** to avoid implicit behaviour.
- **Base URL for outlet “full link”:** Admin needs e.g. `https://site.com/pos/paris-store`. Decide source: `SITE_URL` or `VITE_APP_URL` or `req.protocol`/`req.get('host')` (or `X-Forwarded-Host`). Must work in staging and production; prefer a single env var (e.g. `SITE_URL`).

### 12.3 Stock and order create

- **Prices: never trust frontend:** On **POST `/api/pos/:outletSlug/orders/create`**, **ignore** `price` in `passes[]` from the body. Always **select `price` from `event_passes`** for each `pass_id` and use it for `order_passes.price` and `orders.total_price`. Reject if `pass_id` not found or not active.
- **Atomic stock on create:** When incrementing `pos_pass_stock.sold_quantity`, do **one** conditional update per pass, e.g.:  
  `UPDATE pos_pass_stock SET sold_quantity = sold_quantity + :q WHERE pos_outlet_id = :oid AND event_id = :eid AND pass_id = :pid AND (max_quantity IS NULL OR sold_quantity + :q <= max_quantity) RETURNING *`.  
  If no row returned → **400 Insufficient stock**. Prevents races when two orders take the last unit.
- **Atomic decrement on reject/remove:** When decrementing on reject/remove:  
  `UPDATE pos_pass_stock SET sold_quantity = GREATEST(0, sold_quantity - :q) WHERE ... AND sold_quantity >= :q`.  
  (Or `sold_quantity - :q` with a CHECK; ensure it never goes negative.)

### 12.4 Tickets, email, SMS

- **Ticket generation:** The function that generates tickets / QR for orders must accept `source = 'point_de_vente'` and `payment_method = 'pos'`. **Check** that it does not filter these out and that `qr_tickets.source` allows `'point_de_vente'` (see `alter-qr-tickets-for-pos-source`).
- **`send-order-completion-email` and `resend-order-completion-email`:** Must accept `source = 'point_de_vente'` and `payment_method = 'pos'`; **ambassador block optional** (e.g. "Andiamo Events" when no ambassador). Confirm both are extended.
- **`/api/admin/update-order-email`:** Must apply to `source = 'point_de_vente'`; confirm it is not filtered out by source or payment_method.
- **SMS on create:** `buildClientOrderConfirmationSMS` (or equivalent) expects ambassador. Add a **POS-specific** builder or a `source === 'point_de_vente'` branch: no ambassador, text like "Order received at Point de Vente. Pending confirmation. Order #…, Event: …, Passes: …". Reuse same SMS infra (WinSMS, etc.).
- **Email on create:** Add **POS-specific** "order received" content (or param in existing): no ambassador, "Your order has been received. It is pending admin approval. You will receive a final confirmation with tickets once approved."
- **Resend for pending POS orders:** There are no tickets yet for pending. **Decide:** (a) "Resend order received" (no tickets) for pending, or (b) disable "Resend" for pending and show tooltip "Available after approval". Document the choice.

### 12.5 Deployment and routing

- **Vercel / `vercel.json`:** `/api/pos/:outletSlug/login`, `/api/pos/:outletSlug/orders/create`, etc. are **dynamic**. Add a rewrite, e.g. `"/api/pos/(.*)"` → `/api/misc.js` or a dedicated `/api/pos.js`, and in the handler **parse** the path to get `outletSlug` and the sub-path (login, orders/create, …). If POS is implemented in `server.cjs` (e.g. local or custom Node server), ensure the same path parsing exists and that production uses the right target.
- **Cookie for POS JWT:** If using a cookie: **name** (e.g. `pos_session` to avoid clashing with admin); **path** `Path=/` or `Path=/pos` (if `/pos`, it won’t be sent to `/api/pos` unless that is under `/pos`; typically use `Path=/` and a unique name). **Domain**, **SameSite**, **Secure** as per 8.1.

### 12.6 UX and product

- **Maintenance mode:** If the main site has a maintenance mode, **decide** whether `/pos/*` and `/api/pos/*` are **blocked** or **allowed** during maintenance. Document and implement accordingly.
- **i18n (en/fr):** POS UI (login, dashboard) and Admin POS tabs: **support en/fr** in line with the rest of the app (e.g. pass `language` and use existing `t` / translation keys). List any new strings to add.
- **`GET /api/pos/:outletSlug/verify` response:** Besides `{ ok: true }` or 401, **optionally** return `{ ok: true, outlet: { name } }` so the POS header can show the outlet name (e.g. "Paris Store") without an extra request.

### 12.7 API details

- **Pagination:** For `GET /api/admin/pos-orders` and `GET /api/admin/pos-audit-log`, **align** with existing admin pagination: `limit`/`offset` or `page`/`pageSize`, and response shape `{ data, total, page? }`. Reuse the same pattern as other admin list endpoints.
- **`GET /api/admin/pos-orders` and `pos_outlet_id`:** When `pos_outlet_id` is NULL (legacy or data fix), still return the row; join to `pos_outlets` only when non‑null so the list does not break.

### 12.8 Admin: POS Stock

- **Bulk “enable” passes for an outlet:** Optional: "Add all passes of this event to POS for this outlet" (create `pos_pass_stock` rows with `max_quantity = NULL` or 0). Not required for v1; can be "Consider for later".

### 12.9 Consistency with existing `orders` / `order_passes`

- **Existing triggers and constraints:** Any `orders` or `order_passes` trigger (e.g. `order_number`, logging) or CHECK that depends on `source` or `payment_method` must **allow** `source = 'point_de_vente'` and `payment_method = 'pos'`. Grep for `source` and `payment_method` in migrations and triggers; add an exclusion or branch if they assume only `platform_cod` / `platform_online` / `ambassador_manual` / `ambassador_cash` / `online` / `cod`.
- **`order_passes`:** Existing `order_passes` expects `pass_id` (FK to `event_passes`). POS uses the same; ensure `pass_id` is always set from server-resolved `event_passes`, never from an unchecked client value.

---

## 13. Out of Scope (Not in This Plan)

- POS-specific analytics or reports.  
- Multi-currency or different pricing for POS.  
- Offline mode or sync for POS.  
- Printing receipts from POS UI.  
- Bulk "enable all passes for this outlet" in POS Stock (can be added later).

---

*End of plan. No code changes have been made.*
