-- ─── CargoLens — Supabase Schema ─────────────────────────────────────────────
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run

-- Enable UUID generation (already enabled by default in Supabase)
-- create extension if not exists "pgcrypto";

create table if not exists public.shipments (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,

  -- Shipper
  shipper_company       text not null,
  contact_name          text not null,
  email                 text not null,

  -- Route
  origin_country        text not null,
  origin_port           text not null,
  destination_country   text not null,
  destination_port      text not null,
  consignee_name        text not null,

  -- Cargo
  cargo_category        text not null,
  hs_code               text,
  weight                numeric not null default 0,
  volume                numeric not null default 0,
  declared_value        numeric not null default 0,

  -- Logistics
  incoterm              text not null default 'FOB',
  shipment_mode         text not null,
  priority              text not null default 'Balanced',
  expected_dispatch_date date,

  -- Notes
  notes                 text,
  compliance_notes      text,

  -- Status
  status                text not null default 'booked'
                          check (status in ('booked','in_transit','customs','delivered','delayed','at_risk')),

  created_at            timestamptz not null default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.shipments enable row level security;

-- Users can only read their own shipments
create policy "users_select_own" on public.shipments
  for select using (auth.uid() = user_id);

-- Users can insert their own shipments
create policy "users_insert_own" on public.shipments
  for insert with check (auth.uid() = user_id);

-- Users can update their own shipments
create policy "users_update_own" on public.shipments
  for update using (auth.uid() = user_id);

-- Users can delete their own shipments
create policy "users_delete_own" on public.shipments
  for delete using (auth.uid() = user_id);

-- ─── Index ────────────────────────────────────────────────────────────────────
create index if not exists shipments_user_id_idx on public.shipments(user_id);
create index if not exists shipments_created_at_idx on public.shipments(created_at desc);
