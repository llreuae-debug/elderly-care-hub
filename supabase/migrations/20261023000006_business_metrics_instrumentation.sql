-- Migration 20261023000006: Business Metrics & Subscription Measurement Layer

-- 1. Relax check constraint on analytics_events to allow business metric events
alter table public.analytics_events drop constraint if exists analytics_events_event_name_check;

alter table public.analytics_events add constraint analytics_events_event_name_check check (
  event_name in (
    'check_in_completed',
    'first_check_in_completed',
    'check_in_missed',
    'help_button_pressed',
    'handoff_note_written',
    'app_opened',
    'screen_viewed',
    'circle_created',
    'caregiver_invite_sent',
    'caregiver_invite_accepted',
    'subscription_started',
    'subscription_cancelled',
    'payment_failed',
    'payment_succeeded',
    'sms_dispatched'
  )
);

-- 2. Subscriptions Table (Tracking paying Family plan circles, churn, and conversions)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid references public.care_circles(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  plan_id text not null check (plan_id in ('family_monthly', 'family_annual')),
  status text not null check (status in ('active', 'cancelled', 'past_due', 'failed')),
  price_usd numeric(10, 2) not null,
  billing_cycle text not null check (billing_cycle in ('monthly', 'annual')),
  cohort_month text not null, -- Format YYYY-MM
  started_at timestamptz default timezone('utc'::text, now()) not null,
  cancelled_at timestamptz,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_subscriptions_circle on public.subscriptions (care_circle_id);
create index if not exists idx_subscriptions_status on public.subscriptions (status);
create index if not exists idx_subscriptions_cohort on public.subscriptions (cohort_month);

-- 3. Row Level Security for Subscriptions Table
alter table public.subscriptions enable row level security;

create policy "Circle members can view subscriptions for their circle"
  on public.subscriptions for select
  using (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = subscriptions.care_circle_id
      and m.user_id = auth.uid()
    )
  );

create policy "Admins can manage subscriptions"
  on public.subscriptions for all
  using (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = subscriptions.care_circle_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
    )
  );
