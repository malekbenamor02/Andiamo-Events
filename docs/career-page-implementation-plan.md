# Career / Recruitment Page — Full Implementation Plan

This document describes how the **Career** page will work: public job applications by domain, admin management of domains and form fields, rate limiting, captcha, and validation (frontend + backend).

---

## 1. Overview

- **Public**: One **Career** page where users see open job **domains** (e.g. "Marketing", "Tech", "Events"). Each domain has its own application form. Admin can open/close applications globally or per domain.
- **Admin**: Manage domains (add/edit/remove), manage form fields per domain (add/remove/edit, mark required/optional), open/close applications, view and filter submissions; **duplicate detection**; **compare 2–3 candidates** side by side; **CV/document upload section** (enable/disable per domain); **Export Excel/CSV** of applications (filtered); **Audit log** of who viewed/updated which application and when.
- **Emails**: **Personalized confirmation email** on submit; **approval email** after admin approves an application. All career emails use the **same design** as existing app emails (e.g. ambassador approval/rejection).
- **Field types**: Admin chooses type when adding a field: **text**, **age**, **phone**, **date**, **link**, **textarea**, **number**, **select (list)**. For **list** fields, admin defines and edits the options (e.g. "Type of work" = Part time, Full time, Internship); can add, edit, or remove list items.
- **Security**: Rate limiting + reCAPTCHA on submit; validation on both frontend and backend.

---

## 2. User Flows

### 2.1 Public (Candidate)

1. Visit **/careers**.
2. See list of **open** domains (only those with `applications_open = true` and global career applications open).
3. Click a domain → see domain title/description and the **dynamic application form** (fields defined by admin).
4. Fill form (required fields enforced in UI).
5. Complete reCAPTCHA (invisible v3, same pattern as ambassador).
6. Submit → rate limit and captcha checked; backend validates and stores submission.
7. See success message (or validation/rate limit/captcha error).

### 2.2 Admin

1. **Career** tab in Admin Dashboard (new tab next to Applications, Settings, etc.).
2. **Global switch**: "Career applications open" (on/off). When off, public page shows "Applications are currently closed" (no domain list).
3. **Domains**:
   - List domains with: name, slug, open/closed, submissions count, actions (edit, open/close, manage fields, view submissions).
   - Add domain: name, slug (auto from name or editable), short description, "Applications open" for this domain.
4. **Form builder (per domain)**:
   - List fields: label, key, **type** (see Field types below), required (yes/no), order.
   - **Add field**: admin selects **type** (text, email, age, phone, date, link, textarea, number, select/list, file). For **select (list)** fields: admin enters label (e.g. "Type of work") and manages the **list of options** (e.g. "Part time", "Full time", "Internship") — add, edit, or remove each option.
   - Edit / remove / reorder fields.
   - **CV/Document upload section**: admin can **enable or disable** a dedicated "Upload CV / documents" block for the domain. When enabled, candidate can upload one or more files (CV, cover letter, portfolio); files stored in Supabase Storage; URLs saved in form_data.
5. **Submissions**:
   - List submissions (by domain, date, search); **duplicate detection** (same email/phone) shown in UI and optionally block or warn on submit.
   - View one submission: all field values (including dynamic ones and file links); **Compare 2–3 candidates** side-by-side (same domain).
   - Actions: mark as reviewed, **approve** (triggers **approval email** to candidate, same design as other app emails); **Export Excel/CSV** (filter by domain, date range, status; all form_data as columns). **Audit log**: every view and status update of an application is logged (admin id, application id, action, timestamp); admin can consult the log (e.g. in application detail or dedicated log view).

---

## 3. Data Model (Supabase)

### 3.1 Tables

- **`career_domains`**  
  - `id` (UUID, PK), `name` (TEXT), `slug` (TEXT, unique), `description` (TEXT), `applications_open` (BOOLEAN), `sort_order` (INT), **`document_upload_enabled`** (BOOLEAN, default false — when true, show "Upload CV / documents" section), `created_at`, `updated_at`.

