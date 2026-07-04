import type { AppData, Charge, DashboardSummary, Lease, LeaseRentRate, MonthDashboardRow, PaymentAllocation } from '../types';

export function monthStart(value: string | Date): string {
  if (typeof value === 'string') {
    const normalized = value.length === 7 ? `${value}-01` : value.slice(0, 10);
    const date = new Date(`${normalized}T00:00:00`);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
  }
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-01`;
}

export function monthEnd(month: string): string {
  const [year, rawMonth] = month.slice(0, 7).split('-').map(Number);
  const last = new Date(year, rawMonth, 0).getDate();
  return `${year}-${String(rawMonth).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

export function boundedDueDate(month: string, dueDay: number): string {
  const [year, rawMonth] = month.slice(0, 7).split('-').map(Number);
  const last = new Date(year, rawMonth, 0).getDate();
  const day = Math.min(Math.max(dueDay || 1, 1), last);
  return `${year}-${String(rawMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isBetweenInclusive(target: string, start: string, end: string | null): boolean {
  return target >= start && (!end || target <= end);
}

export function findRentRateForMonth(leaseId: string, month: string, rates: LeaseRentRate[]): LeaseRentRate | undefined {
  const target = monthStart(month);
  return rates
    .filter((rate) => rate.lease_id === leaseId && isBetweenInclusive(target, rate.effective_from, rate.effective_to))
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
}

export function calculateRentForMonth(leaseId: string, month: string, rates: LeaseRentRate[]): number {
  const rate = findRentRateForMonth(leaseId, month, rates);
  return Number(rate?.rent_amount ?? 0);
}

export type AllocationPlan = {
  chargeId: string;
  allocatedAmount: number;
};

export function allocatePaymentOldestFirst(
  paymentAmount: number,
  charges: Pick<Charge, 'id' | 'balance_amount' | 'period_start' | 'created_at' | 'status'>[],
  preferredChargeId?: string,
): { allocations: AllocationPlan[]; unallocatedAmount: number } {
  let remaining = roundMoney(paymentAmount);
  const eligible = charges
    .filter((charge) => charge.status !== 'VOIDED' && Number(charge.balance_amount) > 0)
    .sort((a, b) => a.period_start.localeCompare(b.period_start) || a.created_at.localeCompare(b.created_at));

  const ordered = preferredChargeId
    ? [...eligible.filter((charge) => charge.id === preferredChargeId), ...eligible.filter((charge) => charge.id !== preferredChargeId)]
    : eligible;

  const allocations: AllocationPlan[] = [];
  for (const charge of ordered) {
    if (remaining <= 0) break;
    const amount = Math.min(roundMoney(Number(charge.balance_amount)), remaining);
    if (amount > 0) {
      allocations.push({ chargeId: charge.id, allocatedAmount: amount });
      remaining = roundMoney(remaining - amount);
    }
  }
  return { allocations, unallocatedAmount: roundMoney(remaining) };
}

export function roundMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function chargeStatus(amount: number, paidAmount: number, balanceAmount: number, dueDate: string, today: string): Charge['status'] {
  if (balanceAmount <= 0) return 'PAID';
  if (paidAmount > 0 && paidAmount < amount) return 'PARTIAL';
  if (dueDate < today) return 'OVERDUE';
  return 'PENDING';
}

export function activeChargesForMonth(charges: Charge[], month: string): Charge[] {
  const target = monthStart(month);
  return charges.filter((charge) => charge.status !== 'VOIDED' && monthStart(charge.billing_month) === target);
}

export function previousOutstandingCharges(charges: Charge[], month: string): Charge[] {
  const selectedMonthStart = monthStart(month);
  return charges.filter((charge) => charge.status !== 'VOIDED' && charge.period_start < selectedMonthStart && Number(charge.balance_amount) > 0);
}

export function outstandingChargesThroughMonth(charges: Charge[], month: string): Charge[] {
  const selectedMonthEnd = monthEnd(month);
  return charges.filter((charge) => charge.status !== 'VOIDED' && charge.period_start <= selectedMonthEnd && Number(charge.balance_amount) > 0);
}

export function allocationsByCharge(allocations: PaymentAllocation[]): Record<string, number> {
  return allocations.reduce<Record<string, number>>((acc, allocation) => {
    acc[allocation.charge_id] = roundMoney((acc[allocation.charge_id] ?? 0) + Number(allocation.allocated_amount));
    return acc;
  }, {});
}

export function getMonthDashboardRows(data: AppData, month: string): MonthDashboardRow[] {
  const monthCharges = activeChargesForMonth(data.charges, month);
  const previousCharges = previousOutstandingCharges(data.charges, month);
  return data.leases
    .filter((lease) => lease.status === 'ACTIVE' && isLeaseActiveForMonth(lease, month))
    .map((lease) => {
      const tenant = data.tenants.find((item) => item.id === lease.tenant_id);
      const unit = data.units.find((item) => item.id === lease.unit_id);
      const property = unit ? data.properties.find((item) => item.id === unit.property_id) : undefined;
      const charges = monthCharges.filter((charge) => charge.lease_id === lease.id);
      const previous = previousCharges.filter((charge) => charge.lease_id === lease.id);
      const rentBilled = sum(charges.filter((charge) => charge.charge_type === 'RENT').map((charge) => charge.amount));
      const electricityBilled = sum(charges.filter((charge) => charge.charge_type === 'ELECTRICITY').map((charge) => charge.amount));
      const otherBilled = sum(charges.filter((charge) => charge.charge_type === 'OTHER').map((charge) => charge.amount));
      const paid = sum(charges.map((charge) => charge.paid_amount));
      const balance = sum(charges.map((charge) => charge.balance_amount));
      const previousRentArrears = sum(previous.filter((charge) => charge.charge_type === 'RENT').map((charge) => charge.balance_amount));
      const previousElectricityArrears = sum(previous.filter((charge) => charge.charge_type === 'ELECTRICITY').map((charge) => charge.balance_amount));
      const previousOtherArrears = sum(previous.filter((charge) => charge.charge_type === 'OTHER').map((charge) => charge.balance_amount));
      const previousArrears = roundMoney(previousRentArrears + previousElectricityArrears + previousOtherArrears);
      const totalOutstanding = roundMoney(previousArrears + balance);
      const totalBilled = rentBilled + electricityBilled + otherBilled;
      return {
        leaseId: lease.id,
        tenantName: tenant?.full_name ?? 'Unknown tenant',
        unitName: unit?.unit_name ?? 'Unknown unit',
        propertyName: property?.name ?? 'Unknown property',
        rentBilled,
        electricityBilled,
        otherBilled,
        totalBilled,
        paid,
        balance,
        previousRentArrears,
        previousElectricityArrears,
        previousOtherArrears,
        previousArrears,
        totalOutstanding,
        status: totalOutstanding <= 0 && totalBilled > 0 ? 'Paid' : paid > 0 || previousArrears > 0 ? 'Partial' : 'Unpaid',
      };
    });
}

export function getDashboardSummary(data: AppData, month: string): DashboardSummary {
  const monthCharges = activeChargesForMonth(data.charges, month);
  const previousCharges = previousOutstandingCharges(data.charges, month);
  const expenses = data.expenses.filter((expense) => expense.status !== 'VOIDED' && monthStart(expense.billing_month) === monthStart(month));
  const rentCharges = monthCharges.filter((charge) => charge.charge_type === 'RENT');
  const electricityCharges = monthCharges.filter((charge) => charge.charge_type === 'ELECTRICITY');
  const otherCharges = monthCharges.filter((charge) => charge.charge_type === 'OTHER');
  const rentBilled = sum(rentCharges.map((charge) => charge.amount));
  const electricityBilled = sum(electricityCharges.map((charge) => charge.amount));
  const otherBilled = sum(otherCharges.map((charge) => charge.amount));
  const rentCollected = sum(rentCharges.map((charge) => charge.paid_amount));
  const electricityCollected = sum(electricityCharges.map((charge) => charge.paid_amount));
  const otherCollected = sum(otherCharges.map((charge) => charge.paid_amount));
  const ownerExpenses = sum(expenses.map((expense) => expense.amount));
  const totalCollected = rentCollected + electricityCollected + otherCollected;
  const totalBilled = rentBilled + electricityBilled + otherBilled;
  const currentMonthBalance = sum(monthCharges.map((charge) => charge.balance_amount));
  const previousRentArrears = sum(previousCharges.filter((charge) => charge.charge_type === 'RENT').map((charge) => charge.balance_amount));
  const previousElectricityArrears = sum(previousCharges.filter((charge) => charge.charge_type === 'ELECTRICITY').map((charge) => charge.balance_amount));
  const previousOtherArrears = sum(previousCharges.filter((charge) => charge.charge_type === 'OTHER').map((charge) => charge.balance_amount));
  const previousArrears = roundMoney(previousRentArrears + previousElectricityArrears + previousOtherArrears);
  const totalArrears = roundMoney(previousArrears + currentMonthBalance);
  return {
    rentBilled,
    rentCollected,
    electricityBilled,
    electricityCollected,
    otherBilled,
    otherCollected,
    totalCollected,
    totalBilled,
    currentMonthBalance,
    previousRentArrears,
    previousElectricityArrears,
    previousOtherArrears,
    previousArrears,
    totalArrears,
    ownerExpenses,
    netProfit: roundMoney(totalCollected - ownerExpenses),
  };
}

export function getCashFlowSummary(data: AppData, startDate: string, endDate: string): DashboardSummary {
  const activePayments = data.payments.filter((payment) => payment.status === 'ACTIVE' && payment.payment_date >= startDate && payment.payment_date <= endDate);
  const activePaymentIds = new Set(activePayments.map((payment) => payment.id));
  const allocations = data.allocations.filter((allocation) => activePaymentIds.has(allocation.payment_id));
  const chargeById = new Map(data.charges.map((charge) => [charge.id, charge]));
  const rentCollected = sum(allocations.filter((allocation) => chargeById.get(allocation.charge_id)?.charge_type === 'RENT').map((allocation) => allocation.allocated_amount));
  const electricityCollected = sum(allocations.filter((allocation) => chargeById.get(allocation.charge_id)?.charge_type === 'ELECTRICITY').map((allocation) => allocation.allocated_amount));
  const allocatedOther = sum(allocations.filter((allocation) => chargeById.get(allocation.charge_id)?.charge_type === 'OTHER').map((allocation) => allocation.allocated_amount));
  const totalPaymentAmount = sum(activePayments.map((payment) => payment.amount));
  const allocatedTotal = sum(allocations.map((allocation) => allocation.allocated_amount));
  const unallocatedCollected = Math.max(0, roundMoney(totalPaymentAmount - allocatedTotal));
  const otherCollected = roundMoney(allocatedOther + unallocatedCollected);
  const ownerExpenses = sum(data.expenses.filter((expense) => expense.status !== 'VOIDED' && expense.expense_date >= startDate && expense.expense_date <= endDate).map((expense) => expense.amount));
  const totalCollected = totalPaymentAmount;
  return {
    rentBilled: 0,
    rentCollected,
    electricityBilled: 0,
    electricityCollected,
    otherBilled: 0,
    otherCollected,
    totalCollected,
    totalBilled: 0,
    currentMonthBalance: 0,
    previousRentArrears: 0,
    previousElectricityArrears: 0,
    previousOtherArrears: 0,
    previousArrears: 0,
    totalArrears: 0,
    ownerExpenses,
    netProfit: roundMoney(totalCollected - ownerExpenses),
  };
}

export function isLeaseActiveForMonth(lease: Pick<Lease, 'start_date' | 'end_date'>, month: string): boolean {
  const start = monthStart(month);
  const end = monthEnd(month);
  return lease.start_date <= end && (!lease.end_date || lease.end_date >= start);
}

export function sum(values: Array<number | string | null | undefined>): number {
  return roundMoney(values.reduce<number>((total, value) => total + Number(value ?? 0), 0));
}
