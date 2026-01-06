# Security Helper Scripts

## Available Scripts

### 1. Generate Webhook Secret
Generate a secure random secret for `FLOUCI_WEBHOOK_SECRET`.

```bash
npm run security:generate-secret
# or
node scripts/generate-webhook-secret.js
```

**Output:** A random 64-character hex string you can add to your `.env` file.

---

### 2. Check Security Configuration
Check if all security-related environment variables are configured.

```bash
npm run security:check
# or
node scripts/check-security-config.js
```

**What it checks:**
- ✅ Required variables (FLOUCI keys, JWT_SECRET)
- ⚠️ Recommended variables (RECAPTCHA, SECURITY_ALERT_EMAIL)
- ℹ️ Optional variables (FLOUCI_WEBHOOK_SECRET)

---

### 3. Interactive Security Setup
Interactive script to help configure security settings.

```bash
npm run security:setup
# or
node scripts/setup-security.js
```

**Features:**
- Generates webhook secret if needed
- Prompts for security alert email
- Enables security logging option
- Updates `.env` file automatically

---

## Quick Start

1. **Check current configuration:**
   ```bash
   npm run security:check
   ```

2. **Generate webhook secret (optional):**
   ```bash
   npm run security:generate-secret
   ```
   Copy the output to your `.env` file.

3. **Interactive setup:**
   ```bash
   npm run security:setup
   ```

---

## Notes

- **FLOUCI_WEBHOOK_SECRET** is optional - webhook is already secure via API verification
- All scripts use Node.js built-in modules (no extra dependencies)
- Scripts read from `.env` file (if exists) or `env.example`

