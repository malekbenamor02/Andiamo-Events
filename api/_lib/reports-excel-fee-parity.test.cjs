'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '../..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('reports Excel — server payment fee parity', () => {
  const savedRate = process.env.ONLINE_PAYMENT_FEE_RATE;

  beforeEach(() => {
    delete require.cache[require.resolve('./online-payment-fee.cjs')];
    delete require.cache[require.resolve('./online-payment-fee-shim.cjs')];
  });

  afterEach(() => {
    if (savedRate === undefined) {
      delete process.env.ONLINE_PAYMENT_FEE_RATE;
    } else {
      process.env.ONLINE_PAYMENT_FEE_RATE = savedRate;
    }
    delete require.cache[require.resolve('./online-payment-fee.cjs')];
    delete require.cache[require.resolve('./online-payment-fee-shim.cjs')];
  });

  it('shim defaults to 0.05 when ONLINE_PAYMENT_FEE_RATE is unset', () => {
    delete process.env.ONLINE_PAYMENT_FEE_RATE;
    const { getOnlinePaymentFeeRate } = require('./online-payment-fee-shim.cjs');
    assert.equal(getOnlinePaymentFeeRate(), 0.05);
  });

  it('shim reads ONLINE_PAYMENT_FEE_RATE at runtime (not silently 0)', () => {
    process.env.ONLINE_PAYMENT_FEE_RATE = '0.08';
    const { computeOnlinePaymentFeesDisplay } = require('./online-payment-fee-shim.cjs');
    const result = computeOnlinePaymentFeesDisplay(100);
    assert.equal(result.feeRate, 0.08);
    assert.equal(result.feeAmount, 8);
    assert.equal(result.totalWithFees, 108);
  });

  it('reports-order-helpers uses online-payment-fee.cjs default', () => {
    delete process.env.ONLINE_PAYMENT_FEE_RATE;
    delete require.cache[require.resolve('./reports-order-helpers.cjs')];
    const { getOrderReportRevenue } = require('./reports-order-helpers.cjs');
    const revenue = getOrderReportRevenue({
      payment_method: 'online',
      payment_status: 'PAID',
      status: 'PAID',
      order_passes: [{ quantity: 1, price: 100 }],
    });
    assert.equal(revenue, 105);
  });

  it('esbuild bundle has no import.meta.env or empty import_meta shim', () => {
    const bundle = read('api/_lib/reports-excel-export.cjs');
    assert.doesNotMatch(bundle, /import\.meta\.env/);
    assert.doesNotMatch(bundle, /var import_meta = \{\}/);
    assert.match(bundle, /online-payment-fee-shim|online-payment-fee\.cjs/);
  });
});
