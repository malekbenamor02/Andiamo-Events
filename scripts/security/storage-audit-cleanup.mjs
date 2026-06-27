import { readFileSync, existsSync } from 'node:fs';

const env = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
const key = (
  process.env.VITE_SUPABASE_ANON_KEY ||
  env.match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '')
);
const url = 'https://ykeryyraxmtjunnotoep.supabase.co';
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const testNames = [
  'security-audit-test-1782521915422.txt',
  'security-audit-test-1782521934122.txt',
];

for (const bucket of ['hero-images']) {
  for (const testName of testNames) {
    const r = await fetch(`${url}/storage/v1/object/${bucket}/${testName}`, { method: 'DELETE', headers });
    console.log(`cleanup ${bucket}/${testName}: ${r.status}`);
  }
}

const listTickets = await fetch(`${url}/storage/v1/object/list/tickets`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ prefix: 'tickets/', limit: 2 }),
});
console.log('list_tickets_prefix', listTickets.status, (await listTickets.text()).slice(0, 150));
