import type { Profile } from '../types';
import { Button, Badge } from './ui';
import { supabase } from '../lib/supabase';

const pages = ['Dashboard', 'Tenants', 'Properties', 'Leases', 'Charges', 'Payments', 'Expenses', 'Reports', 'Rent Rates', 'Audit Logs', 'Users'] as const;
export type Page = (typeof pages)[number];

export function Layout({ profile, page, setPage, children }: { profile: Profile | null; page: Page; setPage: (page: Page) => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-950">Rental Finance Tracker</h1>
            <p className="text-sm text-slate-500">Monthly rent, electricity reimbursements, expenses, and profitability.</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={profile?.role === 'admin' ? 'green' : 'blue'}>{profile?.role?.toUpperCase() ?? 'USER'}</Badge>
            <span className="text-sm font-medium text-slate-700">{profile?.full_name ?? profile?.email ?? 'User'}</span>
            <Button variant="secondary" onClick={() => void supabase.auth.signOut()}>Sign out</Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-4">
          {pages.map((item) => (
            <button key={item} onClick={() => setPage(item)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${page === item ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
              {item}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