- **`career_application_fields`**  
  - `id` (UUID, PK), `career_domain_id` (FK → career_domains), `field_key` (TEXT), `label` (TEXT), **`field_type`** (TEXT: **text**, **email**, **age**, **phone**, **date**, **link**, **textarea**, **number**, **select**, **file**), `required` (BOOLEAN), `sort_order` (INT), **`options`** (JSONB — for **select** only: array of options, e.g. `["Part time", "Full time", "Internship"]`; admin can **add, edit, or remove** list items; label of the field is separate), `validation` (JSONB, e.g. `{ "maxLength": 500, "pattern": "phone_tn" }`), `created_at`, `updated_at`.  
  - Unique constraint on `(career_domain_id, field_key)`.

- **`career_applications`** (submissions)  
  - `id` (UUID, PK), `career_domain_id` (FK → career_domains), `form_data` (JSONB — key/value per field; for file fields, value = storage URL or array of URLs), `status` (TEXT: `new`, `reviewed`, **`approved`**, `rejected`), **`approved_at`** (TIMESTAMP, set when admin approves; used to send **approval email**), `ip_address` (TEXT), `user_agent` (TEXT), `created_at`.  
  - **Duplicate detection**: before insert (or in admin UI), check same email/phone in `career_applications` (same or other domain); block or warn.

- **`career_application_logs`** (audit log)  
  - `id` (UUID, PK), `career_application_id` (FK → career_applications), `admin_id` (UUID, FK to admins or TEXT if no FK), `action` (TEXT: e.g. `viewed`, `status_updated`, `approved`, `rejected`), `details` (JSONB, optional — e.g. old/new status), `created_at` (TIMESTAMP).  
  - Used for **audit log**: who (admin) viewed or updated which application and when. Can extend existing `admin_logs` table with a type/source for career actions, or use this dedicated table.

- **Global open/close**  
  - Use existing **`site_content`** table: key `career_applications_settings`, content `{ "enabled": true }` (or per-domain overrides if needed later).  
  - Or add a small **`career_settings`** table: single row with `applications_open` (BOOLEAN).  
  - Recommendation: **`site_content`** with key `career_applications_settings` and `content` JSON `{ "enabled": true }` to match ambassador pattern.

### 3.2 RLS (Row Level Security)

- **career_domains**:  
  - SELECT: public can read rows where `applications_open = true` (and when global career is open).  
  - All other operations: only admins (e.g. `EXISTS (SELECT 1 FROM admins WHERE id = auth.uid())` if using Supabase Auth for admin, or service role from backend).

- **career_application_fields**:  
  - SELECT: public can read fields for domains that are open; admin can read all.  
  - INSERT/UPDATE/DELETE: admin only (or via backend with service role).

- **career_applications**:  
  - INSERT: public (with CHECK true or validated via API only).  
  - SELECT/UPDATE: admin only.  
  - In practice: **public submits only via backend API** (which inserts with service role); frontend never writes to Supabase for submissions. Public only reads domains + fields.

- **career_application_logs**:  
  - INSERT: backend only (when admin views or updates an application).  
  - SELECT: admin only (to show audit trail).  
  - No public access.

---

## 4. API Design (Backend — Express in `server.cjs`)

### 4.1 Public (no auth)

- **GET /api/careers/domains**  
  - Returns list of career domains where global career is open and `applications_open = true`.  
  - Response: `{ domains: [{ id, name, slug, description }] }`.  
  - Optional: light rate limit (e.g. 60/min per IP) to avoid scraping.

- **GET /api/careers/domains/:slug**  
  - Returns one domain by slug + its **fields** (for form builder config).  
  - Response: `{ domain: { id, name, slug, description }, fields: [{ id, field_key, label, field_type, required, sort_order, options, validation }] }`.  
  - Only if domain exists and is open and global career is open.

- **POST /api/career-application**  
  - Body: `{ domainId or domainSlug, recaptchaToken, ...fieldKeyValuePairs }` (and file URLs if document upload used).  
  - Checks:  
    1. Rate limit (e.g. 5 per hour per IP, re-use pattern from ambassador).  
    2. reCAPTCHA v3 verify (action e.g. `career_application`).  
    3. Global career open and domain open.  
    4. **Duplicate detection**: if email or phone (if collected) already exists in `career_applications` for same domain (or globally), return 400 with clear message.  
    5. Backend validation (see below).  
  - Insert into `career_applications` (form_data = sanitized key/value JSONB, ip_address, user_agent).  
  - Send **personalized confirmation email** (candidate name, domain name; same HTML/CSS design as ambassador emails).  
  - Return 201 or 400 with validation errors.

