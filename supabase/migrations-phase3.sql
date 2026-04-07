-- ─── Phase 3 Migrations ───────────────────────────────────────────────────────
-- Trade fraud / sanctions flags, port congestion cache, and chat logs.
-- Apply after migrations-phase2.sql.
-- Run in: Supabase Dashboard → SQL Editor

-- ─── 1. Sanctions check results cache ─────────────────────────────────────────
-- Stores the most recent sanctions screening result per shipment.
-- Useful for audit trails and compliance record-keeping.

create table if not exists public.sanctions_checks (
  id              uuid primary key default gen_random_uuid(),
  shipment_id     uuid not null references public.shipments(id) on delete cascade,
  user_id         uuid references auth.users(id),
  risk_score      integer not null default 0,       -- 0–100
  risk_level      text not null                      -- clear|low|medium|high|critical
    check (risk_level in ('clear','low','medium','high','critical')),
  flags           jsonb not null default '[]'::jsonb, -- array of SanctionsFlag objects
  recommendation  text,
  requires_review boolean not null default false,
  screening_basis text[],
  checked_at      timestamptz not null default now()
);

-- Index for per-shipment lookup
create index if not exists sanctions_checks_shipment_id_idx
  on public.sanctions_checks(shipment_id);

-- RLS
alter table public.sanctions_checks enable row level security;

create policy "Users can read their own sanctions checks"
  on public.sanctions_checks for select
  using (auth.uid() = user_id);

create policy "Users can insert their own sanctions checks"
  on public.sanctions_checks for insert
  with check (auth.uid() = user_id);


-- ─── 2. Congestion snapshots cache ────────────────────────────────────────────
-- Optional: store periodic congestion snapshots for trend analysis.
-- Currently the engine runs in-memory; this table enables historical views.

create table if not exists public.congestion_snapshots (
  id                uuid primary key default gen_random_uuid(),
  corridor          text not null,
  congestion_score  integer not null,
  risk_level        text not null
    check (risk_level in ('low','moderate','high','severe')),
  likely_delay_days integer not null default 0,
  signal            text,
  snapped_at        timestamptz not null default now()
);

create index if not exists congestion_snapshots_corridor_idx
  on public.congestion_snapshots(corridor);

-- No RLS needed — this is reference data readable by all authenticated users
alter table public.congestion_snapshots enable row level security;

create policy "Authenticated users can read congestion snapshots"
  on public.congestion_snapshots for select
  using (auth.role() = 'authenticated');


-- ─── 3. Chat logs ─────────────────────────────────────────────────────────────
-- Persists user queries and assistant responses for analytics / audit.

create table if not exists public.chat_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id),
  message     text not null,
  intent      text,                              -- classified intent
  answer      text,
  created_at  timestamptz not null default now()
);

create index if not exists chat_logs_user_id_idx
  on public.chat_logs(user_id);

-- RLS
alter table public.chat_logs enable row level security;

create policy "Users can read their own chat logs"
  on public.chat_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own chat logs"
  on public.chat_logs for insert
  with check (auth.uid() = user_id);
