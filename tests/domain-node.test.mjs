import assert from 'node:assert/strict';
import { allocatePaymentOldestFirst, boundedDueDate, calculateRentForMonth, getCashFlowSummary, monthEnd, monthStart } from '../.tmp-test/lib/domain.js';

const rates = [
  { id: 'r1', lease_id: 'l1', rent_amount: 25000, effective_from: '2026-01-01', effective_to: '2026-12-31', increase_amount: 0, notes: null, created_at: '', updated_at: '' },
  { id: 'r2', lease_id: 'l1', rent_amount: 27000, effective_from: '2027-01-01', effective_to: '2027-12-31', increase_amount: 2000, notes: null, created_at: '', updated_at: '' },
];

assert.equal(monthStart('2026-07-19'), '2026-07-01');
assert.equal(monthEnd('2026-02-01'), '2026-02-28');
assert.equal(monthEnd('2028-02-01'), '2028-02-29');
assert.equal(boundedDueDate('2026-02-01', 31), '2026-02-28');
assert.equal(calculateRentForMonth('l1', '2026-07-01', rates), 25000);
assert.equal(calculateRentForMonth('l1', '2027-07-01', rates), 27000);
assert.equal(calculateRentForMonth('missing', '2027-07-01', rates), 0);

const paymentPlan = allocatePaymentOldestFirst(30000, [
  { id: 'jan', balance_amount: 10000, period_start: '2026-01-01', created_at: '1', status: 'PARTIAL' },
  { id: 'feb', balance_amount: 25000, period_start: '2026-02-01', created_at: '2', status: 'PENDING' },
  { id: 'mar', balance_amount: 25000, period_start: '2026-03-01', created_at: '3', status: 'PENDING' },
]);
assert.deepEqual(paymentPlan.allocations, [
  { chargeId: 'jan', allocatedAmount: 10000 },
  { chargeId: 'feb', allocatedAmount: 20000 },
]);
assert.equal(paymentPlan.unallocatedAmount, 0);

const preferred = allocatePaymentOldestFirst(5000, [
  { id: 'rent', balance_amount: 25000, period_start: '2026-07-01', created_at: '1', status: 'PENDING' },
  { id: 'electricity', balance_amount: 4500, period_start: '2026-07-01', created_at: '2', status: 'PENDING' },
], 'electricity');
assert.deepEqual(preferred.allocations, [
  { chargeId: 'electricity', allocatedAmount: 4500 },
  { chargeId: 'rent', allocatedAmount: 500 },
]);

const data = {
  profiles: [], tenants: [], properties: [], units: [], leases: [], rentRates: [],
  charges: [
    { id: 'c1', lease_id: 'l1', charge_type: 'RENT', billing_month: '2026-07-01', period_start: '2026-07-01', period_end: '2026-07-31', valid_until: '2026-07-31', due_date: '2026-07-05', description: null, amount: 25000, paid_amount: 25000, balance_amount: 0, status: 'PAID', created_at: '', updated_at: '' },
    { id: 'c2', lease_id: 'l1', charge_type: 'ELECTRICITY', billing_month: '2026-07-01', period_start: '2026-07-01', period_end: '2026-07-31', valid_until: '2026-07-31', due_date: '2026-07-31', description: null, amount: 4500, paid_amount: 4500, balance_amount: 0, status: 'PAID', created_at: '', updated_at: '' },
  ],
  payments: [{ id: 'p1', lease_id: 'l1', payment_date: '2026-07-10', amount: 29500, payment_method: 'CASH', payment_reference: null, notes: null, status: 'ACTIVE', created_at: '', updated_at: '' }],
  allocations: [{ id: 'a1', payment_id: 'p1', charge_id: 'c1', allocated_amount: 25000, created_at: '' }, { id: 'a2', payment_id: 'p1', charge_id: 'c2', allocated_amount: 4500, created_at: '' }],
  expenses: [{ id: 'e1', property_id: 'prop1', unit_id: null, expense_date: '2026-07-11', billing_month: '2026-07-01', category: 'ELECTRICITY_PROVIDER', description: 'Provider bill', amount: 4000, payment_method: 'CASH', notes: null, status: 'ACTIVE', created_at: '', updated_at: '' }],
  auditLogs: [],
};
const cash = getCashFlowSummary(data, '2026-07-01', '2026-07-31');
assert.equal(cash.rentCollected, 25000);
assert.equal(cash.electricityCollected, 4500);
assert.equal(cash.ownerExpenses, 4000);
assert.equal(cash.netProfit, 25500);

const overpaidData = JSON.parse(JSON.stringify(data));
overpaidData.payments[0].amount = 30500;
const overpaidCash = getCashFlowSummary(overpaidData, '2026-07-01', '2026-07-31');
assert.equal(overpaidCash.totalCollected, 30500);
assert.equal(overpaidCash.otherCollected, 1000);
assert.equal(overpaidCash.netProfit, 26500);

console.log('Domain tests passed');
