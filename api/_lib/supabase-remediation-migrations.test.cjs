'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '../..');
const migrationsDir = resolve(root, 'supabase/migrations');

const REMEDIATION_MIGRATIONS = [
  '20260628115239_revoke_client_maintenance_rpc_execute.sql',
  '20260628115246_harden_is_service_role_execute.sql',
  '20260628115247_harden_security_definer_search_path.sql',
  '20260628115248_restrict_sensitive_realtime_publication.sql',
  '20260628115257_tighten_scans_rls.sql',
  '20260628115259_add_explicit_deny_policies_to_sensitive_tables.sql',
  '20260628120600_harden_events_storage_bucket_policies.sql',
];

const MAINTENANCE_SIGNATURES = [
  'release_order_stock_internal(uuid)',
  'auto_fail_expired_pending_online_orders()',
  'auto_reject_expired_pending_cash_orders()',
  'apply_expiration_to_existing_pending_cash_orders()',
  'clear_expiration_from_existing_pending_cash_orders()',
  'verify_stock_calculations()',
  'cleanup_old_credentials()',
];

const REALTIME_TABLES = [
  'orders',
  'ambassador_applications',
  'career_applications',
  'marketing_campaigns',
  'marketing_campaign_recipients',
];

const DENY_ALL_TABLES = [
  'academy_influencers',
  'pos_users',
  'presale_codes',
  'users',
  'scan_system_config',
];

function readMigration(name) {
  const path = resolve(migrationsDir, name);
  assert.ok(existsSync(path), `missing migration ${name}`);
  return readFileSync(path, 'utf8');
}

describe('supabase remediation migration package (static)', () => {
  for (const file of REMEDIATION_MIGRATIONS) {
    it(`${file} exists`, () => {
      assert.ok(existsSync(resolve(migrationsDir, file)));
    });
  }

  it('maintenance RPC migration revokes client EXECUTE with guarded DO block', () => {
    const sql = readMigration(REMEDIATION_MIGRATIONS[0]);
    assert.match(sql, /to_regprocedure/);
    assert.match(sql, /REVOKE ALL ON FUNCTION public\./);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\./);
    for (const sig of MAINTENANCE_SIGNATURES) {
      assert.match(sql, new RegExp(sig.replace(/[()]/g, '\\$&')));
    }
    assert.doesNotMatch(sql, /\bDROP FUNCTION\b/i);
    assert.doesNotMatch(sql, /\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b/i);
  });

  it('is_service_role migration inlines auth.role() and revokes client EXECUTE', () => {
    const sql = readMigration(REMEDIATION_MIGRATIONS[1]);
    assert.match(sql, /auth\.role\(\) = 'service_role'/);
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.is_service_role\(\)/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.is_service_role\(\) TO service_role/);
    assert.match(sql, /csp_reports_service_insert/);
    assert.match(sql, /security_audit_logs_service_insert/);
    assert.match(sql, /aio_events_submissions_service_insert/);
  });

  it('search_path migration alters ticket RPCs with exact signatures', () => {
    const sql = readMigration(REMEDIATION_MIGRATIONS[2]);
    assert.match(sql, /insert_fulfillment_tickets_locked\(uuid, jsonb\)/);
    assert.match(sql, /validate_scanner_ticket_atomic\(text, uuid, uuid, text, text\)/);
    assert.match(sql, /search_path = public, pg_catalog/);
  });

  it('realtime migration drops sensitive tables idempotently', () => {
    const sql = readMigration(REMEDIATION_MIGRATIONS[3]);
    assert.match(sql, /pg_publication_tables/);
    assert.match(sql, /ALTER PUBLICATION supabase_realtime DROP TABLE/);
    for (const table of REALTIME_TABLES) {
      assert.match(sql, new RegExp(`'${table}'`));
    }
  });

  it('scans migration removes ambassador policies and adds service_role policy', () => {
    const sql = readMigration(REMEDIATION_MIGRATIONS[4]);
    assert.match(sql, /DROP POLICY IF EXISTS "Ambassadors can insert scans"/);
    assert.match(sql, /scans_service_role_all/);
    const createPolicy = sql.slice(sql.indexOf('CREATE POLICY "scans_service_role_all"'));
    assert.doesNotMatch(createPolicy, /auth\.uid\(\)/);
  });

  it('deny-all migration covers sensitive tables with guarded DO block', () => {
    const sql = readMigration(REMEDIATION_MIGRATIONS[5]);
    assert.match(sql, /to_regclass/);
    for (const table of DENY_ALL_TABLES) {
      assert.match(sql, new RegExp(`'${table}'`));
    }
    assert.match(sql, /USING \(false\) WITH CHECK \(false\)/);
  });

  it('events storage migration adds service_role-only policy', () => {
    const sql = readMigration(REMEDIATION_MIGRATIONS[6]);
    assert.match(sql, /Service role manage events assets/);
    assert.match(sql, /bucket_id = 'events'/);
    assert.match(sql, /auth\.role\(\) = 'service_role'/);
  });

  it('validation SQL file is SELECT-only', () => {
    const path = resolve(root, 'security/supabase-remediation-validation-2026-06-28.sql');
    assert.ok(existsSync(path));
    const sql = readFileSync(path, 'utf8');
    assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE|TRUNCATE)\b/i);
  });
});
