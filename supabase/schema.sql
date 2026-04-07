-- ─── CargoLens — Supabase Schema ─────────────────────────────────────────────
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run

create extension if not exists "pgcrypto";

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  shipment_code text not null unique,
  shipper_company text not null,
  contact_name text,
  email text,
  origin_country text not null,
  origin_port text not null,
  destination_country text not null,
  destination_port text not null,
  consignee_name text,
  cargo_category text not null,
  hs_code text,
  weight numeric(12,2) not null default 0,
  volume numeric(12,2) not null default 0,
  incoterm text,
  shipment_mode text not null,
  priority text not null default 'balanced',
  expected_dispatch_date date,
  declared_value numeric(14,2) default 0,
  currency text not null default 'USD',
  status text not null default 'booked',
  risk_level text not null default 'low',
  eta_date date,
  corridor text not null,
  carrier text,
  carbon_kg numeric(12,2) default 0,
  compliance_notes text,
  notes text,
  is_seeded boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_shipments_user_id on public.shipments(user_id);
create index if not exists idx_shipments_status on public.shipments(status);
create index if not exists idx_shipments_corridor on public.shipments(corridor);
create index if not exists idx_shipments_risk_level on public.shipments(risk_level);
create index if not exists idx_shipments_created_at on public.shipments(created_at desc);

alter table public.shipments enable row level security;

drop policy if exists "read seeded or own shipments" on public.shipments;
create policy "read seeded or own shipments"
on public.shipments
for select
to authenticated
using (
  is_seeded = true or auth.uid() = user_id
);

drop policy if exists "insert own shipments" on public.shipments;
create policy "insert own shipments"
on public.shipments
for insert
to authenticated
with check (
  auth.uid() = user_id and is_seeded = false
);

drop policy if exists "update own shipments" on public.shipments;
create policy "update own shipments"
on public.shipments
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "delete own shipments" on public.shipments;
create policy "delete own shipments"
on public.shipments
for delete
to authenticated
using (auth.uid() = user_id);