### 4.2 Admin (require admin auth)

- **GET /api/admin/careers/settings**  
  - Returns global career open/close (from `site_content` or `career_settings`).

- **PUT /api/admin/careers/settings**  
  - Body: `{ enabled: true | false }`.  
  - Updates `site_content` key `career_applications_settings`.

- **GET /api/admin/careers/domains**  
  - Returns all domains (including closed) with submission counts.

- **POST /api/admin/careers/domains**  
  - Body: `{ name, slug, description?, applications_open? }`.  
  - Creates domain.

- **GET /api/admin/careers/domains/:id**  
  - Domain + its fields.

- **PUT /api/admin/careers/domains/:id**  
  - Update domain (name, slug, description, applications_open, sort_order).

- **DELETE /api/admin/careers/domains/:id**  
  - Soft-delete or hard-delete (and cascade delete fields). Prefer soft-delete if you want to keep submission history.

- **GET /api/admin/careers/domains/:id/fields**  
  - List fields for domain (or include in GET domain).

- **POST /api/admin/careers/domains/:id/fields**  
  - Body: `{ field_key, label, field_type, required, sort_order?, options?, validation? }`.  
  - Add field.

- **PUT /api/admin/careers/domains/:id/fields/:fieldId**  
  - Update field.

- **DELETE /api/admin/careers/domains/:id/fields/:fieldId**  
  - Remove field.

- **GET /api/admin/careers/applications**  
  - Query: `?domainId=&status=&from=&to=&page=&limit=`.  
  - Returns paginated submissions (id, career_domain_id, form_data, status, created_at).

- **GET /api/admin/careers/applications/:id**  
  - One submission detail.

- **PATCH /api/admin/careers/applications/:id**  
  - Body: `{ status: "reviewed" | "approved" | "rejected" }`. When status is set to **approved**: set `approved_at` and send **approval email** to candidate (same design as ambassador approval email).  
- **GET /api/admin/careers/applications/compare**  
  - Query: `?ids=id1,id2` or `?ids=id1,id2,id3`. Returns 2–3 applications (same domain recommended) with form_data and domain info for **side-by-side comparison** in admin UI.

- **GET /api/admin/careers/applications/export**  
  - Query: `?domainId=&status=&from=&to=&format=xlsx|csv`. Returns **Excel (xlsx)** or **CSV** file of applications matching filters; columns = id, domain name, status, created_at + all form_data keys (from domain fields). Uses ExcelJS (or CSV string) on backend; same pattern as existing exports in the app.

- **Audit log**: On GET application detail and on PATCH application (status change), backend writes a row to **career_application_logs** (admin_id, application_id, action e.g. `viewed` or `status_updated`, details, created_at).  
- **GET /api/admin/careers/applications/:id/logs** (optional) — Returns audit entries for that application (who viewed/updated and when). Or include last N log entries in GET application detail.

---

## 5. Validation (Frontend + Backend)

### 5.1 Field types and rules (backend must mirror frontend)

When admin **adds a new field**, they choose one of these **types**:

- **text**: single line; max length from `validation.maxLength`.  
- **email**: valid email format.  
- **age**: numeric, optional min/max (e.g. 18–65) in validation.  
- **phone**: configurable pattern (e.g. Tunisian 8 digits); use `validation.pattern` and server-side regex.  
- **date**: valid date (ISO or configured format).  
- **link**: valid URL (http/https).  
- **textarea**: multi-line; max length from validation.  
- **number**: min/max if in `validation`.  
- **select** (list): value must be one of the **options** in the list. Admin **edits the list** for this field: **add** new option, **edit** label of an option, **remove** an option. Stored as `options` JSONB array (e.g. `["Part time", "Full time", "Internship"]`).  
- **file**: upload to Supabase Storage; store URL (or array of URLs) in form_data. Used for CV/document section when domain has `document_upload_enabled`.

Backend keeps a **schema per domain** at request time: load `career_application_fields` for the domain, then for each field:

- If `required`, value must be non-empty (after trim).  
- Apply type-specific rules (email regex, phone regex, max length, options membership).  
- Reject unknown keys (only allow keys that exist in fields for that domain).  
- Sanitize: trim strings, escape or reject HTML if needed.

