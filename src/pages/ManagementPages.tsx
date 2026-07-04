import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { removeRow, upsertRow, recordPaymentAuto, voidPayment } from '../lib/data';
import { getCashFlowSummary, getDashboardSummary, monthEnd, monthStart } from '../lib/domain';
import { currentMonthISO, dateLabel, fromMonthInputValue, money, monthLabel, todayISO, toMonthInputValue } from '../lib/format';
import type { AppData, Charge, ChargeType, Lease, OwnerExpense, Payment, PaymentMethod, Profile, Property, Tenant, Unit } from '../types';
import { Badge, Button, Card, EmptyState, Field, Input, Select, Textarea } from '../components/ui';

type PageProps = { data: AppData; profile: Profile | null; reload: () => Promise<void> };
const isAdmin = (profile: Profile | null) => profile?.role === 'admin';
const blank = '';

function fullLeaseLabel(data: AppData, lease: Lease | undefined) {
  if (!lease) return 'Unknown lease';
  const tenant = data.tenants.find((item) => item.id === lease.tenant_id)?.full_name ?? 'Unknown tenant';
  const unit = data.units.find((item) => item.id === lease.unit_id);
  const property = data.properties.find((item) => item.id === unit?.property_id)?.name ?? 'Unknown property';
  return `${tenant} — ${property} / ${unit?.unit_name ?? 'Unknown unit'}`;
}

function statusTone(status: string) {
  if (['ACTIVE', 'PAID', 'Paid'].includes(status)) return 'green' as const;
  if (['PARTIAL', 'PENDING', 'Partial'].includes(status)) return 'yellow' as const;
  if (['VOIDED', 'REVERSED', 'OVERDUE', 'Unpaid'].includes(status)) return 'red' as const;
  return 'slate' as const;
}

async function safeDelete(table: string, id: string, reload: () => Promise<void>) {
  if (!confirm('Delete this record? For financial records, prefer voiding instead of deleting.')) return;
  try {
    await removeRow(table, id);
    await reload();
  } catch (error) {
    alert(error instanceof Error ? error.message : 'Delete failed');
  }
}

export function TenantsPage({ data, profile, reload }: PageProps) {
  const [editing, setEditing] = useState<Partial<Tenant> | null>(null);
  const canEdit = isAdmin(profile);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await upsertRow('tenants', {
        id: editing?.id,
        full_name: String(form.get('full_name')),
        phone: String(form.get('phone') || '') || null,
        email: String(form.get('email') || '') || null,
        status: String(form.get('status')),
        notes: String(form.get('notes') || '') || null,
      });
      setEditing(null);
      await reload();
    } catch (error) { alert(error instanceof Error ? error.message : 'Save failed'); }
  };
  return (
    <Section title="Tenants" action={canEdit && <Button onClick={() => setEditing({ status: 'ACTIVE' })}>Add Tenant</Button>}>
      {editing && <Card className="mb-5"><FormTitle title={editing.id ? 'Edit Tenant' : 'Add Tenant'} onCancel={() => setEditing(null)} /><form className="grid gap-4 md:grid-cols-2" onSubmit={save}>
        <Field label="Full name"><Input name="full_name" required defaultValue={editing.full_name ?? ''} /></Field>
        <Field label="Phone"><Input name="phone" defaultValue={editing.phone ?? ''} /></Field>
        <Field label="Email"><Input name="email" type="email" defaultValue={editing.email ?? ''} /></Field>
        <Field label="Status"><Select name="status" defaultValue={editing.status ?? 'ACTIVE'}><option>ACTIVE</option><option>INACTIVE</option></Select></Field>
        <div className="md:col-span-2"><Field label="Notes"><Textarea name="notes" defaultValue={editing.notes ?? ''} /></Field></div>
        <div><Button>Save Tenant</Button></div>
      </form></Card>}
      <Table headers={['Name', 'Phone', 'Email', 'Status', 'Actions']} empty="No tenants yet.">
        {data.tenants.map((tenant) => <tr key={tenant.id}>
          <td className="py-3 pr-4 font-semibold">{tenant.full_name}</td><td className="py-3 pr-4">{tenant.phone ?? '-'}</td><td className="py-3 pr-4">{tenant.email ?? '-'}</td><td className="py-3 pr-4"><Badge tone={tenant.status === 'ACTIVE' ? 'green' : 'slate'}>{tenant.status}</Badge></td>
          <td className="py-3 pr-4">{canEdit && <RowActions onEdit={() => setEditing(tenant)} onDelete={() => safeDelete('tenants', tenant.id, reload)} />}</td>
        </tr>)}
      </Table>
    </Section>
  );
}

