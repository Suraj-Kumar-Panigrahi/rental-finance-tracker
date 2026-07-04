import { describe, expect, it } from 'vitest';
import { allocatePaymentOldestFirst, boundedDueDate, calculateRentForMonth, monthEnd } from '../src/lib/domain';
import type { Charge, LeaseRentRate } from '../src/types';

describe('rental domain logic', () => {
  it('uses the correct rent rate by monthly validity period', () => {
    const rates: LeaseRentRate[] = [
      { id: '1', lease_id: 'lease', rent_amount: 1000, effective_from: '2026-01-01', effective_to: '2026-12-31', increase_amount: 0, notes: null, created_at: '', updated_at: '' },
      { id: '2', lease_id: 'lease', rent_amount: 1200, effective_from: '2027-01-01', effective_to: '2027-12-31', increase_amount: 200, notes: null, created_at: '', updated_at: '' },
    ];
    expect(calculateRentForMonth('lease', '2026-06-01', rates)).toBe(1000);
    expect(calculateRentForMonth('lease', '2027-06-01', rates)).toBe(1200);
  });

  it('allocates payments oldest first and supports a preferred charge', () => {
    const charges = [
      { id: 'rent', balance_amount: 1000, period_start: '2026-01-01', created_at: '1', status: 'PENDING' },
      { id: 'electricity', balance_amount: 250, period_start: '2026-01-01', created_at: '2', status: 'PENDING' },
    ] as Pick<Charge, 'id' | 'balance_amount' | 'period_start' | 'created_at' | 'status'>[];
    expect(allocatePaymentOldestFirst(300, charges, 'electricity').allocations).toEqual([
      { chargeId: 'electricity', allocatedAmount: 250 },
      { chargeId: 'rent', allocatedAmount: 50 },
    ]);
  });

  it('uses the last day of the month when due day exceeds month length', () => {
    expect(monthEnd('2028-02-01')).toBe('2028-02-29');
    expect(boundedDueDate('2026-02-01', 31)).toBe('2026-02-28');
  });
});
