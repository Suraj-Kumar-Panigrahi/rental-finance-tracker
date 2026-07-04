-- Rental Finance Tracker Supabase schema
-- Run this in Supabase SQL Editor once after creating a free project.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_name text not null,
  status text not null default 'VACANT' check (status in ('VACANT', 'OCCUPIED', 'MAINTENANCE')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id, unit_name)
);

create table if not exists public.leases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  start_date date not null,
  end_date date,
  due_day integer not null default 5 check (due_day between 1 and 31),
  advance_amount numeric(14,2) not null default 0 check (advance_amount >= 0),
  advance_date date,
  security_deposit_amount numeric(14,2) not null default 0 check (security_deposit_amount >= 0),
  security_deposit_date date,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'ENDED')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lease_dates_valid check (end_date is null or end_date >= start_date)
);

create table if not exists public.lease_rent_rates (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id) on delete cascade,
  rent_amount numeric(14,2) not null check (rent_amount >= 0),
  effective_from date not null,
  effective_to date not null,
  increase_amount numeric(14,2) default 0 check (increase_amount >= 0),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rent_rate_dates_valid check (effective_to >= effective_from)
);

create table if not exists public.charges (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id) on delete restrict,
  charge_type text not null check (charge_type in ('RENT', 'ELECTRICITY', 'OTHER')),
  billing_month date not null,
  period_start date not null,
  period_end date not null,
  valid_until date not null,
  due_date date not null,
  description text,
  amount numeric(14,2) not null check (amount >= 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  balance_amount numeric(14,2) not null check (balance_amount >= 0),
  status text not null default 'PENDING' check (status in ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'VOIDED')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint charge_period_valid check (period_end >= period_start),
  constraint paid_not_more_than_amount check (paid_amount <= amount),
  constraint balance_math check (balance_amount = amount - paid_amount)
);

create unique index if not exists unique_monthly_rent_charge
  on public.charges(lease_id, charge_type, billing_month)
  where charge_type = 'RENT' and status <> 'VOIDED';

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id) on delete restrict,
  payment_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null default 'CASH' check (payment_method in ('CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CARD', 'CHEQUE', 'OTHER')),
  payment_reference text,
  notes text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'VOIDED', 'REVERSED')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  charge_id uuid not null references public.charges(id) on delete restrict,
  allocated_amount numeric(14,2) not null check (allocated_amount > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.owner_expenses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_id uuid references public.units(id) on delete set null,
  expense_date date not null,
  billing_month date not null,
  category text not null default 'OTHER' check (category in ('REPAIR', 'MAINTENANCE', 'ELECTRICITY_PROVIDER', 'CLEANING', 'SECURITY', 'TAX', 'OTHER')),
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  payment_method text not null default 'CASH' check (payment_method in ('CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CARD', 'CHEQUE', 'OTHER')),
  notes text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'VOIDED')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  table_name text not null,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_charges_month on public.charges(billing_month);
create index if not exists idx_charges_lease on public.charges(lease_id);
create index if not exists idx_payments_date on public.payments(payment_date);
create index if not exists idx_expenses_date on public.owner_expenses(expense_date);
create index if not exists idx_rent_rates_lease_dates on public.lease_rent_rates(lease_id, effective_from, effective_to);

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'viewer');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin';
$$;

