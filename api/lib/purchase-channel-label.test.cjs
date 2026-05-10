'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { getPurchaseChannelLabel } = require('./purchase-channel-label.cjs');

test('platform_online → Online', () => {
  assert.strictEqual(
    getPurchaseChannelLabel({ source: 'platform_online', payment_method: 'online' }),
    'Online'
  );
});

test('point_de_vente with outlet name', () => {
  assert.strictEqual(
    getPurchaseChannelLabel({
      source: 'point_de_vente',
      payment_method: 'pos',
      pos_outlets: { name: 'Outlet A' },
    }),
    'Point de vente · Outlet A'
  );
});

test('point_de_vente without outlet', () => {
  assert.strictEqual(getPurchaseChannelLabel({ source: 'point_de_vente', payment_method: 'pos' }), 'Point de vente');
});

test('platform_cod uses ambassador name', () => {
  assert.strictEqual(
    getPurchaseChannelLabel({
      source: 'platform_cod',
      payment_method: 'ambassador_cash',
      ambassadors: { full_name: 'Jane Ambassador' },
    }),
    'Jane Ambassador'
  );
});

test('ambassador_manual cash falls back when no name', () => {
  assert.strictEqual(
    getPurchaseChannelLabel({ source: 'ambassador_manual', payment_method: 'ambassador_cash', ambassadors: {} }),
    'Ambassador'
  );
});

test('invitation mode', () => {
  assert.strictEqual(getPurchaseChannelLabel({}, { mode: 'invitation' }), 'Official invitation');
});
