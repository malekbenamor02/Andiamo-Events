#!/usr/bin/env node
/**
 * Recover Academy registration emails / auto-approve (idempotent, no re-charge).
 *
 * Usage:
 *   node scripts/recover-academy-registration-fulfillment.mjs --registration-id <uuid>
 *   node scripts/recover-academy-registration-fulfillment.mjs --registration-number ACA-00042
 *   node scripts/recover-academy-registration-fulfillment.mjs --registration-id <uuid> --dry-run
 */
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const requireCjs = createRequire(import.meta.url);

const { recoverAcademyRegistrationFulfillment } = requireCjs(
  join(root, 'api/_lib/academy-payment-fulfillment.cjs')
);

function parseArgs(argv) {
  const out = { dryRun: false, forceEmail: true, retryApprove: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--no-force-email') out.forceEmail = false;
    else if (a === '--no-retry-approve') out.retryApprove = false;
    else if (a === '--registration-id') out.registrationId = argv[++i];
    else if (a === '--registration-number') out.registrationNumber = argv[++i];
  }
  return out;
}

async function resolveRegistrationId(db, args) {
  if (args.registrationId) return args.registrationId;
  if (!args.registrationNumber) {
    throw new Error('Provide --registration-id or --registration-number');
  }
  const { data, error } = await db
    .from('academy_registrations')
    .select('id')
    .eq('registration_number', args.registrationNumber)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error(`Registration not found: ${args.registrationNumber}`);
  return data.id;
}

async function main() {
  const args = parseArgs(process.argv);
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(1);
  }

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const registrationId = await resolveRegistrationId(db, args);
  const result = await recoverAcademyRegistrationFulfillment(db, registrationId, {
    forceEmail: args.forceEmail,
    retryApprove: args.retryApprove,
    dryRun: args.dryRun,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