export function PropertiesPage({ data, profile, reload }: PageProps) {
  const [property, setProperty] = useState<Partial<Property> | null>(null);
  const [unit, setUnit] = useState<Partial<Unit> | null>(null);
  const canEdit = isAdmin(profile);
  const saveProperty = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try { await upsertRow('properties', { id: property?.id, name: String(form.get('name')), address: String(form.get('address') || '') || null, notes: String(form.get('notes') || '') || null }); setProperty(null); await reload(); }
    catch (error) { alert(error instanceof Error ? error.message : 'Save failed'); }
  };
  const saveUnit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try { await upsertRow('units', { id: unit?.id, property_id: String(form.get('property_id')), unit_name: String(form.get('unit_name')), status: String(form.get('status')), notes: String(form.get('notes') || '') || null }); setUnit(null); await reload(); }
    catch (error) { alert(error instanceof Error ? error.message : 'Save failed'); }
  };
  return <div className="space-y-6">
    <Section title="Properties" action={canEdit && <Button onClick={() => setProperty({})}>Add Property</Button>}>
      {property && <Card className="mb-5"><FormTitle title={property.id ? 'Edit Property' : 'Add Property'} onCancel={() => setProperty(null)} /><form className="grid gap-4 md:grid-cols-2" onSubmit={saveProperty}>
        <Field label="Name"><Input name="name" required defaultValue={property.name ?? ''} /></Field>
        <Field label="Address"><Input name="address" defaultValue={property.address ?? ''} /></Field>
        <div className="md:col-span-2"><Field label="Notes"><Textarea name="notes" defaultValue={property.notes ?? ''} /></Field></div><Button>Save Property</Button>
      </form></Card>}
      <Table headers={['Name', 'Address', 'Notes', 'Actions']} empty="No properties yet.">{data.properties.map((item) => <tr key={item.id}><td className="py-3 pr-4 font-semibold">{item.name}</td><td className="py-3 pr-4">{item.address ?? '-'}</td><td className="py-3 pr-4">{item.notes ?? '-'}</td><td>{canEdit && <RowActions onEdit={() => setProperty(item)} onDelete={() => safeDelete('properties', item.id, reload)} />}</td></tr>)}</Table>
    </Section>
    <Section title="Units" action={canEdit && <Button disabled={data.properties.length === 0} onClick={() => setUnit({ status: 'VACANT' })}>Add Unit</Button>}>
      {unit && <Card className="mb-5"><FormTitle title={unit.id ? 'Edit Unit' : 'Add Unit'} onCancel={() => setUnit(null)} /><form className="grid gap-4 md:grid-cols-2" onSubmit={saveUnit}>
        <Field label="Property"><Select name="property_id" required defaultValue={unit.property_id ?? ''}><option value="">Select property</option>{data.properties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        <Field label="Unit name"><Input name="unit_name" required defaultValue={unit.unit_name ?? ''} /></Field>
        <Field label="Status"><Select name="status" defaultValue={unit.status ?? 'VACANT'}><option>VACANT</option><option>OCCUPIED</option><option>MAINTENANCE</option></Select></Field>
        <Field label="Notes"><Input name="notes" defaultValue={unit.notes ?? ''} /></Field><Button>Save Unit</Button>
      </form></Card>}
      <Table headers={['Property', 'Unit', 'Status', 'Notes', 'Actions']} empty="No units yet.">{data.units.map((item) => <tr key={item.id}><td className="py-3 pr-4">{data.properties.find((p) => p.id === item.property_id)?.name ?? '-'}</td><td className="py-3 pr-4 font-semibold">{item.unit_name}</td><td className="py-3 pr-4"><Badge tone={item.status === 'OCCUPIED' ? 'green' : item.status === 'MAINTENANCE' ? 'yellow' : 'slate'}>{item.status}</Badge></td><td className="py-3 pr-4">{item.notes ?? '-'}</td><td>{canEdit && <RowActions onEdit={() => setUnit(item)} onDelete={() => safeDelete('units', item.id, reload)} />}</td></tr>)}</Table>
    </Section>
  </div>;
}

