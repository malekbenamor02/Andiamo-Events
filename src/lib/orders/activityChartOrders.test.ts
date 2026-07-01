import { describe, expect, it } from 'vitest';
import {
  isPaidActivityChartOrder,
  isPendingActivityChartOrder,
  isExcludedActivitySource,
} from './activityChartOrders';

describe('activityChartOrders', () => {
  it('classifies paid online by created_at eligibility', () => {
    const paid = {
      source: 'platform_online',
      payment_method: 'online',
      payment_status: 'PAID',
      status: 'PAID',
    };
    expect(isPaidActivityChartOrder(paid)).toBe(true);
    expect(isPendingActivityChartOrder(paid)).toBe(false);
  });

  it('classifies pending online separately from paid', () => {
    const pending = {
      source: 'platform_online',
      payment_method: 'online',
      payment_status: 'PENDING_PAYMENT',
      status: 'PENDING_ONLINE',
    };
    expect(isPaidActivityChartOrder(pending)).toBe(false);
    expect(isPendingActivityChartOrder(pending)).toBe(true);
  });

  it('excludes invitation sources', () => {
    expect(isExcludedActivitySource({ source: 'official_invitation' })).toBe(true);
    expect(
      isPaidActivityChartOrder({
        source: 'official_invitation',
        status: 'PAID',
      }),
    ).toBe(false);
  });
});
