-- ─── CargoLens — Phase 1 Migrations ──────────────────────────────────────────
-- Run AFTER schema.sql in Supabase SQL Editor

-- ─── shipment_events ──────────────────────────────────────────────────────────
-- Milestone/state tracking per shipment. Each row = one tracking event.

create table if not exists public.shipment_events (
  id            uuid primary key default gen_random_uuid(),
  shipment_id   uuid not null references public.shipments(id) on delete cascade,
  event_type    text not null,
  -- Values: booked | customs_filed | at_origin_port | departed | transshipment |
  --         arrived_destination | customs_clearance | out_for_delivery | delivered
  event_label   text not null,
  location      text,
  occurred_at   timestamptz,
  status        text not null default 'pending'
                  check (status in ('completed', 'active', 'pending')),
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_events_shipment_id on public.shipment_events(shipment_id);
create index if not exists idx_events_occurred_at on public.shipment_events(occurred_at desc);

alter table public.shipment_events enable row level security;

-- Users can read events for shipments they can see (seeded or their own)
create policy "read own shipment events"
on public.shipment_events
for select
to authenticated
using (
  exists (
    select 1 from public.shipments s
    where s.id = shipment_id
      and (s.is_seeded = true or s.user_id = auth.uid())
  )
);

-- Users can insert events for their own shipments
create policy "insert own shipment events"
on public.shipment_events
for insert
to authenticated
with check (
  exists (
    select 1 from public.shipments s
    where s.id = shipment_id
      and s.user_id = auth.uid()
  )
);

-- ─── shipment_documents ───────────────────────────────────────────────────────
-- Customs / trade document metadata per shipment.

create table if not exists public.shipment_documents (
  id              uuid primary key default gen_random_uuid(),
  shipment_id     uuid not null references public.shipments(id) on delete cascade,
  doc_type        text not null,
  -- Values: commercial_invoice | packing_list | bill_of_lading | certificate_of_origin |
  --         customs_declaration | phytosanitary | dangerous_goods_declaration | other
  doc_label       text not null,
  status          text not null default 'pending'
                    check (status in ('pending', 'submitted', 'approved', 'rejected', 'missing')),
  notes           text,
  submitted_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_docs_shipment_id on public.shipment_documents(shipment_id);

alter table public.shipment_documents enable row level security;

create policy "read own shipment documents"
on public.shipment_documents
for select
to authenticated
using (
  exists (
    select 1 from public.shipments s
    where s.id = shipment_id
      and (s.is_seeded = true or s.user_id = auth.uid())
  )
);

create policy "insert own shipment documents"
on public.shipment_documents
for insert
to authenticated
with check (
  exists (
    select 1 from public.shipments s
    where s.id = shipment_id
      and s.user_id = auth.uid()
  )
);

create policy "update own shipment documents"
on public.shipment_documents
for update
to authenticated
using (
  exists (
    select 1 from public.shipments s
    where s.id = shipment_id
      and s.user_id = auth.uid()
  )
);
