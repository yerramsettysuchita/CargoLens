-- ─── CargoLens v2 — Supabase Schema ──────────────────────────────────────────
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- This replaces the v1 schema. Drop the old table first if it exists.

drop table if exists public.shipments cascade;

create table public.shipments (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references auth.users(id) on delete cascade,
  -- NULL for seeded/platform records

  -- Identifiers
  shipment_code         text not null,

  -- Shipper
  shipper_company       text not null,
  contact_name          text not null default '',
  email                 text not null default '',

  -- Route
  origin_country        text not null,
  origin_port           text not null,
  destination_country   text not null,
  destination_port      text not null,
  consignee_name        text not null default '',
  corridor              text not null default '',
  -- e.g. ind-eu, ind-us, uae-afr, sea-eu, china-me, eu-afr

  -- Cargo
  cargo_category        text not null,
  hs_code               text,
  weight                numeric not null default 0,
  volume                numeric not null default 0,
  declared_value        numeric not null default 0,
  currency              text not null default 'USD',

  -- Logistics
  incoterm              text not null default 'FOB',
  shipment_mode         text not null default 'sea',
  priority              text not null default 'Balanced',
  carrier               text not null default '',
  expected_dispatch_date date,
  eta_date              date,

  -- Risk & Carbon
  risk_level            text not null default 'low'
                          check (risk_level in ('low', 'medium', 'high', 'critical')),
  carbon_kg             numeric not null default 0,

  -- Notes
  notes                 text,
  compliance_notes      text,

  -- Status
  status                text not null default 'booked'
                          check (status in ('draft','booked','in_transit','customs_hold','delayed','delivered','at_risk')),

  -- Platform seed flag
  is_seeded             boolean not null default false,

  created_at            timestamptz not null default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.shipments enable row level security;

-- All authenticated users can read seeded platform records and their own records
create policy "authenticated_read" on public.shipments
  for select to authenticated
  using (is_seeded = true OR auth.uid() = user_id);

-- Users can insert their own shipments
create policy "users_insert_own" on public.shipments
  for insert to authenticated
  with check (auth.uid() = user_id AND is_seeded = false);

-- Users can update their own (non-seeded) shipments
create policy "users_update_own" on public.shipments
  for update to authenticated
  using (auth.uid() = user_id AND is_seeded = false);

-- Users can delete their own (non-seeded) shipments
create policy "users_delete_own" on public.shipments
  for delete to authenticated
  using (auth.uid() = user_id AND is_seeded = false);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index shipments_user_id_idx      on public.shipments(user_id);
create index shipments_created_at_idx   on public.shipments(created_at desc);
create index shipments_corridor_idx     on public.shipments(corridor);
create index shipments_status_idx       on public.shipments(status);
create index shipments_is_seeded_idx    on public.shipments(is_seeded);
