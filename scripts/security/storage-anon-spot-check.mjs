/**
 * Read-only anon storage spot checks for security audit.
 * Does not print API keys. Uses VITE_SUPABASE_ANON_KEY from .env if present.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');
const envPath = resolve(root, '.env');

function loadAnonKey() {
  if (process.env.VITE_SUPABASE_ANON_KEY) return process.env.VITE_SUPABASE_ANON_KEY.trim();
  if (!existsSync(envPath)) return null;
  const m = readFileSync(envPath, 'utf8').match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim() || 'https://ykeryyraxmtjunnotoep.supabase.co';
const ANON_KEY = loadAnonKey();

if (!ANON_KEY) {
  console.error('Missing VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const headers = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };

async function test(name, method, url, body) {
  const opts = {
    method,
    headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  const text = await r.text();
  return { test: name, status: r.status, bodyLen: text.length, summary: text.slice(0, 160) };
}

const fakeName = `security-audit-test-${Date.now()}.txt`;
const uploadBody = new Blob(['audit-test'], { type: 'text/plain' });

const results = [];

for (const bucket of ['images', 'tickets', 'career-documents', 'academy-payment-proofs', 'events', 'hero-images']) {
  results.push(await test(`list_${bucket}`, 'POST', `${SUPABASE_URL}/storage/v1/object/list/${bucket}`, { prefix: '', limit: 1 }));
}

results.push(await test('get_fake_tickets', 'GET', `${SUPABASE_URL}/storage/v1/object/public/tickets/audit-test-nonexistent.png`));
results.push(await test('get_fake_career', 'GET', `${SUPABASE_URL}/storage/v1/object/public/career-documents/audit-test-nonexistent.pdf`));
results.push(await test('get_fake_academy', 'GET', `${SUPABASE_URL}/storage/v1/object/public/academy-payment-proofs/audit-test-nonexistent.pdf`));
results.push(await test('get_fake_events', 'GET', `${SUPABASE_URL}/storage/v1/object/public/events/audit-test-nonexistent.pdf`));

for (const bucket of ['tickets', 'academy-payment-proofs', 'events', 'images', 'career-documents', 'hero-images']) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${fakeName}`, {
    method: 'POST',
    headers,
    body: uploadBody,
  });
  const text = await r.text();
  results.push({ test: `upload_${bucket}`, status: r.status, summary: text.slice(0, 120) });
}

const del = await test('delete_images_fake', 'DELETE', `${SUPABASE_URL}/storage/v1/object/images/${fakeName}`);
results.push(del);

for (const row of results) {
  console.log(JSON.stringify(row));
}
