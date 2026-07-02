'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('order-reassignment-notify', () => {
  it('notifyReassignmentRecipients sends ambassador and customer when both enabled', async () => {
    const calls = { ambassador: 0, customer: 0 };
    const ambassadorModule = require('./ambassador-new-order-notify.cjs');
    const clientModule = require('./cod-order-client-notify.cjs');
    const originalAmb = ambassadorModule.notifyAmbassadorNewOrder;
    const originalClient = clientModule.notifyClientOrderConfirmation;

    ambassadorModule.notifyAmbassadorNewOrder = async () => {
      calls.ambassador += 1;
      return { emailSent: true, smsSent: true, emailError: null, smsError: null, skippedReason: null };
    };
    clientModule.notifyClientOrderConfirmation = async () => {
      calls.customer += 1;
      return {
        emailSent: true,
        smsSent: true,
        emailError: null,
        smsError: null,
        emailSkippedReason: null,
        smsSkippedReason: null,
        skippedReason: null,
      };
    };

    delete require.cache[require.resolve('./order-reassignment-notify.cjs')];
    const { notifyReassignmentRecipients } = require('./order-reassignment-notify.cjs');

    const result = await notifyReassignmentRecipients({}, 'o1', {
      notifyAmbassador: true,
      notifyCustomer: true,
      newAmbassador: { id: 'a-new', full_name: 'New', phone: '22', email: 'n@x.com' },
    });

    ambassadorModule.notifyAmbassadorNewOrder = originalAmb;
    clientModule.notifyClientOrderConfirmation = originalClient;

    assert.equal(calls.ambassador, 1);
    assert.equal(calls.customer, 1);
    assert.equal(result.ambassador.emailSent, true);
    assert.equal(result.customer.emailSent, true);
  });

  it('notifyCustomer=false skips customer notifications only', async () => {
    const calls = { ambassador: 0, customer: 0 };
    const ambassadorModule = require('./ambassador-new-order-notify.cjs');
    const clientModule = require('./cod-order-client-notify.cjs');
    const originalAmb = ambassadorModule.notifyAmbassadorNewOrder;
    const originalClient = clientModule.notifyClientOrderConfirmation;

    ambassadorModule.notifyAmbassadorNewOrder = async () => {
      calls.ambassador += 1;
      return { emailSent: true, smsSent: true, emailError: null, smsError: null, skippedReason: null };
    };
    clientModule.notifyClientOrderConfirmation = async () => {
      calls.customer += 1;
      return {};
    };

    delete require.cache[require.resolve('./order-reassignment-notify.cjs')];
    const { notifyReassignmentRecipients } = require('./order-reassignment-notify.cjs');

    const result = await notifyReassignmentRecipients({}, 'o1', {
      notifyAmbassador: true,
      notifyCustomer: false,
      newAmbassador: { id: 'a-new', full_name: 'New', phone: '22', email: 'n@x.com' },
    });

    ambassadorModule.notifyAmbassadorNewOrder = originalAmb;
    clientModule.notifyClientOrderConfirmation = originalClient;

    assert.equal(calls.ambassador, 1);
    assert.equal(calls.customer, 0);
    assert.equal(result.customer.skippedReason, 'notifications_disabled');
  });
});