### 5.2 Frontend (React)

- Use **react-hook-form** + **Zod**.  
- Build Zod schema **dynamically** from the fields config returned by `GET /api/careers/domains/:slug`.  
  - Required vs optional from `required`.  
  - Type and maxLength/pattern from `field_type` and `validation`.  
- Show errors under each field and block submit until valid.  
- Same types as backend: text, email, age, phone, date, link, textarea, number, select, file.  
- For **select (list)** fields: render dropdown or radio from `options` array; admin manages options in form builder (add/edit/remove list items).  
- When domain has **document upload enabled**: show "Upload CV / documents" section; allow one or more file uploads; submit sends file URLs with form_data.

### 5.3 List (select) field management (admin)

- For each field of type **select**, admin sees the **label** (e.g. "Type of work") and the **list of options**.  
- Actions: **Add** new option (e.g. "Part time"), **Edit** text of an option, **Remove** an option.  
- Options stored as JSONB array; order can be preserved (array order = display order).  
- Backend validates that submitted value is in the current options list.

### 5.4 CV / document upload section

- **Per domain**: toggle **"Enable CV / document upload"** in domain settings.  
- When enabled, public form shows a section (e.g. "Upload your CV or other documents"); candidate can upload one or more files (max size and allowed MIME types in validation).  
- Files uploaded to Supabase Storage (e.g. bucket `career-documents`, path by domain + application id); URLs stored in `form_data` under a reserved key (e.g. `cv_documents`).  
- Admin sees "Download" links in application detail for each file.

---

## 6. Career Emails (same design as existing app)

All career-related emails must use the **same visual design** as ambassador and other app emails (see `src/lib/email.ts`: same HTML structure, `.email-wrapper`, `.content-card`, `.title-section`, `.title`, `.subtitle`, `.greeting`, `.message`, same colors and dark-mode support).

### 6.1 Confirmation email (personalized)

- **When**: immediately after candidate submits an application (POST /api/career-application succeeds).  
- **To**: candidate email (from form_data).  
- **Content**: **Personalized** with candidate first/full name and **domain name** (e.g. "Hi [Name], we have received your application for [Domain]. We will get back to you soon.").  
- **Subject**: e.g. "We received your application - [Domain] - Andiamo Events".  
- **Implementation**: new helper e.g. `createCareerConfirmationEmail(candidateName, domainName, candidateEmail)` in `email.ts` (or server-side equivalent), reusing the same HTML/CSS layout as `createApprovalEmail` / `createRejectionEmail`.

### 6.2 Approval email (after admin approves)

- **When**: admin sets application status to **approved** (PATCH applications/:id with `status: "approved"`).  
- **To**: candidate email from form_data.  
- **Content**: Same tone and layout as ambassador approval: welcome, next steps (e.g. "We will contact you to discuss the next steps"), branding.  
- **Subject**: e.g. "Your application has been approved - Andiamo Events".  
- **Implementation**: e.g. `createCareerApprovalEmail(candidateName, candidateEmail, domainName)`; call from backend when status is updated to approved; use same design as `createApprovalEmail`.

---

## 8. Rate Limiting and Captcha

- **Rate limiting**  
  - **POST /api/career-application**: same pattern as ambassador (e.g. `express-rate-limit`: 5 submissions per hour per IP, `ipKeyGenerator` for IPv6).  
  - Optionally: **GET /api/careers/domains** and **GET /api/careers/domains/:slug**: 60 req/min per IP to avoid abuse.

- **Captcha**  
  - reCAPTCHA v3, action e.g. `career_application`.  
  - Frontend: get token before submit (as in ambassador Application.tsx).  
  - Backend: require `recaptchaToken` in body; verify with Google (reuse existing `RECAPTCHA_SECRET_KEY` and verify endpoint logic).  
  - Bypass for localhost (e.g. token `localhost-bypass-token`) in dev only.

---

## 9. Frontend Structure (React / Vite)

### 9.1 Public pages

- **Route**: `/careers` (and optionally `/careers/:domainSlug` for direct link to one domain form).  
- **Page**: e.g. `src/pages/Careers.tsx`.  
  - If no slug: list open domains (cards/links).  
  - If slug: load domain + fields from API, render dynamic form (from config), reCAPTCHA, submit to `POST /api/career-application`.  
