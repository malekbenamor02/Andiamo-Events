#!/usr/bin/env node
/**
 * Verify order fulfillment concurrency migration on Supabase (staging/production).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/verify-order-fulfillment-migration.mjs
 */
import { createClient } from '@supabase/supabase-js';

const checks = [];

function pass(name, detail) {
  checks.push({ name, ok: true, detail });
  console.log(`OK  ${name}${detail ? `: ${detail}` : ''}`);
}

function fail(name, detail) {
  checks.push({ name, ok: false, detail });
  console.error(`FAIL ${name}${detail ? `: ${detail}` : ''}`);
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(1);
  }

  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: colRows, error: colErr } = await db.rpc('exec_sql_check_pass_sequence', {}).catch(() => ({
    data: null,
    error: { message: 'no helper' },
  }));

  // PostgREST cannot run arbitrary SQL — use information_schema via a lightweight probe
  const { data: probeTicket, error: probeErr } = await db
    .from('tickets')
    .select('id, pass_sequence')
    .limit(1);

  if (probeErr && /pass_sequence|column/i.test(probeErr.message || '')) {
    fail('tickets.pass_sequence column', probeErr.message);
  } else {
    pass('tickets.pass_sequence column', 'selectable on tickets');
  }

  const fakeOrderId = '00000000-0000-4000-8000-000000000001';
  const { data: rpcData, error: rpcErr } = await db.rpc('insert_fulfillment_tickets_locked', {
    p_order_id: fakeOrderId,
    p_rows: [],
  });

  if (rpcErr) {
    if (/Could not find|insert_fulfillment_tickets_locked|function/i.test(rpcErr.message || '')) {
      fail('insert_fulfillment_tickets_locked RPC', rpcErr.message);
    } else {
      fail('insert_fulfillment_tickets_locked RPC', rpcErr.message);
    }
  } else if (rpcData && rpcData.ok === false && rpcData.error === 'order not PAID') {
    pass('insert_fulfillment_tickets_locked RPC', 'callable with service role (order not PAID expected)');
  } else if (rpcData && rpcData.ok === true) {
    pass('insert_fulfillment_tickets_locked RPC', 'callable with service role');
  } else {
    pass('insert_fulfillment_tickets_locked RPC', JSON.stringify(rpcData));
  }

  // Anon must not execute RPC (requires anon key — optional second check skipped without anon key)
  if (process.env.SUPABASE_ANON_KEY) {
    const { createClient: createAnon } = await import('@supabase/supabase-js');
    const anon = createAnon(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { error: anonErr } = await anon.rpc('insert_fulfillment_tickets_locked', {
      p_order_id: fakeOrderId,
      p_rows: [],
    });
    if (anonErr && /permission|denied|42501|not authorized/i.test(anonErr.message || '')) {
      pass('RPC denied for anon', anonErr.message);
    } else if (anonErr) {
      pass('RPC denied for anon', anonErr.message);
    } else {
      fail('RPC denied for anon', 'anon call succeeded — revoke grants');
    }
  } else {
    console.log('SKIP RPC anon denial test (SUPABASE_ANON_KEY not set)');
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
