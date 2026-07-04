import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Button, Card, Field, Input } from './ui';

export function AuthGate({ session, children }: { session: Session | null; children: React.ReactNode }) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [loginType, setLoginType] = useState<'email' | 'phone'>('email');
  const [identifier, setIdentifier] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  if (session) return <>{children}</>;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword(
          loginType === 'email' ? { email: identifier, password } : { phone: identifier, password },
        );
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp(
          loginType === 'email'
            ? { email: identifier, password, options: { data: { full_name: fullName } } }
            : { phone: identifier, password, options: { data: { full_name: fullName, phone: identifier } } },
        );
        if (error) throw error;
        setMessage('Account created. If email confirmation is enabled, check your inbox before signing in.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <Card className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Rental Finance Tracker</h1>
          <p className="mt-2 text-sm text-slate-600">Track rent, electricity reimbursements, payments, arrears, expenses, and profit.</p>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button className={`rounded-lg py-2 text-sm font-semibold ${mode === 'sign-in' ? 'bg-white shadow-sm' : ''}`} onClick={() => setMode('sign-in')}>Sign in</button>
          <button className={`rounded-lg py-2 text-sm font-semibold ${mode === 'sign-up' ? 'bg-white shadow-sm' : ''}`} onClick={() => setMode('sign-up')}>Sign up</button>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          {mode === 'sign-up' && (
            <Field label="Full name">
              <Input required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Suraj" />
            </Field>
          )}
          <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
            <button type="button" className={`flex-1 rounded-lg py-2 text-sm font-semibold ${loginType === 'email' ? 'bg-white shadow-sm' : ''}`} onClick={() => setLoginType('email')}>Email</button>
            <button type="button" className={`flex-1 rounded-lg py-2 text-sm font-semibold ${loginType === 'phone' ? 'bg-white shadow-sm' : ''}`} onClick={() => setLoginType('phone')}>Phone</button>
          </div>
          <Field label={loginType === 'email' ? 'Email address' : 'Phone number'}>
            <Input required type={loginType === 'email' ? 'email' : 'tel'} value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={loginType === 'email' ? 'you@example.com' : '+919999999999'} />
          </Field>
          <Field label="Password">
            <Input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} />
          </Field>
          {message && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{message}</p>}
          <Button disabled={loading} className="w-full">{loading ? 'Please wait...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}</Button>
        </form>
        <p className="mt-4 text-xs text-slate-500">Phone login requires phone auth/SMS setup in Supabase. Email login works with the normal free Auth setup.</p>
      </Card>
    </main>
  );
}