- **Navigation**: Add "Careers" in `Navigation.tsx` and `Footer` (and any site_content-driven nav if used).

### 7.2 Admin

- **New tab**: "Career" in admin Dashboard (same tabs as Applications, Settings, etc.).  
- **Components** (under e.g. `src/pages/admin/components/`):  
  - **CareerTab.tsx**: container; global open/close switch; list of domains; "Add domain" button.  
  - **CareerDomainForm.tsx**: create/edit domain (name, slug, description, applications_open).  
  - **CareerFieldsManager.tsx**: list fields, add/edit/delete/reorder (drag or sort_order).  
  - **CareerApplicationsList.tsx**: table of submissions with filters (domain, status, date); click row → detail drawer/dialog.  
  - **CareerApplicationDetail.tsx**: show all keys from `form_data` with labels; "Approve" button → PATCH approved → approval email; document download links; **audit log** (who viewed/updated and when, or link to log).
  - **Export**: "Export Excel" / "Export CSV" in submissions list or tab; calls export API with current filters; download file.
  - **CareerCompareCandidates.tsx**: select 2–3 applications; side-by-side comparison of form_data and notes.
  - **CareerFieldsManager.tsx**: for **select** fields, UI to add/edit/remove **list options**; for domain, toggle **document_upload_enabled**.

### 9.3 API client and routes

- In `src/lib/api-routes.ts`: add constants for all career endpoints (public + admin).  
- In `src/lib/api-client.ts`: use those constants for `apiFetch` (and optional typed helpers).  
- Admin career API calls: send admin cookie (same as other admin endpoints); backend uses existing `requireAdminAuth` (or equivalent).

---

## 10. Implementation Order (Suggested)

1. **Database**  
   - Migration: create `career_domains`, `career_application_fields`, `career_applications`; RLS; `site_content` row or key for `career_applications_settings`.

2. **Backend**  
   - Public: GET domains, GET domain by slug (with fields), POST career-application (rate limit + captcha + validation + insert).  
   - Admin: CRUD domains, CRUD fields, GET/PATCH applications, GET/PUT global settings.

3. **Frontend – Public**  
   - Careers page: list domains → select domain → dynamic form + reCAPTCHA + submit; success/error handling.

4. **Frontend – Admin**  
   - Career tab: settings switch, domains list, domain form, fields manager, applications list and detail.

5. **Polish**  
   - Navigation/Footer link to /careers; SEO (title/meta); optional CSV export; optional reorder fields (sort_order).

---

## 11. Summary Table (core + confirmed features)

| Feature | How it works |
|--------|----------------|
| **Open/close applications** | Global: `site_content` key `career_applications_settings` → `enabled`. Per domain: `career_domains.applications_open`. |
| **Add new domain** | Admin: POST to `/api/admin/careers/domains` (name, slug, description). Stored in `career_domains`. |
| **Add/remove/edit fields** | Admin: CRUD on `career_application_fields` (field_key, label, field_type, required, sort_order, options, validation). Public form is built from this config. |
| **Required vs optional** | `career_application_fields.required` (boolean). Frontend Zod schema and backend validation both respect it. |
| **Rate limiting** | `express-rate-limit` on POST `/api/career-application` (e.g. 5/hour/IP). Optional on GET career endpoints. |
| **Captcha** | reCAPTCHA v3; token in POST body; verify on server; bypass for localhost in dev. |
| **Validation** | Frontend: dynamic Zod + react-hook-form. Backend: load domain fields, validate each key against type and required, reject unknown keys. |
| **Duplicate detection** | On submit: check email/phone in career_applications; return 400 if duplicate. In admin: show indicator if same person applied elsewhere. |
| **Compare 2–3 candidates** | Admin: select 2–3 applications (same domain); GET compare endpoint; side-by-side UI. |
| **Confirmation email** | After submit: personalized (name, domain); same HTML/CSS as ambassador emails. |
| **Approval email** | When admin sets status to approved: send welcome/next-steps email; same design. |
| **Field types** | text, email, age, phone, date, link, textarea, number, select, file. Admin chooses type when adding field. |
| **List (select) field** | Admin defines options (e.g. Part time, Full time, Internship); can add, edit, remove options. |
| **CV/document upload** | Per-domain toggle; when enabled, candidate uploads files; stored in Storage; URLs in form_data. |
| **Export Excel/CSV** | Admin exports filtered applications (domain, date range, status) as Excel (.xlsx) or CSV; columns = metadata + all form_data keys. |
| **Audit log** | Log every view and status update of an application (admin_id, application_id, action, timestamp); optional log view or show in application detail. |

