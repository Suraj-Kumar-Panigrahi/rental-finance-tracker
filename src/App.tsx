import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { fetchAppData } from './lib/data';
import type { AppData, Profile } from './types';
import { AuthGate } from './components/AuthGate';
import { Layout, type Page } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { AuditLogsPage, ChargesPage, ExpensesPage, LeasesPage, PaymentsPage, PropertiesPage, RentRatesPage, ReportsPage, TenantsPage, UsersPage } from './pages/ManagementPages';
import { Card } from './components/ui';

const emptyData: AppData = {
  profiles: [], tenants: [], properties: [], units: [], leases: [], rentRates: [], charges: [], payments: [], allocations: [], expenses: [], auditLogs: [],
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [data, setData] = useState<AppData>(emptyData);
  const [page, setPage] = useState<Page>('Dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  const reload = async () => {
    if (!session?.user) return;
    setError('');
    const nextData = await fetchAppData();
    setData(nextData);
    setProfile(nextData.profiles.find((item) => item.id === session.user.id) ?? null);
  };

  useEffect(() => {
    let active = true;
    async function load() {
      if (!session) { setLoading(false); return; }
      setLoading(true);
      try {
        const nextData = await fetchAppData();
        if (!active) return;
        setData(nextData);
        setProfile(nextData.profiles.find((item) => item.id === session.user.id) ?? null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [session]);

  return (
    <AuthGate session={session}>
      <Layout profile={profile} page={page} setPage={setPage}>
        {loading ? <Card>Loading data...</Card> : error ? <Card><p className="font-semibold text-red-700">{error}</p><p className="mt-2 text-sm text-slate-500">Check Supabase environment variables, schema.sql execution, and RLS role setup.</p></Card> : renderPage(page, data, profile, reload, setPage)}
      </Layout>
    </AuthGate>
  );
}

function renderPage(page: Page, data: AppData, profile: Profile | null, reload: () => Promise<void>, setPage: (page: Page) => void) {
  const props = { data, profile, reload };
  switch (page) {
    case 'Dashboard': return <DashboardPage data={data} profile={profile} reload={reload} setPage={(next) => setPage(next as Page)} />;
    case 'Tenants': return <TenantsPage {...props} />;
    case 'Properties': return <PropertiesPage {...props} />;
    case 'Leases': return <LeasesPage {...props} />;
    case 'Charges': return <ChargesPage {...props} />;
    case 'Payments': return <PaymentsPage {...props} />;
    case 'Expenses': return <ExpensesPage {...props} />;
    case 'Reports': return <ReportsPage {...props} />;
    case 'Rent Rates': return <RentRatesPage {...props} />;
    case 'Audit Logs': return <AuditLogsPage {...props} />;
    case 'Users': return <UsersPage {...props} />;
    default: return null;
  }
}
