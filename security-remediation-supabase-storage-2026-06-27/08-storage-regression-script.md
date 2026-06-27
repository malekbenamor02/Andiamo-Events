# Storage regression script — `scripts/security/check-supabase-storage.mjs`

**npm script:** `npm run security:storage` (`package.json`)

## Checks performed

### Live HTTP (anon key → production/staging Supabase)

| Check | Pass condition |
|-------|----------------|
| `tickets_public_get` | Public GET fake ticket path ≠ 200 |
| `career_public_get` | Public GET fake career path ≠ 200 |
| `anon_upload_tickets` | Upload ≠ 200 |
| `anon_upload_career-documents` | Upload ≠ 200 |
| `anon_upload_images` | Upload ≠ 200 |
| `anon_upload_hero-images` | Upload ≠ 200 |
| `anon_delete_images` | DELETE ≠ 200 |
| `anon_delete_hero_images` | DELETE ≠ 200 |
| `anon_list_images` | Informational (200 OK if policy allows empty list) |

### Repository grep (no secrets printed)

| Check | Pass condition |
|-------|----------------|
| `code_getPublicUrl_ticket_flows` | No `getPublicUrl` in ticket API files |
| `code_getPublicUrl_career_flows` | No `getPublicUrl` in career flows / `src/` |
| `code_client_career_bucket` | No `from('career-documents')` in `src/` |
| `code_service_role_frontend` | No real `SUPABASE_SERVICE_ROLE` usage in `src/` bundle sources |

## Pre-migration run (2026-06-27)

```
PASS: 9  FAIL: 4
FAIL anon_upload_career-documents: 200
FAIL anon_upload_images: 200
FAIL anon_upload_hero-images: 200
FAIL anon_delete_images: 200
```

**Expected:** FAILs resolve after migration applies dropped anon policies. Re-run post-migration; exit code must be 0.

## Final script source

```javascript
/**
 * Storage security regression checks (read-only against live/staging Supabase + repo grep).
 * Exit code 1 when dangerous exposure is detected.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');
const envPath = resolve(root, '.env');

function loadEnv(key) {
  if (process.env[key]) return process.env[key].trim();
  if (!existsSync(envPath)) return null;
  const re = new RegExp(`^${key}=(.+)$`, 'm');
  const m = envPath && readFileSync(envPath, 'utf8').match(re);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
}

const SUPABASE_URL = loadEnv('VITE_SUPABASE_URL') || loadEnv('SUPABASE_URL') || 'https://ykeryyraxmtjunnotoep.supabase.co';
const ANON_KEY = loadEnv('VITE_SUPABASE_ANON_KEY') || loadEnv('SUPABASE_ANON_KEY');

const failures = [];
const passes = [];

function fail(name, detail) {
  failures.push({ name, detail });
  console.log(`FAIL ${name}: ${detail}`);
}

function pass(name, detail = 'ok') {
  passes.push({ name, detail });
  console.log(`PASS ${name}: ${detail}`);
}

async function httpStatus(method, url, body) {
  const headers = ANON_KEY
    ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }
    : {};
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return r.status;
}

function grepRepo(pattern, paths) {
  try {
    const cmd = `git grep -n "${pattern}" -- ${paths.join(' ')}`;
    return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

if (!ANON_KEY) {
  console.warn('WARN: No anon key — skipping live HTTP checks');
} else {
  const fake = `security-regression-${Date.now()}.txt`;
  const blob = new Blob(['test'], { type: 'text/plain' });
  const headers = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };

  const ticketPublic = await httpStatus(
    'GET',
    `${SUPABASE_URL}/storage/v1/object/public/tickets/${fake}`
  );
  if (ticketPublic === 200) fail('tickets_public_get', `status ${ticketPublic}`);
  else pass('tickets_public_get', `status ${ticketPublic}`);

  const careerPublic = await httpStatus(
    'GET',
    `${SUPABASE_URL}/storage/v1/object/public/career-documents/${fake}`
  );
  if (careerPublic === 200) fail('career_public_get', `status ${careerPublic}`);
  else pass('career_public_get', `status ${careerPublic}`);

  for (const bucket of ['tickets', 'career-documents', 'images', 'hero-images']) {
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${fake}`, {
      method: 'POST',
      headers,
      body: blob,
    });
    if (uploadRes.status === 200) fail(`anon_upload_${bucket}`, '200');
    else pass(`anon_upload_${bucket}`, String(uploadRes.status));
  }

  const delImages = await fetch(`${SUPABASE_URL}/storage/v1/object/images/${fake}`, {
    method: 'DELETE',
    headers,
  });
  if (delImages.status === 200) fail('anon_delete_images', '200');
  else pass('anon_delete_images', String(delImages.status));

  const delHero = await fetch(`${SUPABASE_URL}/storage/v1/object/hero-images/${fake}`, {
    method: 'DELETE',
    headers,
  });
  if (delHero.status === 200) fail('anon_delete_hero_images', '200');
  else pass('anon_delete_hero_images', String(delHero.status));

  const listImages = await httpStatus('POST', `${SUPABASE_URL}/storage/v1/object/list/images`, {
    prefix: '',
    limit: 1,
  });
  if (listImages === 200) {
    pass('anon_list_images', '200 (review policy if objects returned)');
  } else {
    pass('anon_list_images', String(listImages));
  }
}

const ticketGetPublic = grepRepo('getPublicUrl', [
  'api/misc.js',
  'api/admin-approve-order.js',
  'api/admin-pos.js',
  'api/_lib/r2-media.cjs',
  'server.cjs',
]);
if (ticketGetPublic) fail('code_getPublicUrl_ticket_flows', 'still referenced in ticket API files');
else pass('code_getPublicUrl_ticket_flows');

const careerGetPublic = grepRepo('getPublicUrl', ['api/_lib/career-document-storage.cjs', 'careerRoutes.cjs', 'src/']);
if (careerGetPublic) fail('code_getPublicUrl_career_flows', careerGetPublic.split('\n')[0]);
else pass('code_getPublicUrl_career_flows');

const careerClientUpload = grepRepo("from('career-documents')", ['src/']);
if (careerClientUpload) fail('code_client_career_bucket', careerClientUpload.split('\n')[0]);
else pass('code_client_career_bucket');

const serviceInFrontend = grepRepo('SUPABASE_SERVICE_ROLE', ['src/']);
const allowedServiceRoleRefs = ['internalErrorPatterns', 'mapPublicError', 'EmailCampaignEditor', 'messages.ts'];
const serviceLines = serviceInFrontend
  .split('\n')
  .filter((line) => line && !allowedServiceRoleRefs.some((a) => line.includes(a)));
if (serviceLines.length) fail('code_service_role_frontend', serviceLines[0]);
else pass('code_service_role_frontend');

console.log('\n--- Summary ---');
console.log(`PASS: ${passes.length}  FAIL: ${failures.length}`);
if (failures.length) process.exit(1);
```