**Features you asked to add (all included in this plan):** Duplicate detection; Compare 2–3 candidates; Personalized confirmation email; Approval email after admin approves (same design as existing app emails); Field type list (text, age, phone, date, link, …) when adding a field; List/select fields with admin-editable options (add, edit, remove list items); CV/document upload section (enable/disable per domain); **Export Excel/CSV**; **Audit log**.

---

## 12. File Checklist (for implementation)

- **Supabase**: migration for `career_domains`, `career_application_fields`, `career_applications`, **career_application_logs** (audit), RLS, and `site_content` entry for career settings.
- **server.cjs**: career rate limiter; GET/POST public career routes; duplicate check on submit; admin career routes (settings, domains, fields, applications, **compare**, **export** Excel/CSV); PATCH application (approve → send approval email; **write audit log**); GET application detail (optional: **write audit log** on view); **export endpoint** (Excel/CSV via ExcelJS or CSV); validation helper; reCAPTCHA and rate limit on POST.
- **email.ts** (or server-side templates): **createCareerConfirmationEmail**, **createCareerApprovalEmail** — same HTML/CSS design as ambassador emails.
- **api-routes.ts**: constants for all career endpoints.
- **Pages**: `src/pages/Careers.tsx` (public list + form).
- **Admin**: `CareerTab.tsx`, `CareerDomainForm.tsx`, `CareerFieldsManager.tsx`, `CareerApplicationsList.tsx`, `CareerApplicationDetail.tsx`; register Career tab in Dashboard.
- **App.tsx**: route `/careers` → Careers page.
- **Navigation + Footer**: add "Careers" link.
- **Env**: re-use `VITE_RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY` (same as ambassador).

This plan gives you a single Career experience, admin-controlled domains and dynamic forms, required/optional fields, rate limiting, captcha, and consistent validation on both client and server.

---

## 13. Enhancement Ideas (Optional Add-ons)

Ideas you can add to the Career page over time, grouped by area.

### 11.1 Candidate experience

| Idea | Description |
|------|--------------|
| **Application confirmation email** | On submit, send candidate an email (“We received your application for [Domain]. We’ll get back to you soon.”). Reuse your existing email stack (nodemailer). |
| **Save draft / resume later** | Store a draft in `localStorage` or a temporary token (short-lived link) so they can complete the form later. Optional: “Save progress” button and “Resume with this link” on careers page. |
| **Application receipt / reference number** | After submit, show a unique reference (e.g. `CAR-2025-001234`) and mention “Keep this number for your records.” Stored in `career_applications.reference_number`. |
| **“Why join us” / benefits block** | On the careers list or domain page, show configurable text (e.g. perks, culture, remote policy) from `site_content` or per-domain `career_domains.benefits` (HTML or markdown). |
| **Deadline / closing date per domain** | Add `application_deadline` (date) to `career_domains`. Public page: “Apply before [date].” After deadline, treat domain as closed even if `applications_open` is true. |
| **Multi-language labels for domains/fields** | Store labels as JSON per locale (e.g. `{"en": "Full name", "fr": "Nom complet"}`). Public page uses current language; admin can edit both. |
| **Apply with LinkedIn** | Optional “Import from LinkedIn” (OAuth or manual paste of profile URL). Store URL in form_data; admin sees it in submission detail. |
| **Progress indicator** | For long forms, show “Step X of Y” or a progress bar based on number of fields/sections. |

### 13.2 Admin workflow & organization

