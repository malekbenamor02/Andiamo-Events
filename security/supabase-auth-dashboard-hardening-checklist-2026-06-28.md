# Supabase Auth Dashboard Hardening Checklist — 2026-06-28

Manual steps in Supabase Dashboard (cannot be applied from repo).

## Authentication → Settings

- [ ] **Email OTP expiry** — set to **≤ 3600 seconds (1 hour)** (advisor lint: `auth_otp_long_expiry`)
- [ ] **Leaked password protection** — enable HaveIBeenPwned check (advisor: `auth_leaked_password_protection`)
- [ ] Review **minimum password length** and complexity if Auth users exist
- [ ] Confirm **email confirmation** required for sign-ups if applicable

## URL configuration

- [ ] **Site URL** matches production: `https://www.andiamoevents.com`
- [ ] **Redirect URLs allowlist** — only Andiamo domains + localhost dev ports + Vercel preview pattern (no wildcards beyond project previews)

## JWT / sessions

- [ ] Review JWT expiry for Supabase Auth users (if used alongside custom admin JWT)
- [ ] Confirm custom admin auth does **not** expose service role to browser

## MFA (if available on plan)

- [ ] Enable MFA for team Supabase dashboard access
- [ ] Document break-glass account procedure

## Verification

After changes, re-run Supabase security advisor and record lint clearance in deployment notes.
