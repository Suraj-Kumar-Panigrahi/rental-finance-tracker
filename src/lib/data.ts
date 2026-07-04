import { supabase } from './supabase';
import type { AppData } from '../types';

export async function fetchAppData(): Promise<AppData> {
  const [
    profiles,
    tenants,
    properties,
    units,
    leases,
    rentRates,
    charges,
    payments,
    allocations,
    expenses,
    auditLogs,
  ] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('tenants').select('*').order('full_name'),
    supabase.from('properties').select('*').order('name'),
    supabase.from('units').select('*').order('unit_name'),
    supabase.from('leases').select('*').order('start_date', { ascending: false }),
    supabase.from('lease_rent_rates').select('*').order('effective_from', { ascending: false }),
    supabase.from('charges').select('*').order('period_start', { ascending: false }),
    supabase.from('payments').select('*').order('payment_date', { ascending: false }),
    supabase.from('payment_allocations').select('*').order('created_at', { ascending: false }),
    supabase.from('owner_expenses').select('*').order('expense_date', { ascending: false }),
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(250),
  ]);

  const responses = [profiles, tenants, properties, units, leases, rentRates, charges, payments, allocations, expenses, auditLogs];
  const error = responses.find((response) => response.error)?.error;
  if (error) throw error;

  return {
    profiles: profiles.data ?? [],
    tenants: tenants.data ?? [],
    properties: properties.data ?? [],
    units: units.data ?? [],
    leases: leases.data ?? [],
    rentRates: rentRates.data ?? [],
    charges: charges.data ?? [],
    payments: payments.data ?? [],
    allocations: allocations.data ?? [],
    expenses: expenses.data ?? [],
    auditLogs: auditLogs.data ?? [],
  } as AppData;
}

export async function removeRow(table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

export async function upsertRow<T extends Record<string, unknown>>(table: string, payload: T) {
  const { error } = await supabase.from(table).upsert(payload).select().single();
  if (error) throw error;
}

export async function generateMonthlyRent(month: string) {
  const { data, error } = await supabase.rpc('generate_monthly_rent', { p_month: month });
  if (error) throw error;
  return data as number;
}

export async function recordPaymentAuto(payload: {
  leaseId: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  paymentReference?: string | null;
  notes?: string | null;
  preferredChargeId?: string | null;
}) {
  const { data, error } = await supabase.rpc('record_payment_auto', {
    p_lease_id: payload.leaseId,
    p_payment_date: payload.paymentDate,
    p_amount: payload.amount,
    p_payment_method: payload.paymentMethod,
    p_payment_reference: payload.paymentReference ?? null,
    p_notes: payload.notes ?? null,
    p_preferred_charge_id: payload.preferredChargeId ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function voidPayment(paymentId: string) {
  const { error } = await supabase.rpc('void_payment', { p_payment_id: paymentId });
  if (error) throw error;
}