| Idea | Description |
|------|--------------|
| **Pipeline / stages** | Status beyond `new` / `reviewed`: e.g. `screening` → `interview` → `offer` → `hired` / `rejected`. Admin can move applications between stages; filter and bulk actions by stage. |
| **Internal notes** | Add `admin_notes` (TEXT or JSONB) on `career_applications`. Only admins see them; useful for “Spoke with candidate on …”. |
| **Tags / labels** | Many-to-many tags (e.g. “urgent”, “second round”) for applications. Table `career_application_tags` + `career_application_tag_assignments`; admin can filter by tag. |
| **Assign to team member** | Optional `assigned_to` (admin user id) on applications so you can see “My applications” and avoid duplicate review. |
| **Bulk actions** | Select multiple submissions → “Mark as reviewed”, “Export selected”, “Add tag”, “Move to stage”. |
| **Duplicate detection** | Before insert, check same email or phone in `career_applications` (same or other domain). Warn admin in UI or block duplicate submit with a clear message. |
| **Archive / hide** | Soft-delete or “archived” status so old applications don’t clutter the list but remain in DB for compliance. |
| **Application comparison view** | Side-by-side view of 2–3 candidates (e.g. same domain) to compare form_data and notes. |

### 13.3 Communication & notifications

| Idea | Description |
|------|--------------|
| **Email to candidate from admin** | In application detail, “Send email” with a template (e.g. “We’d like to invite you to an interview”). Uses your existing send-email API; log in `email_delivery_logs` or a simple `career_emails_sent` table. |
| **Admin notification on new application** | When a new career application is submitted: email to a configured address and/or in-app notification (e.g. bell icon in admin dashboard with count). |
| **SMS reminder (optional)** | If phone is collected, optional “Send SMS” from application detail (reuse your SMS stack). |
| **Auto-reply templates** | Admin defines templates (e.g. “Application received”, “Interview invite”, “Rejection”). Dropdown in “Send email” pre-fills body. |

### 13.4 Analytics & reporting

| Idea | Description |
|------|--------------|
| **Dashboard widgets** | In Career tab: total applications this week/month, by domain; submissions over time (simple chart); conversion funnel (submitted → reviewed → interview). |
| **Export to Excel/CSV** | *(In main plan.)* Export filtered list (domain, date range, status) with all form_data columns; Excel or CSV. |
| **Source / UTM** | Optional hidden fields: `source` (e.g. “careers_page”, “linkedin”), `utm_source`, `utm_medium`. Store in `career_applications`; useful for “Where do candidates come from?”. |
| **Time-to-review metric** | `reviewed_at` timestamp; show “Average time to first review” per domain or globally. |
| **Abandonment (advanced)** | If you add “save draft”, track “started but not submitted” (e.g. by session or temp id) to see drop-off. |

### 11.5 UX & engagement

| Idea | Description |
|------|--------------|
| **Domain image / icon** | `career_domains.image_url` or `icon` (e.g. Lucide icon name). Show on domain cards on the public list. |
| **Salary range / “Competitive”** | Optional field on domain: “Salary: Competitive” or “X–Y TND” (from `site_content` or domain settings). Display on domain card or description. |
| **Remote / hybrid / onsite** | Optional `work_mode` (remote / hybrid / onsite) per domain; show as badge on domain card. |
| **Related domains** | “You might also be interested in: [Domain B]” at bottom of domain A’s form or success page. |
| **Social proof** | “Join X people who already work with us” or “Y applications this month” (optional, from counts). |
| **Cookie consent / GDPR** | Short text: “By applying you agree to our privacy policy and that we process your data for recruitment.” Checkbox required; store consent in `career_applications` (e.g. `consent_given_at`). |
| **Accessibility** | Ensure form has proper labels, ARIA, keyboard nav; contrast and focus states. Matches your existing UI. |

### 13.6 Compliance & data

| Idea | Description |
|------|--------------|
| **Data retention** | Setting: “Auto-archive applications older than X months” (cron or scheduled job to set status or move to archive). |
| **GDPR “Export my data”** | If candidate emails later, you can run a script or admin action: “Export all data for email X” (JSON/PDF) to fulfill requests. |
| **GDPR “Delete my data”** | Admin action or public form (with email + captcha): mark application as deleted / anonymize form_data after verification. |
| **Audit log** | *(In main plan.)* Log who viewed/updated which application and when; table `career_application_logs`. |
| **Consent checkbox** | Required checkbox: “I agree to the processing of my data for recruitment purposes” with link to privacy policy; store in form_data or dedicated column. |

### 11.7 Integrations & tech

