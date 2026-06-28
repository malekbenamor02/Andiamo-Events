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
  'csp_reports',
];

/** Public read tables that may legitimately use USING (true) for SELECT */
const PUBLIC_READ_EXCEPTIONS = new Set([
  'site_content',
  'sponsors',
  'team_members',
  'payment_options',
  'cities',
  'villes',
]);

/** Narrow INSERT-only policies on public subscription/contact forms */
const ALLOWED_INSERT_ONLY_POLICIES = new Set([
  'contact_messages|contact_messages_anon_insert',
  'newsletter_subscribers|newsletter_subscribers_anon_insert',
  'phone_subscribers|phone_subscribers_anon_insert',
]);

const ANON_BLOCKED_RPCS = [
  'security_rls_policy_audit',
  'is_admin_user',
  'cleanup_old_logs',
  'get_log_statistics',
  'is_service_role',
  'release_order_stock_internal',
  'auto_fail_expired_pending_online_orders',
  'auto_reject_expired_pending_cash_orders',
  'apply_expiration_to_existing_pending_cash_orders',
  'clear_expiration_from_existing_pending_cash_orders',
  'verify_stock_calculations',
  'cleanup_old_credentials',
  'validate_scanner_ticket_atomic',
  'insert_fulfillment_tickets_locked',
];

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

async function expectPublicReadAllowed(table) {
  const { count, error } = await supabase.from(table).select('*', { head: true, count: 'exact' });
  if (error) {
    fail(`${table}: public SELECT blocked (${error.code || error.message})`);
    return;
  }
  console.log(`OK  ${table}: public SELECT allowed (count=${count ?? 0})`);
}

async function expectWriteDenied(table, op, run) {
  const result = await run();
  if (result.error) {
    console.log(`OK  ${table}: anon ${op} denied (${result.error.code || 'error'})`);
    return;
  }
  const affected = result.data?.length ?? 0;
  if (affected > 0) {
    fail(`${table}: anon ${op} affected ${affected} row(s)`);
    return;
  }
  console.log(`OK  ${table}: anon ${op} denied (0 rows affected)`);
}

async function expectCspReportsInsertDenied() {
  const { error } = await supabase.from('csp_reports').insert({
    document_uri: 'https://security-test.example.invalid',
    violated_directive: 'script-src',
    blocked_uri: 'inline',
  });
  if (error) {
    console.log(`OK  csp_reports: anon INSERT denied (${error.code || 'error'})`);
    return;
  }
  fail('csp_reports: anon INSERT allowed (must be service-role via backend API only)');
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

async function expectAnonRpcBlocked() {
  const rpcArgs = {
    release_order_stock_internal: { order_id_param: '00000000-0000-0000-0000-000000000001' },
    validate_scanner_ticket_atomic: {
      p_secure_token: 'security-test',
      p_event_id: '00000000-0000-0000-0000-000000000001',
      p_scanner_id: '00000000-0000-0000-0000-000000000002',
    },
    insert_fulfillment_tickets_locked: {
      p_order_id: '00000000-0000-0000-0000-000000000001',
      p_rows: [],
    },
  };

  for (const fn of ANON_BLOCKED_RPCS) {
    const { error } = await supabase.rpc(fn, rpcArgs[fn] ?? {});
    if (error) {
      console.log(`OK  rpc ${fn}: blocked (${error.code || 'error'})`);
      continue;
    }
    fail(`rpc ${fn}: callable by anon`);
  }
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
  const permissivePublic = audit.permissive_public_policies || [];
  const unsafeNames = audit.unsafe_policy_names || [];
  const anonSdFuncs = audit.anon_security_definer_functions || [];

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

  if (permissivePublic.length > 0) {
    for (const p of permissivePublic) {
      fail(`permissive public policy ${p.tablename}.${p.policyname} (${p.cmd})`);
    }
    auditOk = false;
  } else {
    console.log('OK  policy audit: no dangerous broad policies on other public tables');
  }

  if (unsafeNames.length > 0) {
    for (const p of unsafeNames) {
      fail(`legacy unsafe policy still present: ${p.tablename}.${p.policyname}`);
    }
    auditOk = false;
  } else {
    console.log('OK  policy audit: no legacy unsafe policy names on sensitive tables');
  }

  if (anonSdFuncs.length > 0) {
    for (const f of anonSdFuncs) {
      fail(`SECURITY DEFINER function callable by anon: ${f.func_name}(${f.func_args || ''})`);
    }
    auditOk = false;
  } else {
    console.log('OK  policy audit: no unexpected SECURITY DEFINER functions executable by anon');
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

  console.log('--- Anon private table access ---');
  for (const table of PRIVATE_TABLES) {
    await expectPrivateDenied(table);
  }
  await expectPublicEventsFiltered();

  console.log('\n--- Anon public location reads ---');
  await expectPublicReadAllowed('cities');
  await expectPublicReadAllowed('villes');

  console.log('\n--- Anon write probes (must be denied) ---');
  await expectWriteDenied('cities', 'INSERT', () =>
    supabase.from('cities').insert({ name: `security-test-${Date.now()}` }).select('id'),
  );
  await expectWriteDenied('cities', 'UPDATE', () =>
    supabase.from('cities').update({ name: 'security-test-hacked' }).eq('name', 'Sousse').select('id'),
  );
  await expectWriteDenied('cities', 'DELETE', () =>
    supabase.from('cities').delete().eq('name', 'security-test-hacked').select('id'),
  );
  await expectWriteDenied('villes', 'INSERT', () =>
    supabase.from('villes').insert({ name: `security-test-${Date.now()}` }).select('id'),
  );
  await expectWriteDenied('villes', 'UPDATE', () =>
    supabase.from('villes').update({ name: 'security-test-hacked' }).eq('name', 'Akouda').select('id'),
  );
  await expectWriteDenied('villes', 'DELETE', () =>
    supabase.from('villes').delete().eq('name', 'security-test-hacked').select('id'),
  );
  await expectCspReportsInsertDenied();

  console.log('\n--- Anon scans / ticket token probes (must be denied) ---');
  await expectWriteDenied('scans', 'INSERT', () =>
    supabase
      .from('scans')
      .insert({
        event_id: '00000000-0000-0000-0000-000000000001',
        scan_result: 'invalid',
      })
      .select('id'),
  );
  const { data: ticketTokens, error: ticketTokenError } = await supabase
    .from('tickets')
    .select('secure_token')
    .limit(1);
  if (ticketTokenError) {
    console.log(`OK  tickets.secure_token: anon SELECT denied (${ticketTokenError.code || 'error'})`);
  } else if ((ticketTokens || []).length === 0) {
    console.log('PEND tickets.secure_token: count=0 (deny-all may return empty)');
  } else {
    fail('tickets.secure_token: anon SELECT returned row(s)');
  }

  console.log('\n--- Anon RPC probes (must be blocked) ---');
  await expectAnonRpcBlocked();

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