export function LeasesPage({ data, profile, reload }: PageProps) {
  const [editing, setEditing] = useState<Partial<Lease> & { rent_amount?: number; rent_from?: string; rent_to?: string } | null>(null);
  const canEdit = isAdmin(profile);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const payload = {
        tenant_id: String(form.get('tenant_id')),
        unit_id: String(form.get('unit_id')),
        start_date: String(form.get('start_date')),
        end_date: String(form.get('end_date') || '') || null,
        due_day: Number(form.get('due_day')),
        advance_amount: Number(form.get('advance_amount') || 0),
        advance_date: String(form.get('advance_date') || '') || null,
        security_deposit_amount: Number(form.get('security_deposit_amount') || 0),
        security_deposit_date: String(form.get('security_deposit_date') || '') || null,
        status: String(form.get('status')),
        notes: String(form.get('notes') || '') || null,
      };
      if (editing?.id) {
        await upsertRow('leases', { id: editing.id, ...payload });
      } else {
        const { data: inserted, error } = await supabase.from('leases').insert(payload).select().single();
        if (error) throw error;
        await supabase.from('lease_rent_rates').insert({ lease_id: inserted.id, rent_amount: Number(form.get('rent_amount') || 0), effective_from: String(form.get('rent_from')), effective_to: String(form.get('rent_to')), increase_amount: 0, notes: 'Initial rent rate' });
      }
      setEditing(null); await reload();
    } catch (error) { alert(error instanceof Error ? error.message : 'Save failed'); }
  };
  return <Section title="Leases" action={canEdit && <Button disabled={!data.tenants.length || !data.units.length} onClick={() => setEditing({ status: 'ACTIVE', due_day: 5, start_date: todayISO(), rent_from: todayISO(), rent_to: monthEnd(todayISO()) })}>Add Lease</Button>}>
    {editing && <Card className="mb-5"><FormTitle title={editing.id ? 'Edit Lease' : 'Add Lease'} onCancel={() => setEditing(null)} /><form className="grid gap-4 md:grid-cols-3" onSubmit={save}>
      <Field label="Tenant"><Select name="tenant_id" required defaultValue={editing.tenant_id ?? ''}><option value="">Select tenant</option>{data.tenants.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</Select></Field>
      <Field label="Unit"><Select name="unit_id" required defaultValue={editing.unit_id ?? ''}><option value="">Select unit</option>{data.units.map((item) => <option key={item.id} value={item.id}>{data.properties.find((p) => p.id === item.property_id)?.name ?? '-'} / {item.unit_name}</option>)}</Select></Field>
      <Field label="Due day"><Input name="due_day" type="number" min="1" max="31" required defaultValue={editing.due_day ?? 5} /></Field>
      <Field label="Start date"><Input name="start_date" type="date" required defaultValue={editing.start_date ?? todayISO()} /></Field>
      <Field label="End date"><Input name="end_date" type="date" defaultValue={editing.end_date ?? ''} /></Field>
      <Field label="Status"><Select name="status" defaultValue={editing.status ?? 'ACTIVE'}><option>ACTIVE</option><option>ENDED</option></Select></Field>
      {!editing.id && <><Field label="Initial monthly rent"><Input name="rent_amount" type="number" min="0" step="0.01" required defaultValue={editing.rent_amount ?? 0} /></Field><Field label="Rent effective from"><Input name="rent_from" type="date" required defaultValue={editing.rent_from ?? todayISO()} /></Field><Field label="Rent effective to"><Input name="rent_to" type="date" required defaultValue={editing.rent_to ?? monthEnd(todayISO())} /></Field></>}
      <Field label="Advance amount"><Input name="advance_amount" type="number" step="0.01" defaultValue={editing.advance_amount ?? 0} /></Field>
      <Field label="Advance date"><Input name="advance_date" type="date" defaultValue={editing.advance_date ?? ''} /></Field>
      <Field label="Security deposit"><Input name="security_deposit_amount" type="number" step="0.01" defaultValue={editing.security_deposit_amount ?? 0} /></Field>
      <Field label="Security deposit date"><Input name="security_deposit_date" type="date" defaultValue={editing.security_deposit_date ?? ''} /></Field>
      <div className="md:col-span-3"><Field label="Notes"><Textarea name="notes" defaultValue={editing.notes ?? ''} /></Field></div><Button>Save Lease</Button>
    </form></Card>}
    <Table headers={['Tenant / Unit', 'Dates', 'Due Day', 'Advance', 'Deposit', 'Status', 'Actions']} empty="No leases yet.">{data.leases.map((lease) => <tr key={lease.id}><td className="py-3 pr-4 font-semibold">{fullLeaseLabel(data, lease)}</td><td className="py-3 pr-4">{dateLabel(lease.start_date)} → {lease.end_date ? dateLabel(lease.end_date) : 'Open'}</td><td className="py-3 pr-4">{lease.due_day}</td><td className="py-3 pr-4">{money(lease.advance_amount)}<br /><span className="text-xs text-slate-500">{dateLabel(lease.advance_date)}</span></td><td className="py-3 pr-4">{money(lease.security_deposit_amount)}<br /><span className="text-xs text-slate-500">{dateLabel(lease.security_deposit_date)}</span></td><td className="py-3 pr-4"><Badge tone={lease.status === 'ACTIVE' ? 'green' : 'slate'}>{lease.status}</Badge></td><td>{canEdit && <RowActions onEdit={() => setEditing(lease)} onDelete={() => safeDelete('leases', lease.id, reload)} />}</td></tr>)}</Table>
  </Section>;
}

