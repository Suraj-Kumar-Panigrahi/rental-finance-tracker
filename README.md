# Rental Finance Tracker

A free-friendly rental finance web app built with:

- React + Vite + TypeScript
- Tailwind CSS
- Supabase Auth + PostgreSQL database
- Vercel static hosting

The app tracks monthly rent, manually entered electricity bills, tenant payments, arrears, owner expenses, rent rate history, profitability, audit logs, and admin/viewer permissions.

## Core workflow

1. Sign up Suraj and Simanchal.
2. Run `supabase/schema.sql` in Supabase SQL Editor.
3. Promote Suraj to admin using `supabase/bootstrap_users.sql`.
4. Add properties and units.
5. Add tenants.
6. Create leases with initial rent rates.
7. Use the Monthly Dashboard to generate monthly rent records.
8. Manually add electricity bills and other bills.
9. Record tenant payments. Payments auto-allocate to outstanding charges, oldest first, or a preferred charge first.
10. Add owner expenses such as repairs, maintenance, and electricity provider payments.
11. Use monthly, yearly, and custom-date reports to audit profitability.

## What is implemented

### Roles

- `admin`: full CRUD, generate monthly rent, record payments, void payments, manage users.
- `viewer`: read-only access. UI hides write actions and Supabase RLS blocks writes.

### Main modules

- Monthly Dashboard
- Tenants CRUD
- Properties CRUD
- Units CRUD
- Leases CRUD
- Rent Rates CRUD
- Charges CRUD: rent, electricity, other
- Payments with transaction-safe auto allocation
- Owner Expenses
- Monthly / Yearly / Custom Date Reports
- Audit Logs
- User Role Management

### Important design decisions

- Every amount the tenant owes is stored as a `charge`.
- Every amount received from a tenant is stored as a `payment`.
- Payments are linked to charges through `payment_allocations`.
- Owner spending is stored in `owner_expenses`.
- Rent values are stored in `lease_rent_rates` so rent amounts can be audited by year.
- Monthly rent records are permanent charges generated from the rent rate valid for that month.
- Electricity uses manual billing. Owner pays provider, tenant reimburses owner.
- Profitability is calculated from collected payments minus owner expenses.

## Supabase setup

1. Create a free Supabase project.
2. Go to **Project Settings → API** and copy:
   - Project URL
   - anon public key
3. Go to **SQL Editor**.
4. Paste and run `supabase/schema.sql`.
5. In Supabase Auth settings, enable email/password signups.
6. Start the app locally and create accounts for:
   - Suraj
   - Simanchal
7. Edit `supabase/bootstrap_users.sql` and replace the placeholder emails or phone numbers.
8. Run `supabase/bootstrap_users.sql` in SQL Editor.

> Phone sign-in is included in the UI, but phone auth normally requires enabling/configuring phone/SMS in Supabase. Email/password is the simplest free setup.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Fill `.env` with:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-public-key
```

Open the local URL printed by Vite.

## Test commands

```bash
npm run test:domain
npm run test
npm run build
```

`npm run test:domain` is a dependency-light Node test for core rent/payment/profit calculations.

`npm run test` runs Vitest tests after dependencies are installed.

`npm run build` type-checks and builds the Vite production bundle.

## Vercel deployment

1. Push this folder to GitHub.
2. Create a new Vercel project from the GitHub repo.
3. Framework preset: **Vite**.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Add environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Deploy.

## Recommended first production test checklist

### Authentication and roles

- Suraj can sign in.
- Simanchal can sign in.
- Suraj profile role is `admin`.
- Simanchal profile role is `viewer`.
- Simanchal can view dashboard/reports.
- Simanchal cannot see add/edit/delete buttons.
- Simanchal write attempts are blocked by RLS.

### Base setup

- Admin can add a property.
- Admin can add a unit.
- Admin can add a tenant.
- Admin can create a lease.
- Admin can add a rent rate for that lease.

### Monthly rent

- Admin can select a month and generate rent records.
- Duplicate generation does not create duplicate rent records.
- Rent amount comes from the rent rate valid for the selected month.
- Month-end validity is the last date of that month.

### Electricity

- Admin can manually add an electricity charge for a tenant and month.
- Admin can add owner electricity provider payment as an owner expense.
- Electricity billed and electricity collected appear on the dashboard.

### Payments

- Admin can record a partial payment.
- Payment allocation updates charge paid amount, balance, and status.
- Admin can record a full payment.
- Admin can record a payment that covers rent and electricity.
- Admin can void a payment, and balances reverse correctly.

### Profitability

- Monthly billing report shows generated bills and arrears.
- Yearly cash-flow report shows actual payment and expense dates.
- Custom report respects the selected date range.
- Net profit = collected payments - owner expenses.

### Audit

- Create/update/delete actions appear in audit logs.
- Generate monthly rent appears in audit logs.
- Record payment appears in audit logs.
- Void payment appears in audit logs.

## Known MVP limits

- No receipt PDF generation yet.
- No attachment uploads yet.
- No WhatsApp/SMS reminders yet.
- Payment allocation is automatic oldest-first with an optional preferred charge, not a full manual split editor.
- Hard deletes are available for CRUD, but payments should be voided for audit safety.
