# Using Cloudflare Security Features in Andiamo Events

This guide explains how to use **Cloudflare Turnstile**, **Bot Management**, and **HSTS** with your project.

---

## 1. HSTS (HTTP Strict Transport Security)

**What it does:** Forces browsers to use HTTPS only, reducing downgrade and cookie hijacking risks.

**In this project:** HSTS is already configured in code:

- **Cloudflare Pages:** `public/_headers` sets  
  `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- **Vercel:** `vercel.json` applies the same header to all routes.

**What you should do:**

1. **If you use Cloudflare in front of the site (DNS proxy):**
   - Go to **SSL/TLS** → **Edge Certificates**.
   - Find **HTTP Strict Transport Security (HSTS)**.
   - Click **Enable HSTS** and set:
     - **Max-Age:** e.g. 12 months (or keep default).
     - **Include subdomains:** Yes if you use subdomains (e.g. `www`, `api`).
     - **No-Sniff:** Optional; your app already sends `X-Content-Type-Options: nosniff`.
   - Optionally submit your domain to the [HSTS preload list](https://hstspreload.org/) (your header already supports it with `preload`).

2. **If you deploy only to Vercel (no Cloudflare proxy):**  
   No extra step; your existing headers are enough.

---

## 2. Cloudflare Bot Management

**What it does:** Identifies and mitigates bad bot traffic while allowing good bots (e.g. search engines).

**How to use it:** This is configured in the **Cloudflare dashboard**, not in your repo.

1. In Cloudflare Dashboard, select your domain (the one proxied through Cloudflare).
2. Go to **Security** → **Bots**.
3. Enable **Bot Fight Mode** (free) or **Super Bot Fight Mode** (paid), depending on your plan.
4. Adjust rules if needed (e.g. allow specific user-agents or paths for scanners/APIs).

**In your project:** No code changes are required. Bot Management works at the edge. If you have paths that must be reachable by scripts (e.g. `/api/scanner/validate-ticket`), use **Custom rules** or **Exceptions** in Security → Bots so those paths are not blocked.

---

## 3. Cloudflare Turnstile (CAPTCHA alternative)

**What it does:** Verifies that users are human with minimal friction (often invisible), and can replace or complement Google reCAPTCHA.

Your app currently uses **Google reCAPTCHA v3** for:

- Admin login (`src/pages/admin/Login.tsx`, `server.cjs`, `api/admin-login.js`)
- Ambassador auth (`src/pages/ambassador/Auth.tsx`, `api/misc.js`, `server.cjs`)
- Order/ticket creation (`server.cjs` expects `recaptchaToken`)

Below is how to add **Turnstile** (you can run it alongside reCAPTCHA or replace it later).

### 3.1 Get Turnstile keys

1. In Cloudflare Dashboard go to **Turnstile** (under **Web3** or search “Turnstile”).
2. Add a site (e.g. `andiamoevents.com` and `localhost` for dev).
3. Choose widget type (e.g. **Managed – Invisible** for similar UX to reCAPTCHA v3).
4. Copy the **Site Key** (public) and **Secret Key** (server-only).

### 3.2 Environment variables

Add to `.env` and your deployment (e.g. Cloudflare Pages / Vercel):

```bash
# Cloudflare Turnstile (optional – can coexist with reCAPTCHA)
VITE_TURNSTILE_SITE_KEY=your_turnstile_site_key_here
TURNSTILE_SECRET_KEY=your_turnstile_secret_key_here
```

Add `VITE_TURNSTILE_SITE_KEY` to `env.example` as well.

### 3.3 Frontend: load Turnstile and get a token

**Option A – Invisible (managed) widget (recommended):**

1. In `index.html` or your root layout, load the script once:

```html
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
```

2. In any form that currently uses reCAPTCHA (e.g. Login), add a hidden Turnstile container and render the widget when the form is shown:

```tsx
// Example: in Login.tsx
const turnstileContainerId = 'turnstile-container';

useEffect(() => {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (!siteKey || !window.turnstile) return;
  window.turnstile.render(`#${turnstileContainerId}`, {
    sitekey: siteKey,
    size: 'invisible',
    callback: (token: string) => setTurnstileToken(token),
  });
  return () => {
    const container = document.getElementById(turnstileContainerId);
    if (container?.firstChild) container.innerHTML = '';
  };
}, []);

// Before submit: execute invisible widget
const token = await new Promise<string>((resolve) => {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (!siteKey || !window.turnstile) {
    resolve('');
    return;
  }
  window.turnstile.execute(undefined, { callback: resolve });
});
// Then send `turnstileToken: token` in the login request body.
```

3. Add a hidden div for the widget:

```html
<div id={turnstileContainerId} />
```

**Option B – Visible widget:** Use the same script and `turnstile.render()` with `size: 'normal'` (no `execute` step); read the token from the callback when the user completes the challenge.

### 3.4 Backend: verify the token

Verify the token on every protected action (login, order creation, etc.). Add a small helper and call it wherever you currently verify reCAPTCHA.

**Node (server.cjs or API route):**

```js
async function verifyTurnstileToken(token) {
  if (!token || token === 'localhost-bypass-token') return { success: true };
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { success: false };
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response: token }),
  });
  const data = await res.json();
  return { success: data.success === true };
}
```

Use it like this:

```js
const { success } = await verifyTurnstileToken(req.body.turnstileToken);
if (!success) {
  return res.status(400).json({ error: 'Turnstile verification failed' });
}
```

You can accept either `recaptchaToken` or `turnstileToken` and verify the one that is present, so you can migrate gradually.

### 3.5 CSP / Headers

Allow Turnstile in your Content-Security-Policy:

- **frame-src:** `https://challenges.cloudflare.com`
- **script-src:** `https://challenges.cloudflare.com`
- **connect-src:** (optional) `https://challenges.cloudflare.com` if you do something custom

Your `public/_headers` and `vercel.json` already use a report-only CSP; when you move to an enforced CSP, add these origins.

---

## Summary

| Feature            | Where to configure        | Code changes in this project                    |
|--------------------|---------------------------|-------------------------------------------------|
| **HSTS**           | Already in `_headers` + `vercel.json`. Optionally enable in Cloudflare SSL/TLS. | None.                                           |
| **Bot Management** | Cloudflare Dashboard → Security → Bots.        | None. Add exceptions for API paths if needed.  |
| **Turnstile**      | Cloudflare Turnstile + env vars.                | Add widget to login/forms; verify token on server; update CSP. |

If you want, the next step can be a small patch that adds Turnstile to the admin login form and a shared `verifyTurnstileToken` helper in the server.