export function RentRatesPage({ data, profile, reload }: PageProps) {
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const canEdit = isAdmin(profile);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try { await upsertRow('lease_rent_rates', { id: editing?.id, lease_id: String(form.get('lease_id')), rent_amount: Number(form.get('rent_amount')), effective_from: String(form.get('effective_from')), effective_to: String(form.get('effective_to')), increase_amount: Number(form.get('increase_amount') || 0), notes: String(form.get('notes') || '') || null }); setEditing(null); await reload(); }
    catch (error) { alert(error instanceof Error ? error.message : 'Save failed'); }
  };
  return <Section title="Rent Rates" action={canEdit && <Button disabled={!data.leases.length} onClick={() => setEditing({ effective_from: todayISO(), effective_to: monthEnd(todayISO()), increase_amount: 0 })}>Add Rent Rate</Button>}>
    {editing && <Card className="mb-5"><FormTitle title={editing.id ? 'Edit Rent Rate' : 'Add Rent Rate'} onCancel={() => setEditing(null)} /><form className="grid gap-4 md:grid-cols-3" onSubmit={save}>
      <Field label="Lease"><Select name="lease_id" required defaultValue={String(editing.lease_id ?? '')}><option value="">Select lease</option>{data.leases.map((lease) => <option key={lease.id} value={lease.id}>{fullLeaseLabel(data, lease)}</option>)}</Select></Field>
      <Field label="Rent amount"><Input name="rent_amount" type="number" step="0.01" required defaultValue={Number(editing.rent_amount ?? 0)} /></Field>
      <Field label="Increase amount"><Input name="increase_amount" type="number" step="0.01" defaultValue={Number(editing.increase_amount ?? 0)} /></Field>
      <Field label="Effective from"><Input name="effective_from" type="date" required defaultValue={String(editing.effective_from ?? todayISO())} /></Field>
      <Field label="Effective to"><Input name="effective_to" type="date" required defaultValue={String(editing.effective_to ?? monthEnd(todayISO()))} /></Field>
      <Field label="Notes"><Input name="notes" defaultValue={String(editing.notes ?? '')} /></Field><Button>Save Rate</Button>
    </form></Card>}
    <Table headers={['Lease', 'Rent', 'Valid From', 'Valid To', 'Increase', 'Notes', 'Actions']} empty="No rent rates yet.">{data.rentRates.map((rate) => <tr key={rate.id}><td className="py-3 pr-4 font-semibold">{fullLeaseLabel(data, data.leases.find((l) => l.id === rate.lease_id) ?? data.leases[0])}</td><td className="py-3 pr-4">{money(rate.rent_amount)}</td><td className="py-3 pr-4">{dateLabel(rate.effective_from)}</td><td className="py-3 pr-4">{dateLabel(rate.effective_to)}</td><td className="py-3 pr-4">{money(rate.increase_amount ?? 0)}</td><td className="py-3 pr-4">{rate.notes ?? '-'}</td><td>{canEdit && <RowActions onEdit={() => setEditing(rate)} onDelete={() => safeDelete('lease_rent_rates', rate.id, reload)} />}</td></tr>)}</Table>
  </Section>;
}

