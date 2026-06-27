#!/usr/bin/env node
/**
 * Recover ticket + email fulfillment for PAID orders (idempotent).
 *
 * Usage:
 *   node scripts/recover-paid-order-fulfillment.mjs --order-number 998935
 *   node scripts/recover-paid-order-fulfillment.mjs --order-id <uuid>
 *   node scripts/recover-paid-order-fulfillment.mjs --order-number 998935 --dry-run
 *   node scripts/recover-paid-order-fulfillment.mjs --batch-underfulfilled --since 2026-06-27 --dry-run
 */
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import nodePath from 'path';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const requireCjs = createRequire(import.meta.url);

const {
  fulfillPaidOrderTicketsAndEmail,
  buildFulfillmentDepsFromMisc,
  expectedTicketCount,
} = requireCjs(join(root, 'api/_lib/paid-order-fulfillment.cjs'));

function parseArgs(argv) {
  const out = { dryRun: false, forceEmail: true, batchUnderfulfilled: false, since: '2026-06-27' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--order-id') out.orderId = argv[++i];
    else if (a === '--order-number') out.orderNumber = argv[++i];
    else if (a === '--no-force-email') out.forceEmail = false;
    else if (a === '--batch-underfulfilled') out.batchUnderfulfilled = true;
    else if (a === '--since') out.since = argv[++i];
  }
  return out;
}

async function listUnderfulfilledPaidOnline(db, since) {
  const { data: orders, error } = await db
    .from('orders')
    .select(
      'id, order_number, user_email, status, payment_method, source, approved_at, order_passes ( quantity ), tickets ( id )'
    )
    .eq('status', 'PAID')
    .gte('approved_at', `${since}T00:00:00.000Z`)
    .or('payment_method.eq.online,source.eq.platform_online');

  if (error) throw new Error(error.message);

  return (orders || [])
    .map((o) => {
      const expected = expectedTicketCount(o.order_passes || []);
      const ticketCount = (o.tickets || []).length;
      return {
        id: o.id,
        order_number: o.order_number,
        user_email: o.user_email,
        approved_at: o.approved_at,
        expected_tickets: expected,
        ticket_count: ticketCount,
      };
    })
    .filter((row) => row.expected_tickets > 0 && row.ticket_count < row.expected_tickets);
}

async function recoverOne(db, fulfillmentDeps, orderId, args) {
  const result = await fulfillPaidOrderTicketsAndEmail(db, fulfillmentDeps, {
    orderId,
    source: 'recovery_script',
    forceEmail: args.forceEmail !== false,
    dryRun: args.dryRun,
  });
  return result;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.orderId && !args.orderNumber && !args.batchUnderfulfilled) {
    console.error(
      'Provide --order-id, --order-number, or --batch-underfulfilled (optional --since YYYY-MM-DD, --dry-run)'
    );
    process.exit(1);
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(1);
  }

  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const fulfillmentDeps = buildFulfillmentDepsFromMisc(
    requireCjs,
    nodePath,
    nodePath.join(root, 'api/_lib')
  );

  if (args.batchUnderfulfilled) {
    const rows = await listUnderfulfilledPaidOnline(db, args.since);
    console.log(
      `\n=== Batch ${args.dryRun ? 'dry-run' : 'recover'}: PAID online orders since ${args.since} with missing tickets ===`
    );
    console.log(`Found ${rows.length} order(s)\n`);
    if (!rows.length) return;

    for (const row of rows) {
      console.log(
        `#${row.order_number} ${row.id} approved_at=${row.approved_at} tickets=${row.ticket_count}/${row.expected_tickets}`
      );
      if (!args.dryRun) {
        const result = await recoverOne(db, fulfillmentDeps, row.id, args);
        console.log(JSON.stringify(result, null, 2));
      } else {
        const result = await recoverOne(db, fulfillmentDeps, row.id, { ...args, dryRun: true });
        console.log('dry-run actions:', result.dryRunActions);
      }
      console.log('---');
    }
    return;
  }

  let orderId = args.orderId;
  if (!orderId && args.orderNumber) {
    const num = parseInt(String(args.orderNumber), 10);
    if (!Number.isFinite(num)) {
      console.error('Invalid --order-number');
      process.exit(1);
    }
    const { data, error } = await db
      .from('orders')
      .select('id, status, order_number')
      .eq('order_number', num)
      .maybeSingle();
    if (error || !data) {
      console.error('Order not found for order_number', args.orderNumber, error?.message || '');
      process.exit(1);
    }
    orderId = data.id;
    console.log(`Resolved order #${data.order_number} → ${orderId} (status: ${data.status})`);
  }

  const result = await recoverOne(db, fulfillmentDeps, orderId, args);

  console.log('\n=== Recovery result ===');
  console.log(JSON.stringify(result, null, 2));
  if (args.dryRun && result.dryRunActions?.length) {
    console.log('\nPlanned actions (no side effects):');
    for (const action of result.dryRunActions) console.log(`  - ${action}`);
  }

  if (!result.success && result.error) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
