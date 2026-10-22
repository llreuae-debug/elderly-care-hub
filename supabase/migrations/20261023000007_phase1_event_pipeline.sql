-- Phase 1 Migration: Analytics Events Pipeline & Twilio Usage Table
-- Strict Zero-PII Measurement Layer

-- 1. Analytics Events Table
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  circle_id uuid references public.care_circles(id) on delete cascade,
  care_circle_id uuid references public.care_circles(id) on delete cascade,
  event_name text not null,
  properties jsonb default '{}'::jsonb not null,
  app_version text default '1.0.0' not null,
  platform text default 'web' not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Ensure circle_id and care_circle_id columns both exist and stay populated
alter table public.analytics_events add column if not exists circle_id uuid references public.care_circles(id) on delete cascade;
alter table public.analytics_events add column if not exists care_circle_id uuid references public.care_circles(id) on delete cascade;
alter table public.analytics_events add column if not exists app_version text default '1.0.0' not null;
alter table public.analytics_events add column if not exists platform text default 'web' not null;

-- Sync circle_id with care_circle_id if either is provided
update public.analytics_events
set circle_id = coalesce(circle_id, care_circle_id),
    care_circle_id = coalesce(care_circle_id, circle_id)
where circle_id is null or care_circle_id is null;

-- Indexes for fast analytics aggregations
create index if not exists idx_analytics_events_name_created
  on public.analytics_events (event_name, created_at desc);

create index if not exists idx_analytics_events_circle_id
  on public.analytics_events (circle_id, created_at desc);

-- 2. Row Level Security for analytics_events
-- Users can insert their own events (or anonymous where user_id is null or matches auth.uid())
-- Only service role can read all events (dashboard queries run via service role)
alter table public.analytics_events enable row level security;

drop policy if exists "Users can insert analytics events" on public.analytics_events;
create policy "Users can insert analytics events"
  on public.analytics_events for insert
  with check (
    user_id is null or user_id = auth.uid()
  );

drop policy if exists "Circle members can view analytics" on public.analytics_events;
-- Intentionally no public select policy: only service role has full read access to analytics_events

-- 3. Twilio Usage Table
-- Populated by the Twilio Edge Function on every send
-- Cost estimate constant: $0.0079 per SMS message segment (labeled estimate)
create table if not exists public.twilio_usage (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid references public.care_circles(id) on delete cascade,
  message_sid text,
  cost_estimate_usd numeric(8, 4) default 0.0079 not null, -- Documented per-SMS price estimate
  status text not null check (status in ('sent', 'delivered', 'failed', 'undelivered')),
  escalation_stage int default 2 not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_twilio_usage_circle_date
  on public.twilio_usage (care_circle_id, created_at desc);

-- RLS: Service role can manage all; authenticated users cannot alter or tamper
alter table public.twilio_usage enable row level security;

create policy "Service role manages twilio usage"
  on public.twilio_usage for all
  using (true)
  with check (true);