export function ChargesPage({ data, profile, reload }: PageProps) {
  const [editing, setEditing] = useState<Partial<Charge> | null>(null);
  const [month, setMonth] = useState(currentMonthISO());
  const canEdit = isAdmin(profile);
  const filtered = data.charges.filter((charge) => monthStart(charge.billing_month) === monthStart(month));
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const amount = Number(form.get('amount'));
    const due = String(form.get('due_date'));
    const status = editing?.status ?? (due < todayISO() ? 'OVERDUE' : 'PENDING');
    try { await upsertRow('charges', { id: editing?.id, lease_id: String(form.get('lease_id')), charge_type: String(form.get('charge_type')) as ChargeType, billing_month: String(form.get('billing_month')), period_start: String(form.get('period_start')), period_end: String(form.get('period_end')), valid_until: String(form.get('period_end')), due_date: due, description: String(form.get('description') || '') || null, amount, paid_amount: editing?.paid_amount ?? 0, balance_amount: amount - Number(editing?.paid_amount ?? 0), status }); setEditing(null); await reload(); }
    catch (error) { alert(error instanceof Error ? error.message : 'Save failed'); }
  };
  return <Section title="Charges" action={canEdit && <Button disabled={!data.leases.length} onClick={() => setEditing({ charge_type: 'ELECTRICITY', billing_month: month, period_start: month, period_end: monthEnd(month), due_date: monthEnd(month), amount: 0, paid_amount: 0 })}>Add Electricity / Other Bill</Button>}>
    <div className="mb-4 max-w-xs"><Field label="Filter month"><Input type="month" value={toMonthInputValue(month)} onChange={(e) => setMonth(fromMonthInputValue(e.target.value))} /></Field></div>
    {editing && <Card className="mb-5"><FormTitle title={editing.id ? 'Edit Charge' : 'Add Charge'} onCancel={() => setEditing(null)} /><form className="grid gap-4 md:grid-cols-3" onSubmit={save}>
      <Field label="Lease"><Select name="lease_id" required defaultValue={editing.lease_id ?? ''}><option value="">Select lease</option>{data.leases.map((lease) => <option key={lease.id} value={lease.id}>{fullLeaseLabel(data, lease)}</option>)}</Select></Field>
      <Field label="Charge type"><Select name="charge_type" required defaultValue={editing.charge_type ?? 'ELECTRICITY'}><option value="ELECTRICITY">ELECTRICITY</option><option value="OTHER">OTHER</option><option value="RENT">RENT</option></Select></Field>
      <Field label="Amount"><Input name="amount" type="number" step="0.01" required defaultValue={editing.amount ?? 0} /></Field>
      <Field label="Billing month"><Input name="billing_month" type="date" required defaultValue={editing.billing_month ?? month} /></Field>
      <Field label="Period start"><Input name="period_start" type="date" required defaultValue={editing.period_start ?? month} /></Field>
      <Field label="Period end"><Input name="period_end" type="date" required defaultValue={editing.period_end ?? monthEnd(month)} /></Field>
      <Field label="Due date"><Input name="due_date" type="date" required defaultValue={editing.due_date ?? monthEnd(month)} /></Field>
      <div className="md:col-span-2"><Field label="Description"><Input name="description" defaultValue={editing.description ?? ''} placeholder="Electricity bill / Other bill details" /></Field></div><Button>Save Charge</Button>
    </form></Card>}
    <Table headers={['Tenant / Unit', 'Type', 'Month', 'Amount', 'Paid', 'Balance', 'Status', 'Actions']} empty="No charges for this month.">{filtered.map((charge) => <tr key={charge.id}><td className="py-3 pr-4 font-semibold">{fullLeaseLabel(data, data.leases.find((l) => l.id === charge.lease_id) ?? data.leases[0])}</td><td className="py-3 pr-4">{charge.charge_type}</td><td className="py-3 pr-4">{monthLabel(charge.billing_month)}</td><td className="py-3 pr-4">{money(charge.amount)}</td><td className="py-3 pr-4">{money(charge.paid_amount)}</td><td className="py-3 pr-4 font-semibold">{money(charge.balance_amount)}</td><td className="py-3 pr-4"><Badge tone={statusTone(charge.status)}>{charge.status}</Badge></td><td>{canEdit && <RowActions onEdit={() => setEditing(charge)} onDelete={() => safeDelete('charges', charge.id, reload)} />}</td></tr>)}</Table>
  </Section>;
}

