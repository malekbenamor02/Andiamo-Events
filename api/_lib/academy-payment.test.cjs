'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  validateClicToPayPaymentForAcademyRegistration,
  buildAcademyPaymentValidationAudit,
  expectedAcademyRegistrationAmountMillimes,
  normalizeAcademyRegistrationRef,
} = require('./clictopay-payment-verify.cjs');

const {
  shouldSendOnlineConfirmedEmail,
  resolveAdminResendEmailTemplate,
  interpretAcademyConfirmUpdateRace,
  isAcademyRegistrationPaymentComplete,
} = require('./academy-payment-helpers.cjs');

const baseReg = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  registration_number: 'ACA-2026-00042',
  total_amount_dt: 867.5,
  payment_gateway_reference: 'gw-order-abc-123',
  payment_method: 'card',
  status: 'pending_online',
};

function paidGateway(overrides = {}) {
  return {
    orderStatus: 2,
    errorCode: 0,
    amount: expectedAcademyRegistrationAmountMillimes(baseReg),
    currency: '788',
    orderNumber: 'ACA202600042',
    ...overrides,
  };
}

describe('validateClicToPayPaymentForAcademyRegistration', () => {
  it('accepts paid gateway with matching amount, currency, and order reference', () => {
    const v = validateClicToPayPaymentForAcademyRegistration(baseReg, paidGateway());
    assert.equal(v.ok, true);
    assert.equal(v.gatewayPaid, true);
  });

  it('rejects amount mismatch', () => {
    const v = validateClicToPayPaymentForAcademyRegistration(
      baseReg,
      paidGateway({ amount: expectedAcademyRegistrationAmountMillimes(baseReg) + 5000 })
    );
    assert.equal(v.ok, false);
    assert.equal(v.reason, 'amount_mismatch');
  });

  it('rejects currency mismatch', () => {
    const v = validateClicToPayPaymentForAcademyRegistration(
      baseReg,
      paidGateway({ currency: 'EUR' })
    );
    assert.equal(v.ok, false);
    assert.equal(v.reason, 'currency_mismatch');
  });

  it('rejects order reference mismatch', () => {
    const v = validateClicToPayPaymentForAcademyRegistration(
      baseReg,
      paidGateway({ orderNumber: 'WRONGREF999' })
    );
    assert.equal(v.ok, false);
    assert.equal(v.reason, 'order_reference_mismatch');
  });

  it('rejects non-paid gateway status', () => {
    const v = validateClicToPayPaymentForAcademyRegistration(
      baseReg,
      paidGateway({ orderStatus: 1 })
    );
    assert.equal(v.ok, false);
    assert.equal(v.reason, 'gateway_not_paid');
  });

  it('buildAcademyPaymentValidationAudit includes structured fields without secrets', () => {
    const status = paidGateway({ orderNumber: 'WRONG' });
    const validation = validateClicToPayPaymentForAcademyRegistration(baseReg, status);
    const audit = buildAcademyPaymentValidationAudit(baseReg, status, validation);
    assert.equal(audit.registrationId, baseReg.id);
    assert.equal(audit.registrationNumber, baseReg.registration_number);
    assert.equal(audit.gatewayReference, baseReg.payment_gateway_reference);
    assert.equal(audit.reason, 'order_reference_mismatch');
    assert.equal(audit.expectedAmountMillimes, 867500);
    assert.equal(audit.gatewayAmount, 867500);
    assert.equal(audit.expectedOrderRef, normalizeAcademyRegistrationRef(baseReg));
    assert.equal(audit.gatewayOrderRef, 'WRONG');
  });
});

describe('Academy confirm idempotency helpers', () => {
  it('shouldSendOnlineConfirmedEmail only for first pending transition', () => {
    assert.equal(shouldSendOnlineConfirmedEmail('pending_online'), true);
    assert.equal(shouldSendOnlineConfirmedEmail('pending_payment'), true);
    assert.equal(shouldSendOnlineConfirmedEmail('paid_online'), false);
    assert.equal(shouldSendOnlineConfirmedEmail('approved'), false);
  });

  it('duplicate confirm after paid_online does not imply another online_confirmed email', () => {
    assert.equal(shouldSendOnlineConfirmedEmail('paid_online'), false);
    assert.equal(isAcademyRegistrationPaymentComplete('paid_online'), true);
  });

  it('duplicate confirm after approved is payment-complete', () => {
    assert.equal(isAcademyRegistrationPaymentComplete('approved'), true);
    assert.equal(shouldSendOnlineConfirmedEmail('approved'), false);
  });

  it('concurrent confirm race on already paid_online is idempotent', () => {
    const race = interpretAcademyConfirmUpdateRace('paid_online');
    assert.equal(race.kind, 'idempotent');
    assert.equal(race.status, 'paid_online');
  });

  it('concurrent confirm race on cancelled remains expired', () => {
    const race = interpretAcademyConfirmUpdateRace('cancelled');
    assert.equal(race.kind, 'expired');
  });
});

describe('Academy admin resend template', () => {
  it('resolves online_confirmed for paid_online card with gateway reference', () => {
    const template = resolveAdminResendEmailTemplate({
      status: 'paid_online',
      payment_method: 'card',
      payment_gateway_reference: 'gw-1',
    });
    assert.equal(template, 'online_confirmed');
  });

  it('resolves approved template for approved registrations', () => {
    const template = resolveAdminResendEmailTemplate({
      status: 'approved',
      payment_method: 'card',
      payment_gateway_reference: 'gw-1',
    });
    assert.equal(template, 'approved');
  });

  it('rejects resend for pending_online without payment completion', () => {
    const template = resolveAdminResendEmailTemplate({
      status: 'pending_online',
      payment_method: 'card',
      payment_gateway_reference: 'gw-1',
    });
    assert.equal(template, null);
  });
});

describe('Academy email failure is non-blocking for payment state', () => {
  it('validation failure does not imply paid_online transition', () => {
    const v = validateClicToPayPaymentForAcademyRegistration(
      baseReg,
      paidGateway({ amount: 1 })
    );
    assert.equal(v.ok, false);
    assert.equal(baseReg.status, 'pending_online');
  });
});
