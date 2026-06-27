#!/usr/bin/env node
/** Safe anon RLS spot-check — metadata/status only, no row dumps */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = val;
  }
}
loadEnvFile(resolve(root, '.env'));
loadEnvFile(resolve(root, '.env.local'));

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error('missing supabase env');
  process.exit(1);
}
const sb = createClient(url, anonKey);

const privateTables = [
  'admins', 'orders', 'tickets', 'qr_tickets', 'ambassadors', 'ambassador_applications',
  'contact_messages', 'newsletter_subscribers', 'phone_subscribers', 'sms_logs',
  'order_logs', 'admin_logs', 'site_logs', 'career_applications', 'audience_suggestions',
  'order_passes', 'admin_tab_access', 'ambassador_application_selections',
];

console.log('--- anon SELECT (count only) ---');
for (const table of privateTables) {
  const { count, error } = await sb.from(table).select('*', { head: true, count: 'exact' });
  if (error) console.log(`SELECT ${table}: DENIED (${error.code || 'error'})`);
  else console.log(`SELECT ${table}: count=${count ?? 0}`);
}

console.log('\n--- anon INSERT attempts ---');
const insertTests = [
  ['orders', { user_email: 'security-test@example.invalid', status: 'pending' }],
  ['admins', { email: 'security-test@example.invalid', password_hash: 'fake' }],
  ['tickets', { order_id: '00000000-0000-0000-0000-000000000001' }],
  ['events', { name: 'Security Test Event', slug: 'security-test-' + Date.now() }],
  ['contact_messages', {
    name: 'Security Test',
    email: 'security-test+rls@andiamoevents.com',
    message: 'Post-remediation validation test',
    status: 'approved',
  }],
  ['contact_messages', {
    name: 'Security Test',
    email: 'security-test+rls@andiamoevents.com',
    message: 'Post-remediation validation test',
  }],
  ['newsletter_subscribers', { email: 'security-test+rls@andiamoevents.com', import_label: 'admin-import' }],
  ['newsletter_subscribers', { email: 'security-test+rls-nolabel@andiamoevents.com' }],
];
for (const [table, payload] of insertTests) {
  const { error } = await sb.from(table).insert(payload);
  const tag = payload.status === 'approved' ? ' (elevated status)' : payload.import_label ? ' (import_label set)' : '';
  if (error) console.log(`INSERT ${table}${tag}: BLOCKED (${error.code})`);
  else console.log(`INSERT ${table}${tag}: ALLOWED`);
}

console.log('\n--- anon UPDATE/DELETE ---');
const upd = await sb
  .from('orders')
  .update({ status: 'hacked' })
  .eq('id', '00000000-0000-0000-0000-000000000001')
  .select('id');
console.log(
  `UPDATE orders: ${upd.error ? 'BLOCKED (' + upd.error.code + ')' : 'no-error rows_affected=' + (upd.data?.length ?? 0)}`,
);

const del = await sb
  .from('contact_messages')
  .delete()
  .neq('id', '00000000-0000-0000-0000-000000000000')
  .select('id');
console.log(
  `DELETE contact_messages: ${del.error ? 'BLOCKED (' + del.error.code + ')' : 'no-error rows_deleted=' + (del.data?.length ?? 0)}`,
);

const contactInsert = await sb.from('contact_messages').insert({
  name: 'Security Test',
  email: 'security-test+rls@andiamoevents.com',
  message: 'Post-remediation validation test',
  subject: 'Security Test',
});
console.log(
  `INSERT contact (no returning): ${contactInsert.error ? 'BLOCKED (' + contactInsert.error.code + ')' : 'ALLOWED'}`,
);

const qrSel = await sb.from('qr_tickets').select('secure_token').limit(1);
console.log(`SELECT qr_tickets.secure_token: ${qrSel.error ? 'DENIED (' + qrSel.error.code + ')' : 'rows=' + (qrSel.data?.length ?? 0)}`);