export function PaymentsPage({ data, profile, reload }: PageProps) {
  const [showForm, setShowForm] = useState(false);
  const canEdit = isAdmin(profile);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try { await recordPaymentAuto({ leaseId: String(form.get('lease_id')), paymentDate: String(form.get('payment_date')), amount: Number(form.get('amount')), paymentMethod: String(form.get('payment_method')), paymentReference: String(form.get('payment_reference') || '') || null, notes: String(form.get('notes') || '') || null, preferredChargeId: String(form.get('preferred_charge_id') || '') || null }); setShowForm(false); await reload(); }
    catch (error) { alert(error instanceof Error ? error.message : 'Save failed'); }
  };
  return <Section title="Payments" action={canEdit && <Button disabled={!data.leases.length} onClick={() => setShowForm(true)}>Record Payment</Button>}>
    {showForm && <Card className="mb-5"><FormTitle title="Record Payment" onCancel={() => setShowForm(false)} /><form className="grid gap-4 md:grid-cols-3" onSubmit={save}>
      <Field label="Lease"><Select name="lease_id" required><option value="">Select lease</option>{data.leases.map((lease) => <option key={lease.id} value={lease.id}>{fullLeaseLabel(data, lease)}</option>)}</Select></Field>
      <Field label="Payment date"><Input name="payment_date" type="date" required defaultValue={todayISO()} /></Field>
      <Field label="Amount"><Input name="amount" type="number" step="0.01" required /></Field>
      <Field label="Payment method"><Select name="payment_method" defaultValue="CASH">{paymentMethodOptions.map((m) => <option key={m}>{m}</option>)}</Select></Field>
      <Field label="Reference"><Input name="payment_reference" placeholder="Receipt / bank ref" /></Field>
      <Field label="Apply first to charge"><Select name="preferred_charge_id"><option value="">Auto oldest first</option>{data.charges.filter((c) => c.balance_amount > 0 && c.status !== 'VOIDED').map((c) => <option key={c.id} value={c.id}>{monthLabel(c.billing_month)} — {c.charge_type} — {money(c.balance_amount)}</option>)}</Select></Field>
      <div className="md:col-span-3"><Field label="Notes"><Textarea name="notes" /></Field></div><Button>Save & Auto Allocate</Button>
    </form></Card>}
    <Table headers={['Date', 'Tenant / Unit', 'Amount', 'Method', 'Reference', 'Status', 'Actions']} empty="No payments yet.">{data.payments.map((payment: Payment) => <tr key={payment.id}><td className="py-3 pr-4">{dateLabel(payment.payment_date)}</td><td className="py-3 pr-4 font-semibold">{fullLeaseLabel(data, data.leases.find((l) => l.id === payment.lease_id) ?? data.leases[0])}</td><td className="py-3 pr-4">{money(payment.amount)}</td><td className="py-3 pr-4">{payment.payment_method}</td><td className="py-3 pr-4">{payment.payment_reference ?? '-'}</td><td className="py-3 pr-4"><Badge tone={statusTone(payment.status)}>{payment.status}</Badge></td><td>{canEdit && payment.status === 'ACTIVE' && <Button variant="danger" onClick={() => confirm('Void this payment and reverse its allocations?') && voidPayment(payment.id).then(reload).catch((e) => alert(e.message))}>Void</Button>}</td></tr>)}</Table>
  </Section>;
}