| Idea | Description |
|------|--------------|
| **Webhook on new application** | On insert, POST payload to a configurable URL (e.g. Slack, ATS). Store webhook URL in `site_content` or env; retry on failure. |
| **Slack notification** | On new submission, send a message to a Slack channel (incoming webhook) with domain name and link to admin application detail. |
| **Calendar link** | In “Send email” or template, insert “Book a slot” link (e.g. Calendly) so candidate can pick an interview time. |
| **File uploads (CV)** | Field type `file`: upload to Supabase Storage; store URL in form_data. Admin sees “Download CV” in submission detail. Max size and allowed MIME types in validation. |
| **RSS / public feed** | Optional public feed “New openings” (domains that opened in last N days) for job boards or social. |

### 13.8 Quick wins (low effort)

- **Application count on domain cards** (public): “X applicants so far” (or hide if you prefer).
- **Last updated** on domain in admin (e.g. “Last application: 2 hours ago”).
- **Search in submissions** by name, email, or any form_data key (ILIKE on JSONB or dedicated columns).
- **Sort columns** in applications table (date, domain, status).
- **Copy email/phone** from application detail with one click.
- **Permalink** to application (e.g. `/admin#careers/applications/:id`) so you can share with another reviewer.

You can phase these in: start with confirmation email, reference number, and pipeline stages; then add notes, tags, and exports; later add notifications and analytics.

---

## 14. More ideas (beyond current plan)

Additional features you could consider later:

### Candidate & application

- **Application deadline per domain**: Show "Apply before [date]"; after that date, domain is treated as closed.
- **Save draft / resume later**: Store progress in localStorage or via a short-lived link so candidates can finish later.
- **Reference number**: After submit, show a unique code (e.g. CAR-2025-001234) and mention "Keep this for your records."
- **Multi-language field labels**: Store labels as `{ "en": "...", "fr": "..." }` so the form adapts to site language.
- **“Why join us” / benefits**: Configurable block (text or HTML) per domain or global (perks, culture, remote policy).
- **Progress indicator**: For long forms, show "Step X of Y" or a progress bar.

### Admin & workflow

- **Pipeline stages**: e.g. Screening → Interview → Offer → Hired / Rejected; move applications between stages; filter by stage.
- **Internal notes**: Rich text or plain notes per application (admin-only); e.g. "Spoke with candidate on …".
- **Tags**: e.g. "Urgent", "Second round"; filter and bulk-apply tags.
- **Assign to reviewer**: `assigned_to` admin id; "My applications" view.
- **Bulk actions**: Mark as reviewed, export selected, add tag, move to stage.
- **Archive**: Soft-delete or "archived" so old applications stay in DB but are hidden from default list.
- **Rejection email**: When admin sets status to "rejected", optional email to candidate (same design, polite message).

### Communication & notifications

- **Admin alert on new application**: Email to configured address and/or in-app notification (bell icon with count).
- **Email to candidate from detail**: "Send email" button with template (interview invite, request for docs); use same design.
- **SMS**: Optional "Send SMS" from application detail if phone is collected.
- **Auto-reply templates**: Admin-defined templates for "Received", "Interview", "Rejection" to speed up replies.

### Analytics & reporting

- **Dashboard widgets**: Applications per week/month, by domain; submissions over time; funnel (submitted → reviewed → approved).
- **Source / UTM**: Store `utm_source`, `utm_medium` to see where candidates come from.
- **Time to review**: `reviewed_at` timestamp; show average time to first review.

### UX & compliance

- **Domain image or icon**: Optional image/icon per domain on career cards.
- **Salary / work mode**: Optional "Salary: Competitive" or "Remote / Hybrid / Onsite" on domain card.
- **Related domains**: "You might also be interested in: [Domain B]" at bottom of form or success page.
- **GDPR consent**: Required checkbox + link to privacy policy; store consent and timestamp.
- **Data retention**: Auto-archive applications older than X months.

### Integrations

- **Webhook**: On new application, POST payload to configurable URL (e.g. Slack, ATS).
- **Slack notification**: Message to channel on new submission with domain and link to admin.
- **Calendar link**: In approval or interview email, insert "Book a slot" (e.g. Calendly).
- **RSS feed**: Public feed of new openings for job boards.
