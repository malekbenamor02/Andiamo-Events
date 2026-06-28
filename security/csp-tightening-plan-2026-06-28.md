# CSP Tightening Plan — 2026-06-28

## Current CSP (vercel.json)

Enforcing + Report-Only (identical) on `/(.*)`:

- `default-src 'self'`
- `script-src 'self' 'unsafe-inline' 'unsafe-eval' https: …` (Clarity)
- `style-src 'self' 'unsafe-inline' https:`
- `connect-src` includes Supabase, Sentry, Clarity, ClicToPay, Vercel analytics
- `report-uri /api/csp-report`

## Unsafe directives

| Directive | Why present |
|-----------|-------------|
| `'unsafe-inline'` (script) | Vite/React inline bootstrap; third-party snippets |
| `'unsafe-eval'` (script) | Dev tooling / some bundled deps (verify with production bundle audit) |
| `'unsafe-inline'` (style) | Tailwind + component inline styles |

## Dependencies requiring unsafe rules

- **Microsoft Clarity** — external script host allowlist already present
- **Vite production build** — may inject inline modulepreload / small inline chunks
- **Tailwind** — inline `style` attributes and CSS-in-JS patterns
- **ClicToPay / Google** — `frame-src` / `connect-src` (not unsafe-inline)

## Staged rollout

1. **Monitor** — Report-Only already mirrors enforce policy; review `/api/admin/csp-reports`.
2. **Nonce pilot** — Vercel middleware or build plugin to emit `script-src 'nonce-…'` for app shell only (Report-Only first).
3. **Remove unsafe-eval** — run production bundle without eval; fix or isolate offenders.
4. **Style hardening** — move critical inline styles to CSS files; test admin dashboard.
5. **Enforce** — flip enforcing policy after 2 weeks clean Report-Only.

## Test checklist

- [ ] Home, pass purchase, payment processing
- [ ] Admin login + dashboard tabs
- [ ] Scanner / POS / ambassador / influencer login
- [ ] Clarity + Sentry + analytics events in network tab
- [ ] ClicToPay iframe checkout
- [ ] CSP report endpoint receives violations only in pilot

## Phase 1 (this pass)

`scripts/verify-security-headers.js` emits **warnings** for `unsafe-inline` / `unsafe-eval` without failing the check.