export function ExpensesPage({ data, profile, reload }: PageProps) {
  const [editing, setEditing] = useState<Partial<OwnerExpense> | null>(null); const canEdit = isAdmin(profile);
  const save = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await upsertRow('owner_expenses', { id: editing?.id, property_id: String(form.get('property_id')), unit_id: String(form.get('unit_id') || '') || null, expense_date: String(form.get('expense_date')), billing_month: monthStart(String(form.get('billing_month'))), category: String(form.get('category')), description: String(form.get('description')), amount: Number(form.get('amount')), payment_method: String(form.get('payment_method')), notes: String(form.get('notes') || '') || null, status: editing?.status ?? 'ACTIVE' }); setEditing(null); await reload(); } catch (error) { alert(error instanceof Error ? error.message : 'Save failed'); } };
  const voidExpense = async (expense: OwnerExpense) => { if (!confirm('Void this expense?')) return; try { await upsertRow('owner_expenses', { ...expense, status: 'VOIDED' }); await reload(); } catch (error) { alert(error instanceof Error ? error.message : 'Void failed'); } };
  return <Section title="Owner Expenses" action={canEdit && <Button disabled={!data.properties.length} onClick={() => setEditing({ expense_date: todayISO(), billing_month: currentMonthISO(), category: 'REPAIR', payment_method: 'CASH', status: 'ACTIVE' })}>Add Expense</Button>}>
    {editing && <Card className="mb-5"><FormTitle title={editing.id ? 'Edit Expense' : 'Add Expense'} onCancel={() => setEditing(null)} /><form className="grid gap-4 md:grid-cols-3" onSubmit={save}>
      <Field label="Property"><Select name="property_id" required defaultValue={editing.property_id ?? ''}><option value="">Select property</option>{data.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
      <Field label="Unit optional"><Select name="unit_id" defaultValue={editing.unit_id ?? ''}><option value="">Property-level expense</option>{data.units.map((u) => <option key={u.id} value={u.id}>{u.unit_name}</option>)}</Select></Field>
      <Field label="Category"><Select name="category" defaultValue={editing.category ?? 'REPAIR'}>{['REPAIR','MAINTENANCE','ELECTRICITY_PROVIDER','CLEANING','SECURITY','TAX','OTHER'].map((c) => <option key={c}>{c}</option>)}</Select></Field>
      <Field label="Expense date"><Input name="expense_date" type="date" required defaultValue={editing.expense_date ?? todayISO()} /></Field>
      <Field label="Billing month"><Input name="billing_month" type="month" required defaultValue={toMonthInputValue(editing.billing_month ?? currentMonthISO())} /></Field>
      <Field label="Amount"><Input name="amount" type="number" step="0.01" required defaultValue={editing.amount ?? 0} /></Field>
      <Field label="Payment method"><Select name="payment_method" defaultValue={editing.payment_method ?? 'CASH'}>{paymentMethodOptions.map((m) => <option key={m}>{m}</option>)}</Select></Field>
      <div className="md:col-span-2"><Field label="Description"><Input name="description" required defaultValue={editing.description ?? ''} /></Field></div>
      <div className="md:col-span-3"><Field label="Notes"><Textarea name="notes" defaultValue={editing.notes ?? ''} /></Field></div><Button>Save Expense</Button>
    </form></Card>}
    <Table headers={['Date', 'Property / Unit', 'Category', 'Description', 'Amount', 'Status', 'Actions']} empty="No owner expenses yet.">{data.expenses.map((expense) => <tr key={expense.id}><td className="py-3 pr-4">{dateLabel(expense.expense_date)}</td><td className="py-3 pr-4">{data.properties.find((p) => p.id === expense.property_id)?.name ?? '-'} / {data.units.find((u) => u.id === expense.unit_id)?.unit_name ?? 'All units'}</td><td className="py-3 pr-4">{expense.category}</td><td className="py-3 pr-4 font-semibold">{expense.description}</td><td className="py-3 pr-4">{money(expense.amount)}</td><td className="py-3 pr-4"><Badge tone={statusTone(expense.status)}>{expense.status}</Badge></td><td>{canEdit && expense.status === 'ACTIVE' && <div className="flex gap-2"><Button variant="secondary" onClick={() => setEditing(expense)}>Edit</Button><Button variant="danger" onClick={() => voidExpense(expense)}>Void</Button></div>}</td></tr>)}</Table>
  </Section>;
}

export function ReportsPage({ data }: PageProps) {
  const [month, setMonth] = useState(currentMonthISO());
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [start, setStart] = useState(`${new Date().getFullYear()}-01-01`);
  const [end, setEnd] = useState(todayISO());
  const monthly = getDashboardSummary(data, month);
  const yearly = getCashFlowSummary(data, `${year}-01-01`, `${year}-12-31`);
  const custom = getCashFlowSummary(data, start, end);
  return <div className="space-y-6">
    <ReportCard title="Monthly Billing Report" subtitle="Uses billing month and generated charges." controls={<Field label="Month"><Input type="month" value={toMonthInputValue(month)} onChange={(e) => setMonth(fromMonthInputValue(e.target.value))} /></Field>} summary={monthly} />
    <ReportCard title="Yearly Cash Flow Report" subtitle="Uses actual payment and expense dates." controls={<Field label="Year"><Input value={year} onChange={(e) => setYear(e.target.value)} /></Field>} summary={yearly} />
    <ReportCard title="Custom Date Cash Flow Report" subtitle="Uses actual payment and expense dates." controls={<div className="grid gap-3 sm:grid-cols-2"><Field label="Start date"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field><Field label="End date"><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field></div>} summary={custom} />
  </div>;
}

