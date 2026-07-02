import { describe, it, expect } from 'vitest';
import {
  canShowChangeAmbassadorAction,
  formatAdminReassignedAmbassadorNotificationResult,
  formatAdminReassignedCustomerNotificationResult,
  formatOrderActivityDateTime,
} from './orderActivityLogDisplay';

describe('orderActivityLogDisplay', () => {
  it('canShowChangeAmbassadorAction for transferable COD only', () => {
    expect(
      canShowChangeAmbassadorAction({
        payment_method: 'ambassador_cash',
        source: 'platform_cod',
        status: 'PENDING_CASH',
      })
    ).toBe(true);
    expect(
      canShowChangeAmbassadorAction({
        payment_method: 'ambassador_cash',
        source: 'platform_cod',
        status: 'PAID',
      })
    ).toBe(false);
  });

  it('formatAdminReassignedAmbassadorNotificationResult', () => {
    expect(
      formatAdminReassignedAmbassadorNotificationResult(
        { notify_ambassador: true, ambassador_email_sent: true, ambassador_sms_sent: true },
        'en'
      )
    ).toMatch(/email and SMS/i);
    expect(formatAdminReassignedAmbassadorNotificationResult({ notify_ambassador: false }, 'en')).toMatch(
      /skipped/i
    );
  });

  it('formatAdminReassignedCustomerNotificationResult', () => {
    expect(
      formatAdminReassignedCustomerNotificationResult(
        { notify_customer: true, customer_email_sent: true, customer_sms_sent: true },
        'en'
      )
    ).toMatch(/updated ambassador contact/i);
    expect(
      formatAdminReassignedCustomerNotificationResult(
        {
          notify_customer: true,
          customer_email_skipped_reason: 'no_email',
          customer_sms_sent: true,
        },
        'en'
      )
    ).toMatch(/SMS sent/i);
    expect(formatAdminReassignedCustomerNotificationResult({ notify_customer: false }, 'en')).toMatch(
      /skipped/i
    );
  });

  it('formatOrderActivityDateTime uses DD/MM/YYYY', () => {
    const formatted = formatOrderActivityDateTime('2026-07-02T14:30:00.000Z', 'en');
    expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});