create or replace function public.is_authenticated()
returns boolean
language sql
stable
as $$
  select auth.uid() is not null;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    new.phone,
    'viewer'
  )
  on conflict (id) do update
  set email = excluded.email,
      phone = excluded.phone,
      full_name = coalesce(public.profiles.full_name, excluded.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.audit_record_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec_id uuid;
begin
  if tg_op = 'INSERT' then
    rec_id := new.id;
    insert into public.audit_logs(user_id, action, table_name, record_id, old_values, new_values)
    values(auth.uid(), 'CREATE', tg_table_name, rec_id, null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    rec_id := new.id;
    insert into public.audit_logs(user_id, action, table_name, record_id, old_values, new_values)
    values(auth.uid(), 'UPDATE', tg_table_name, rec_id, to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    rec_id := old.id;
    insert into public.audit_logs(user_id, action, table_name, record_id, old_values, new_values)
    values(auth.uid(), 'DELETE', tg_table_name, rec_id, to_jsonb(old), null);
    return old;
  end if;
  return null;
end;
$$;

-- updated_at triggers
drop trigger if exists tenants_updated_at on public.tenants;
create trigger tenants_updated_at before update on public.tenants for each row execute procedure public.set_updated_at();
drop trigger if exists properties_updated_at on public.properties;
create trigger properties_updated_at before update on public.properties for each row execute procedure public.set_updated_at();
drop trigger if exists units_updated_at on public.units;
create trigger units_updated_at before update on public.units for each row execute procedure public.set_updated_at();
drop trigger if exists leases_updated_at on public.leases;
create trigger leases_updated_at before update on public.leases for each row execute procedure public.set_updated_at();
drop trigger if exists rent_rates_updated_at on public.lease_rent_rates;
create trigger rent_rates_updated_at before update on public.lease_rent_rates for each row execute procedure public.set_updated_at();
drop trigger if exists charges_updated_at on public.charges;
create trigger charges_updated_at before update on public.charges for each row execute procedure public.set_updated_at();
drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at before update on public.payments for each row execute procedure public.set_updated_at();
drop trigger if exists expenses_updated_at on public.owner_expenses;
create trigger expenses_updated_at before update on public.owner_expenses for each row execute procedure public.set_updated_at();

-- audit triggers
do $$
begin
  execute 'drop trigger if exists audit_tenants on public.tenants';
  execute 'create trigger audit_tenants after insert or update or delete on public.tenants for each row execute procedure public.audit_record_change()';
  execute 'drop trigger if exists audit_properties on public.properties';
  execute 'create trigger audit_properties after insert or update or delete on public.properties for each row execute procedure public.audit_record_change()';
  execute 'drop trigger if exists audit_units on public.units';
  execute 'create trigger audit_units after insert or update or delete on public.units for each row execute procedure public.audit_record_change()';
  execute 'drop trigger if exists audit_leases on public.leases';
  execute 'create trigger audit_leases after insert or update or delete on public.leases for each row execute procedure public.audit_record_change()';
  execute 'drop trigger if exists audit_rent_rates on public.lease_rent_rates';
  execute 'create trigger audit_rent_rates after insert or update or delete on public.lease_rent_rates for each row execute procedure public.audit_record_change()';
  execute 'drop trigger if exists audit_charges on public.charges';
  execute 'create trigger audit_charges after insert or update or delete on public.charges for each row execute procedure public.audit_record_change()';
  execute 'drop trigger if exists audit_payments on public.payments';
  execute 'create trigger audit_payments after insert or update or delete on public.payments for each row execute procedure public.audit_record_change()';
  execute 'drop trigger if exists audit_expenses on public.owner_expenses';
  execute 'create trigger audit_expenses after insert or update or delete on public.owner_expenses for each row execute procedure public.audit_record_change()';
end $$;

create or replace function public.generate_monthly_rent(p_month date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_period_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_count integer := 0;
  lease_record record;
  rate_record record;
  v_due_date date;
begin
  if not public.is_admin() then
    raise exception 'Only admin users can generate rent records';
  end if;

  for lease_record in
    select * from public.leases
    where status = 'ACTIVE'
      and start_date <= v_period_end
      and (end_date is null or end_date >= v_month)
  loop
    select * into rate_record
    from public.lease_rent_rates
    where lease_id = lease_record.id
      and effective_from <= v_month
      and effective_to >= v_month
    order by effective_from desc
    limit 1;

    if rate_record.id is null then
      continue;
    end if;

    v_due_date := make_date(extract(year from v_month)::int, extract(month from v_month)::int,
      least(lease_record.due_day, extract(day from v_period_end)::int));

    insert into public.charges (
      lease_id, charge_type, billing_month, period_start, period_end, valid_until, due_date,
      description, amount, paid_amount, balance_amount, status, created_by
    ) values (
      lease_record.id, 'RENT', v_month, v_month, v_period_end, v_period_end, v_due_date,
      'Monthly rent for ' || to_char(v_month, 'Mon YYYY'), rate_record.rent_amount, 0, rate_record.rent_amount,
      case when v_due_date < current_date then 'OVERDUE' else 'PENDING' end,
      auth.uid()
    )
    on conflict do nothing;

    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  insert into public.audit_logs(user_id, action, table_name, record_id, old_values, new_values)
  values(auth.uid(), 'GENERATE_MONTHLY_RENT', 'charges', null, null, jsonb_build_object('month', v_month, 'created_count', v_count));

  return v_count;
end;
$$;

create or replace function public.record_payment_auto(
  p_lease_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_payment_method text,
  p_payment_reference text default null,
  p_notes text default null,
  p_preferred_charge_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_remaining numeric(14,2) := p_amount;
  charge_record record;
  v_alloc numeric(14,2);
  v_new_paid numeric(14,2);
  v_new_balance numeric(14,2);
  v_new_status text;
begin
  if not public.is_admin() then
    raise exception 'Only admin users can record payments';
  end if;

  if p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  insert into public.payments(lease_id, payment_date, amount, payment_method, payment_reference, notes, status, created_by)
  values(p_lease_id, p_payment_date, p_amount, p_payment_method, p_payment_reference, p_notes, 'ACTIVE', auth.uid())
  returning id into v_payment_id;

  for charge_record in
    select * from public.charges
    where lease_id = p_lease_id
      and status <> 'VOIDED'
      and balance_amount > 0
    order by case when id = p_preferred_charge_id then 0 else 1 end, period_start asc, created_at asc
  loop
    exit when v_remaining <= 0;
    v_alloc := least(charge_record.balance_amount, v_remaining);

    insert into public.payment_allocations(payment_id, charge_id, allocated_amount)
    values(v_payment_id, charge_record.id, v_alloc);

    v_new_paid := charge_record.paid_amount + v_alloc;
    v_new_balance := charge_record.amount - v_new_paid;
    v_new_status := case
      when v_new_balance <= 0 then 'PAID'
      when v_new_paid > 0 then 'PARTIAL'
      when charge_record.due_date < current_date then 'OVERDUE'
      else 'PENDING'
    end;

    update public.charges
    set paid_amount = v_new_paid,
        balance_amount = v_new_balance,
        status = v_new_status
    where id = charge_record.id;

    v_remaining := v_remaining - v_alloc;
  end loop;

  insert into public.audit_logs(user_id, action, table_name, record_id, old_values, new_values)
  values(auth.uid(), 'RECORD_PAYMENT_AUTO_ALLOCATE', 'payments', v_payment_id, null, jsonb_build_object('amount', p_amount, 'unallocated_amount', v_remaining));

  return v_payment_id;
end;
$$;

create or replace function public.void_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  allocation_record record;
  charge_record record;
  v_new_paid numeric(14,2);
  v_new_balance numeric(14,2);
  v_new_status text;
begin
  if not public.is_admin() then
    raise exception 'Only admin users can void payments';
  end if;

  for allocation_record in select * from public.payment_allocations where payment_id = p_payment_id loop
    select * into charge_record from public.charges where id = allocation_record.charge_id for update;
    v_new_paid := greatest(charge_record.paid_amount - allocation_record.allocated_amount, 0);
    v_new_balance := charge_record.amount - v_new_paid;
    v_new_status := case
      when v_new_balance <= 0 then 'PAID'
      when v_new_paid > 0 then 'PARTIAL'
      when charge_record.due_date < current_date then 'OVERDUE'
      else 'PENDING'
    end;

    update public.charges
    set paid_amount = v_new_paid,
        balance_amount = v_new_balance,
        status = v_new_status
    where id = allocation_record.charge_id;
  end loop;

  update public.payments set status = 'VOIDED' where id = p_payment_id;
  delete from public.payment_allocations where payment_id = p_payment_id;

  insert into public.audit_logs(user_id, action, table_name, record_id, old_values, new_values)
  values(auth.uid(), 'VOID_PAYMENT', 'payments', p_payment_id, null, jsonb_build_object('status', 'VOIDED'));
end;
$$;

-- Row-level security
alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.leases enable row level security;
alter table public.lease_rent_rates enable row level security;
alter table public.charges enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.owner_expenses enable row level security;
alter table public.audit_logs enable row level security;

-- Drop existing policies safely
do $$
declare
  pol record;
begin
  for pol in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

create policy "authenticated can read profiles" on public.profiles for select using (public.is_authenticated());
create policy "admin can update profiles" on public.profiles for update using (public.is_admin()) with check (public.is_admin());
create policy "admin can insert profiles" on public.profiles for insert with check (public.is_admin());

create policy "authenticated can read tenants" on public.tenants for select using (public.is_authenticated());
create policy "admin can write tenants" on public.tenants for all using (public.is_admin()) with check (public.is_admin());

create policy "authenticated can read properties" on public.properties for select using (public.is_authenticated());
create policy "admin can write properties" on public.properties for all using (public.is_admin()) with check (public.is_admin());

create policy "authenticated can read units" on public.units for select using (public.is_authenticated());
create policy "admin can write units" on public.units for all using (public.is_admin()) with check (public.is_admin());

create policy "authenticated can read leases" on public.leases for select using (public.is_authenticated());
create policy "admin can write leases" on public.leases for all using (public.is_admin()) with check (public.is_admin());

create policy "authenticated can read rent rates" on public.lease_rent_rates for select using (public.is_authenticated());
create policy "admin can write rent rates" on public.lease_rent_rates for all using (public.is_admin()) with check (public.is_admin());

create policy "authenticated can read charges" on public.charges for select using (public.is_authenticated());
create policy "admin can write charges" on public.charges for all using (public.is_admin()) with check (public.is_admin());

create policy "authenticated can read payments" on public.payments for select using (public.is_authenticated());
create policy "admin can write payments" on public.payments for all using (public.is_admin()) with check (public.is_admin());

create policy "authenticated can read payment allocations" on public.payment_allocations for select using (public.is_authenticated());
create policy "admin can write payment allocations" on public.payment_allocations for all using (public.is_admin()) with check (public.is_admin());

create policy "authenticated can read expenses" on public.owner_expenses for select using (public.is_authenticated());
create policy "admin can write expenses" on public.owner_expenses for all using (public.is_admin()) with check (public.is_admin());

create policy "authenticated can read audit logs" on public.audit_logs for select using (public.is_authenticated());
create policy "admin can insert audit logs" on public.audit_logs for insert with check (public.is_admin());

-- Allow the browser client to call the transaction-safe functions.
grant execute on function public.generate_monthly_rent(date) to authenticated;
grant execute on function public.record_payment_auto(uuid, date, numeric, text, text, text, uuid) to authenticated;
grant execute on function public.void_payment(uuid) to authenticated;