export function AuditLogsPage({ data }: PageProps) {
  return <Section title="Audit Logs"><Table headers={['Date', 'User', 'Action', 'Table', 'Record', 'Change']} empty="No audit logs yet.">{data.auditLogs.map((log) => <tr key={log.id}><td className="py-3 pr-4">{new Date(log.created_at).toLocaleString()}</td><td className="py-3 pr-4">{data.profiles.find((p) => p.id === log.user_id)?.full_name ?? '-'}</td><td className="py-3 pr-4 font-semibold">{log.action}</td><td className="py-3 pr-4">{log.table_name}</td><td className="py-3 pr-4 text-xs">{log.record_id ?? '-'}</td><td className="py-3 pr-4 max-w-md truncate text-xs text-slate-500">{JSON.stringify(log.new_values ?? log.old_values ?? {})}</td></tr>)}</Table></Section>;
}

export function UsersPage({ data, profile, reload }: PageProps) {
  const canEdit = isAdmin(profile);
  const updateRole = async (user: Profile, role: string) => { try { await upsertRow('profiles', { ...user, role }); await reload(); } catch (error) { alert(error instanceof Error ? error.message : 'Update failed'); } };
  return <Section title="Users and Roles"><p className="mb-4 text-sm text-slate-500">New users start as viewers. Admin can promote Suraj to admin and keep Simanchal as viewer after both sign up.</p><Table headers={['Name', 'Email', 'Phone', 'Role', 'Actions']} empty="No users yet.">{data.profiles.map((user) => <tr key={user.id}><td className="py-3 pr-4 font-semibold">{user.full_name ?? '-'}</td><td className="py-3 pr-4">{user.email ?? '-'}</td><td className="py-3 pr-4">{user.phone ?? '-'}</td><td className="py-3 pr-4"><Badge tone={user.role === 'admin' ? 'green' : 'blue'}>{user.role}</Badge></td><td>{canEdit && user.id !== profile?.id && <div className="flex gap-2"><Button variant="secondary" onClick={() => updateRole(user, 'admin')}>Make Admin</Button><Button variant="secondary" onClick={() => updateRole(user, 'viewer')}>Make Viewer</Button></div>}</td></tr>)}</Table></Section>;
}

const paymentMethodOptions: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CARD', 'CHEQUE', 'OTHER'];

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <div className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-2xl font-bold text-slate-950">{title}</h2>{action}</div>{children}</div>;
}

function FormTitle({ title, onCancel }: { title: string; onCancel: () => void }) {
  return <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">{title}</h3><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button></div>;
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="flex gap-2"><Button variant="secondary" onClick={onEdit}>Edit</Button><Button variant="danger" onClick={onDelete}>Delete</Button></div>;
}

function Table({ headers, children, empty }: { headers: string[]; children: React.ReactNode; empty: string }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  if (!hasRows) return <EmptyState title={empty} />;
  return <Card><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500">{headers.map((h) => <th key={h} className="py-3 pr-4">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{children}</tbody></table></div></Card>;
}

function ReportCard({ title, subtitle, controls, summary }: { title: string; subtitle: string; controls: React.ReactNode; summary: ReturnType<typeof getDashboardSummary> }) {
  const items = [
    ['Rent collected', summary.rentCollected], ['Electricity collected', summary.electricityCollected], ['Other collected', summary.otherCollected], ['Total collected', summary.totalCollected], ['Owner expenses', summary.ownerExpenses], ['Net profit', summary.netProfit], ['Rent billed', summary.rentBilled], ['Total arrears', summary.totalArrears],
  ];
  return <Card><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="text-lg font-bold">{title}</h3><p className="text-sm text-slate-500">{subtitle}</p></div><div>{controls}</div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{items.map(([label, value]) => <div key={label as string} className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-1 text-xl font-bold">{money(Number(value))}</p></div>)}</div></Card>;
}
