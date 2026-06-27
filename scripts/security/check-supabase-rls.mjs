#!/usr/bin/env node
/**
 * Regression check: anon key must not read private tables after RLS hardening.
 * Reads VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (never logs values).
 * Optional SUPABASE_SERVICE_ROLE_KEY enables policy metadata audit via security_rls_policy_audit().
 *
 * Post-migration: count=0 without error is normal for deny-all RLS; inconclusive tables
 * pass when policy audit succeeds.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey) {
  console.error('security:rls — missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(url, anonKey);

const PRIVATE_TABLES = [
  'admins',
  'orders',
  'tickets',
  'qr_tickets',
  'ambassadors',
  'ambassador_applications',
  'contact_messages',
  'newsletter_subscribers',
  'phone_subscribers',
  'sms_logs',
  'order_logs',
  'admin_logs',
  'site_logs',
  'career_applications',
  'audience_suggestions',
  'order_passes',
];

/** Public read tables that may legitimately use USING (true) for SELECT */
const PUBLIC_READ_EXCEPTIONS = new Set(['site_content', 'sponsors', 'team_members', 'payment_options']);

/** Narrow INSERT-only policies on public subscription/contact forms */
const ALLOWED_INSERT_ONLY_POLICIES = new Set([
  'contact_messages|contact_messages_anon_insert',
  'newsletter_subscribers|newsletter_subscribers_anon_insert',
  'phone_subscribers|phone_subscribers_anon_insert',
]);

const inconclusivePrivateTables = [];
let failed = false;

function fail(msg) {
  console.error(`FAIL ${msg}`);
  failed = true;
}

async function expectPrivateDenied(table) {
  const { count, error } = await supabase.from(table).select('*', { head: true, count: 'exact' });
  if (error) {
    console.log(`OK  ${table}: denied (${error.code || 'error'})`);
    return;
  }
  if (count != null && count > 0) {
    fail(`${table}: anon SELECT returned rows (exposure confirmed)`);
    return;
  }
  inconclusivePrivateTables.push(table);
  console.log(`PEND ${table}: count=0 — pending policy audit (deny-all RLS may return empty)`);
}

async function expectPublicEventsFiltered() {
  const { data, error } = await supabase.from('events').select('id, is_test, presale_enabled, event_status');
  if (error) {
    fail(`events public read: ${error.message}`);
    return;
  }
  const bad = (data || []).filter(
    (e) =>
      e.is_test === true ||
      e.presale_enabled === true ||
      (e.event_status && e.event_status === 'cancelled'),
  );
  if (bad.length > 0) {
    fail(`events: ${bad.length} non-listable row(s) visible to anon`);
    return;
  }
  console.log(`OK  events: public filter holds (${(data || []).length} visible row(s))`);
}

async function auditPoliciesWithServiceRole() {
  if (!serviceRoleKey) {
    console.log('SKIP policy audit — SUPABASE_SERVICE_ROLE_KEY not set');
    return false;
  }

  const service = createClient(url, serviceRoleKey);
  const { data, error } = await service.rpc('security_rls_policy_audit');

  if (error) {
    if (error.message?.includes('security_rls_policy_audit') || error.code === 'PGRST202') {
      fail(
        'policy audit RPC missing — migration not applied (expected security_rls_policy_audit function)',
      );
    } else {
      fail(`policy audit RPC: ${error.message}`);
    }
    return false;
  }

  const audit = data || {};
  const rlsOff = audit.rls_disabled_tables || [];
  const permissive = audit.permissive_policies || [];
  const unsafeNames = audit.unsafe_policy_names || [];

  let auditOk = true;

  if (rlsOff.length > 0) {
    fail(`RLS disabled on sensitive tables: ${rlsOff.join(', ')}`);
    auditOk = false;
  } else {
    console.log('OK  policy audit: RLS enabled on all sensitive tables');
  }

  const badPermissive = permissive.filter(
    (p) =>
      !PUBLIC_READ_EXCEPTIONS.has(p.tablename) &&
      !ALLOWED_INSERT_ONLY_POLICIES.has(`${p.tablename}|${p.policyname}`),
  );
  if (badPermissive.length > 0) {
    for (const p of badPermissive) {
      fail(`permissive policy ${p.tablename}.${p.policyname} (${p.cmd})`);
    }
    auditOk = false;
  } else {
    console.log('OK  policy audit: no dangerous broad policies on sensitive tables');
  }

  if (unsafeNames.length > 0) {
    for (const p of unsafeNames) {
      fail(`legacy unsafe policy still present: ${p.tablename}.${p.policyname}`);
    }
    auditOk = false;
  } else {
    console.log('OK  policy audit: no legacy unsafe policy names on sensitive tables');
  }

  return auditOk;
}

function resolveInconclusivePrivateTables(policyAuditPassed) {
  if (inconclusivePrivateTables.length === 0) {
    return;
  }

  console.log('\n--- Resolve inconclusive private tables ---');

  if (policyAuditPassed) {
    for (const table of inconclusivePrivateTables) {
      console.log(`OK  ${table}: deny-all confirmed by policy audit (count=0 inconclusive)`);
    }
    return;
  }

  for (const table of inconclusivePrivateTables) {
    fail(
      `${table}: count=0 inconclusive — policy audit missing or failed (cannot prove deny without audit)`,
    );
  }
}

async function main() {
  console.log('Supabase RLS regression (anon key + policy audit)\n');

  console.log('--- Anon data access ---');
  for (const table of PRIVATE_TABLES) {
    await expectPrivateDenied(table);
  }
  await expectPublicEventsFiltered();

  console.log('\n--- Policy metadata audit (requires service role + migration) ---');
  const policyAuditPassed = await auditPoliciesWithServiceRole();

  resolveInconclusivePrivateTables(policyAuditPassed);

  console.log('');
  if (failed) {
    console.error('RLS regression FAILED');
    process.exit(1);
  }
  console.log('RLS regression passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
