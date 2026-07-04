import { useMemo, useState } from 'react';
import type { AppData, Profile } from '../types';
import { generateMonthlyRent } from '../lib/data';
import { getDashboardSummary, getMonthDashboardRows, monthEnd } from '../lib/domain';
import { currentMonthISO, fromMonthInputValue, money, monthLabel, toMonthInputValue } from '../lib/format';
import { Badge, Button, Card, EmptyState, Field, Input } from '../components/ui';

export function DashboardPage({ data, profile, reload, setPage }: { data: AppData; profile: Profile | null; reload: () => Promise<void>; setPage: (page: string) => void }) {
  const [month, setMonth] = useState(currentMonthISO());
  const [busy, setBusy] = useState(false);
  const isAdmin = profile?.role === 'admin';
  const summary = useMemo(() => getDashboardSummary(data, month), [data, month]);
  const rows = useMemo(() => getMonthDashboardRows(data, month), [data, month]);
  const existingRentCharges = data.charges.filter((charge) => charge.charge_type === 'RENT' && charge.billing_month === month && charge.status !== 'VOIDED').length;
  const activeLeaseCount = data.leases.filter((lease) => lease.status === 'ACTIVE').length;
  const arrearsTextClass = (amount: number) => (
    amount > 0 ? 'text-red-700' : 'text-slate-950'
  );

  const arrearsStrongTextClass = (amount: number) => (
    amount > 0 ? 'text-red-900' : 'text-slate-950'
  );

  const arrearsPanelClass = (amount: number) => (
    amount > 0
      ? 'border-red-100 bg-red-50'
      : 'border-emerald-100 bg-emerald-50'
  );

  const arrearsPanelLabelClass = (amount: number) => (
    amount > 0 ? 'text-red-700' : 'text-emerald-700'
  );

  const arrearsPanelValueClass = (amount: number) => (
    amount > 0 ? 'text-red-900' : 'text-emerald-900'
  );

  const arrearsPanelHelpClass = (amount: number) => (
    amount > 0 ? 'text-red-700' : 'text-emerald-700'
  );

  const generate = async () => {
    setBusy(true);
    try {
      const count = await generateMonthlyRent(month);
      alert(`${count} rent record(s) generated for ${monthLabel(month)}.`);
      await reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to generate rent');
    } finally {
      setBusy(false);
    }
  };

  const cards = [
    ['Rent billed', summary.rentBilled],
    ['Rent collected', summary.rentCollected],
    ['Electricity billed', summary.electricityBilled],
    ['Electricity collected', summary.electricityCollected],
    ['Previous arrears', summary.previousArrears],
    ['Current month balance', summary.currentMonthBalance],
    ['Total outstanding', summary.totalArrears],
    ['Owner expenses', summary.ownerExpenses],
    ['Net profit', summary.netProfit],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Monthly Dashboard</h2>
          <p className="text-sm text-slate-500">Selected month runs from {monthLabel(month)} 1 to {monthEnd(month).slice(-2)}.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Month">
            <Input type="month" value={toMonthInputValue(month)} onChange={(event) => setMonth(fromMonthInputValue(event.target.value))} />
          </Field>
          {isAdmin && (
            <Button onClick={generate} disabled={busy || activeLeaseCount === 0}>{busy ? 'Generating...' : 'Generate Monthly Rent'}</Button>
          )}
        </div>
      </div>

      {isAdmin && existingRentCharges < activeLeaseCount && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-amber-900">Rent records may be missing</h3>
              <p className="text-sm text-amber-800">{existingRentCharges} of {activeLeaseCount} active lease rent records exist for this month. Generate missing records when you are ready.</p>
            </div>
            <Button onClick={generate} disabled={busy} variant="secondary">Generate Missing Rent</Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <Card key={label as string}>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p
              className={`mt-2 text-2xl font-bold ${label === 'Net profit' && Number(value) < 0
                ? 'text-red-600'
                : (label === 'Total outstanding' || label === 'Previous arrears') && Number(value) > 0
                  ? 'text-red-700'
                  : 'text-slate-950'
                }`}
            >
              {money(Number(value))}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className={`rounded-xl border p-4 ${arrearsPanelClass(summary.previousArrears)}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${arrearsPanelLabelClass(summary.previousArrears)}`}>
            Previous arrears
          </p>
          <p className={`mt-1 text-2xl font-bold ${arrearsPanelValueClass(summary.previousArrears)}`}>
            {money(summary.previousArrears)}
          </p>
          <p className={`mt-1 text-xs ${arrearsPanelHelpClass(summary.previousArrears)}`}>
            Rent {money(summary.previousRentArrears)} · Electricity {money(summary.previousElectricityArrears)} · Other {money(summary.previousOtherArrears)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected month balance</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{money(summary.currentMonthBalance)}</p>
          <p className="mt-1 text-xs text-slate-500">Unpaid balance for {monthLabel(month)} only.</p>
        </div>
        <div className={`rounded-xl border bg-white p-4 ${summary.totalArrears > 0 ? 'border-red-200' : 'border-emerald-200'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${summary.totalArrears > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
            Total outstanding
          </p>
          <p className={`mt-1 text-2xl font-bold ${summary.totalArrears > 0 ? 'text-red-900' : 'text-emerald-900'}`}>
            {money(summary.totalArrears)}
          </p>
          <p className={`mt-1 text-xs ${summary.totalArrears > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
            Previous arrears plus selected month balance.
          </p>
        </div>
      </div>

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold">Tenant Monthly Status</h3>
            <p className="text-sm text-slate-500">Rent is generated from rent rates. Electricity and other bills are manually added.</p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setPage('Charges')}>Add Electricity / Other Bill</Button>
              <Button variant="secondary" onClick={() => setPage('Payments')}>Record Payment</Button>
              <Button variant="secondary" onClick={() => setPage('Expenses')}>Add Owner Expense</Button>
            </div>
          )}
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No active leases for this month">Create tenants, properties, units, leases, and rent rates first.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-3 pr-4">Tenant</th>
                  <th className="py-3 pr-4">Property / Unit</th>
                  <th className="py-3 pr-4 text-right">Rent</th>
                  <th className="py-3 pr-4 text-right">Electricity</th>
                  <th className="py-3 pr-4 text-right">Other</th>
                  <th className="py-3 pr-4 text-right">Paid</th>
                  <th className="py-3 pr-4 text-right">Month Balance</th>
                  <th className="py-3 pr-4 text-right">Previous Arrears</th>
                  <th className="py-3 pr-4 text-right">Total Due</th>
                  <th className="py-3 pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.leaseId}>
                    <td className="py-3 pr-4 font-semibold">{row.tenantName}</td>
                    <td className="py-3 pr-4 text-slate-600">{row.propertyName} / {row.unitName}</td>
                    <td className="py-3 pr-4 text-right">{money(row.rentBilled)}</td>
                    <td className="py-3 pr-4 text-right">{money(row.electricityBilled)}</td>
                    <td className="py-3 pr-4 text-right">{money(row.otherBilled)}</td>
                    <td className="py-3 pr-4 text-right">{money(row.paid)}</td>
                    <td className="py-3 pr-4 text-right font-semibold">{money(row.balance)}</td>
                    <td className="py-3 pr-4 text-right">
                      <div className={`font-semibold ${arrearsTextClass(row.previousArrears)}`}>
                        {money(row.previousArrears)}
                      </div>
                      <div className="text-xs text-slate-500">
                        R {money(row.previousRentArrears)} · E {money(row.previousElectricityArrears)}
                      </div>
                    </td>
                    <td className={`py-3 pr-4 text-right font-bold ${arrearsStrongTextClass(row.totalOutstanding)}`}>
                      {money(row.totalOutstanding)}
                    </td>
                    {/* <td className="py-3 pr-4 text-right font-bold text-red-800">{money(row.totalOutstanding)}</td> */}
                    <td className="py-3 pr-4"><Badge tone={row.status === 'Paid' ? 'green' : row.status === 'Partial' ? 'yellow' : 'red'}>{row.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
