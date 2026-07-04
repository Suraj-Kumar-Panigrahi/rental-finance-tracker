export type Role = 'admin' | 'viewer';
export type RecordStatus = 'ACTIVE' | 'INACTIVE';
export type LeaseStatus = 'ACTIVE' | 'ENDED';
export type ChargeType = 'RENT' | 'ELECTRICITY' | 'OTHER';
export type ChargeStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'VOIDED';
export type PaymentStatus = 'ACTIVE' | 'VOIDED' | 'REVERSED';
export type ExpenseStatus = 'ACTIVE' | 'VOIDED';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'CARD' | 'CHEQUE' | 'OTHER';
export type ExpenseCategory = 'REPAIR' | 'MAINTENANCE' | 'ELECTRICITY_PROVIDER' | 'CLEANING' | 'SECURITY' | 'TAX' | 'OTHER';

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: Role;
  created_at: string;
};

export type Tenant = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  status: RecordStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Property = {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Unit = {
  id: string;
  property_id: string;
  unit_name: string;
  status: 'VACANT' | 'OCCUPIED' | 'MAINTENANCE';
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Lease = {
  id: string;
  tenant_id: string;
  unit_id: string;
  start_date: string;
  end_date: string | null;
  due_day: number;
  advance_amount: number;
  advance_date: string | null;
  security_deposit_amount: number;
  security_deposit_date: string | null;
  status: LeaseStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type LeaseRentRate = {
  id: string;
  lease_id: string;
  rent_amount: number;
  effective_from: string;
  effective_to: string;
  increase_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Charge = {
  id: string;
  lease_id: string;
  charge_type: ChargeType;
  billing_month: string;
  period_start: string;
  period_end: string;
  valid_until: string;
  due_date: string;
  description: string | null;
  amount: number;
  paid_amount: number;
  balance_amount: number;
  status: ChargeStatus;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  lease_id: string;
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_reference: string | null;
  notes: string | null;
  status: PaymentStatus;
  created_at: string;
  updated_at: string;
};

export type PaymentAllocation = {
  id: string;
  payment_id: string;
  charge_id: string;
  allocated_amount: number;
  created_at: string;
};

export type OwnerExpense = {
  id: string;
  property_id: string;
  unit_id: string | null;
  expense_date: string;
  billing_month: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  payment_method: PaymentMethod;
  notes: string | null;
  status: ExpenseStatus;
  created_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
};

export type AppData = {
  profiles: Profile[];
  tenants: Tenant[];
  properties: Property[];
  units: Unit[];
  leases: Lease[];
  rentRates: LeaseRentRate[];
  charges: Charge[];
  payments: Payment[];
  allocations: PaymentAllocation[];
  expenses: OwnerExpense[];
  auditLogs: AuditLog[];
};

export type MonthDashboardRow = {
  leaseId: string;
  tenantName: string;
  unitName: string;
  propertyName: string;
  rentBilled: number;
  electricityBilled: number;
  otherBilled: number;
  totalBilled: number;
  paid: number;
  balance: number;
  previousRentArrears: number;
  previousElectricityArrears: number;
  previousOtherArrears: number;
  previousArrears: number;
  totalOutstanding: number;
  status: 'Paid' | 'Partial' | 'Unpaid';
};

export type DashboardSummary = {
  rentBilled: number;
  rentCollected: number;
  electricityBilled: number;
  electricityCollected: number;
  otherBilled: number;
  otherCollected: number;
  totalCollected: number;
  totalBilled: number;
  currentMonthBalance: number;
  previousRentArrears: number;
  previousElectricityArrears: number;
  previousOtherArrears: number;
  previousArrears: number;
  totalArrears: number;
  ownerExpenses: number;
  netProfit: number;
};
