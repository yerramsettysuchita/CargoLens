-- ─── CargoLens — Phase 2 Migrations ──────────────────────────────────────────
-- Run AFTER migrations.sql in Supabase SQL Editor

-- ─── notifications ────────────────────────────────────────────────────────────
-- Notification history — email and WhatsApp dispatches triggered by CargoLens.

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  shipment_id uuid references public.shipments(id) on delete set null,
  user_id     uuid references auth.users(id) on delete cascade,
  type        text not null,
  -- Values: shipment_created | customs_hold | high_delay_risk | delivered
  channel     text not null default 'email',
  recipient   text,
  status      text not null default 'sent'
                check (status in ('pending', 'sent', 'failed')),
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_user_id     on public.notifications(user_id);
create index if not exists idx_notifications_shipment_id on public.notifications(shipment_id);
create index if not exists idx_notifications_created_at  on public.notifications(created_at desc);

alter table public.notifications enable row level security;

create policy "users_read_own_notifications"
on public.notifications
for select
to authenticated
using (auth.uid() = user_id);

create policy "service_insert_notifications"
on public.notifications
for insert
to authenticated
with check (auth.uid() = user_id);
