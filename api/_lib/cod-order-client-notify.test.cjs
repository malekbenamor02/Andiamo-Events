'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  applyAmbassadorOverride,
  sendClientOrderConfirmationSmsNotification,
} = require('./cod-order-client-notify.cjs');
const { buildClientOrderConfirmationSMS } = require('../../smsTemplates.cjs');

describe('cod-order-client-notify', () => {
  it('applyAmbassadorOverride replaces ambassador contact on order', () => {
    const order = {
      id: 'o1',
      ambassador_id: 'old-id',
      ambassadors: { id: 'old-id', full_name: 'Old Amb', phone: '11111111' },
      total_price: 100,
      order_number: 42,
    };
    const overridden = applyAmbassadorOverride(order, {
      id: 'new-id',
      full_name: 'New Amb',
      phone: '22222222',
    });
    assert.equal(overridden.ambassadors.full_name, 'New Amb');
    assert.equal(overridden.ambassadors.phone, '22222222');
    assert.equal(overridden.ambassador_id, 'new-id');
  });

  it('customer SMS uses new ambassador name and phone explicitly', () => {
    const message = buildClientOrderConfirmationSMS({
      order: { total_price: 100, order_number: 42 },
      passes: [{ pass_type: 'VIP', quantity: 1 }],
      ambassador: { full_name: 'New Amb', phone: '22222222' },
    });
    assert.match(message, /New Amb/);
    assert.match(message, /22222222/);
    assert.doesNotMatch(message, /Old Amb/);
  });

  it('sendClientOrderConfirmationSmsNotification skips when no phone', async () => {
    const prevKey = process.env.WINSMS_API_KEY;
    process.env.WINSMS_API_KEY = 'test-key';
    const db = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          single: async () => ({
            data: {
              id: 'o1',
              user_phone: null,
              total_price: 100,
              order_number: 42,
              order_passes: [{ pass_type: 'VIP', quantity: 1, price: 100 }],
              ambassadors: { full_name: 'New Amb', phone: '22222222' },
            },
            error: null,
          }),
        };
      },
    };

    const result = await sendClientOrderConfirmationSmsNotification(db, 'o1', {
      ambassadorOverride: { full_name: 'New Amb', phone: '22222222' },
    });
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'no_phone');
    if (prevKey === undefined) delete process.env.WINSMS_API_KEY;
    else process.env.WINSMS_API_KEY = prevKey;
  });
});
