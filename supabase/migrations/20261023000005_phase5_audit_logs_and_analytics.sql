-- Phase 5 Migration: Notification Audit Logs & Analytics Events

-- 1. Notification Audit Logs Table (For debugging push and Twilio SMS delivery)
create table if not exists public.notification_audit_logs (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  channel text not null check (channel in ('sms', 'push')),
  message text not null,
  status text not null check (status in ('pending', 'delivered', 'failed', 'retrying')),
  attempt_count integer default 1 not null,
  error_message text,
  care_circle_id uuid references public.care_circles(id) on delete cascade,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_notification_audit_logs_circle
  on public.notification_audit_logs (care_circle_id, created_at desc);

-- 2. Analytics Events Table (Key events: check-in completed, check-in missed, help pressed, handoff note written)
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (
    event_name in (
      'check_in_completed',
      'check_in_missed',
      'help_button_pressed',
      'handoff_note_written',
      'app_opened',
      'screen_viewed'
    )
  ),
  user_id uuid references auth.users(id) on delete set null,
  care_circle_id uuid references public.care_circles(id) on delete cascade,
  properties jsonb default '{}'::jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_analytics_events_event
  on public.analytics_events (event_name, created_at desc);

create index if not exists idx_analytics_events_circle
  on public.analytics_events (care_circle_id, created_at desc);

-- 3. Row Level Security
alter table public.notification_audit_logs enable row level security;
alter table public.analytics_events enable row level security;

-- Audit Logs: Circle members can view notification audit logs for their circle
create policy "Circle members can view notification audit logs"
  on public.notification_audit_logs for select
  using (
    care_circle_id is null or
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = notification_audit_logs.care_circle_id
      and m.user_id = auth.uid()
    )
  );

-- Audit Logs: Service role or authenticated members can insert log entries
create policy "Authenticated users can insert audit logs"
  on public.notification_audit_logs for insert
  with check (auth.role() = 'authenticated');

-- Analytics Events: Circle members can view analytics for their circle
create policy "Circle members can view analytics events"
  on public.analytics_events for select
  using (
    care_circle_id is null or
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = analytics_events.care_circle_id
      and m.user_id = auth.uid()
    )
  );

-- Analytics Events: Authenticated users can log analytics events
create policy "Authenticated users can insert analytics events"
  on public.analytics_events for insert
  with check (auth.role() = 'authenticated');
