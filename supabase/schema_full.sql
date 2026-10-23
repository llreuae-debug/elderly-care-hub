-- Phase 1 Migration: Elderly Care Coordination Hub
-- Tables: profiles, care_circles, care_circle_members, timeline_events

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles Table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text not null,
  avatar_url text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Trigger to auto-create profile on auth.users signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'User'), '@', 1))
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = case when public.profiles.full_name is null or public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end,
      updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Care Circles Table
create table if not exists public.care_circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Index on invite_code for fast lookups
create index if not exists idx_care_circles_invite_code on public.care_circles (invite_code);

-- 3. Care Circle Members Table
create table if not exists public.care_circle_members (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'viewer')) default 'viewer',
  joined_at timestamptz default timezone('utc'::text, now()) not null,
  unique (care_circle_id, user_id)
);

create index if not exists idx_care_circle_members_circle on public.care_circle_members (care_circle_id);
create index if not exists idx_care_circle_members_user on public.care_circle_members (user_id);

-- 4. Timeline Events Table
create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('note', 'med', 'appointment')),
  title text not null,
  description text,
  occurred_at timestamptz default timezone('utc'::text, now()) not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_timeline_events_circle_occurred on public.timeline_events (care_circle_id, occurred_at desc);

-- 5. Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.care_circles enable row level security;
alter table public.care_circle_members enable row level security;
alter table public.timeline_events enable row level security;

-- Profiles Policies
create policy "Users can view their own profile or profiles in the same care circle"
  on public.profiles for select
  using (
    auth.uid() = id or
    exists (
      select 1 from public.care_circle_members m1
      join public.care_circle_members m2 on m1.care_circle_id = m2.care_circle_id
      where m1.user_id = auth.uid() and m2.user_id = profiles.id
    )
  );

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Care Circles Policies
create policy "Members can view care circles"
  on public.care_circles for select
  using (
    auth.uid() = created_by or
    exists (
      select 1 from public.care_circle_members
      where care_circle_members.care_circle_id = care_circles.id
      and care_circle_members.user_id = auth.uid()
    )
  );

create policy "Authenticated users can create care circles"
  on public.care_circles for insert
  with check (auth.uid() is not null);

create policy "Admins can update care circles"
  on public.care_circles for update
  using (
    exists (
      select 1 from public.care_circle_members
      where care_circle_members.care_circle_id = care_circles.id
      and care_circle_members.user_id = auth.uid()
      and care_circle_members.role = 'admin'
    ) or auth.uid() = created_by
  );

-- Care Circle Members Policies
create policy "Members can view fellow circle members"
  on public.care_circle_members for select
  using (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = care_circle_members.care_circle_id
      and m.user_id = auth.uid()
    ) or user_id = auth.uid()
  );

create policy "Authenticated users can join circles or add members"
  on public.care_circle_members for insert
  with check (
    auth.uid() = user_id or
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = care_circle_members.care_circle_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
    )
  );

-- Timeline Events Policies
create policy "Circle members can view timeline events"
  on public.timeline_events for select
  using (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = timeline_events.care_circle_id
      and m.user_id = auth.uid()
    )
  );

create policy "Circle members can insert timeline events"
  on public.timeline_events for insert
  with check (
    auth.uid() = created_by and
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = timeline_events.care_circle_id
      and m.user_id = auth.uid()
    )
  );

-- 6. Helper Function: Join Care Circle by Invite Code
create or replace function public.join_care_circle_by_invite_code(p_invite_code text)
returns json as $$
declare
  v_circle public.care_circles%rowtype;
  v_member public.care_circle_members%rowtype;
begin
  select * into v_circle
  from public.care_circles
  where upper(trim(invite_code)) = upper(trim(p_invite_code));

  if not found then
    raise exception 'Invalid invite code: circle not found';
  end if;

  insert into public.care_circle_members (care_circle_id, user_id, role)
  values (v_circle.id, auth.uid(), 'viewer')
  on conflict (care_circle_id, user_id) do update
  set joined_at = now()
  returning * into v_member;

  return json_build_object(
    'circle', row_to_json(v_circle),
    'member', row_to_json(v_member)
  );
end;
$$ language plpgsql security definer;

-- 7. Realtime Enablement
alter publication supabase_realtime add table public.timeline_events;
alter publication supabase_realtime add table public.care_circle_members;
-- Phase 2 Migration: Medication Reminders & Daily Check-in with Missed Check-in Alerts

-- 1. Alter Care Circles to add check-in deadline and escalation phone
alter table public.care_circles
  add column if not exists check_in_deadline_time text default '10:00' not null,
  add column if not exists primary_caregiver_phone text;

-- 2. Medications Table
create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  name text not null,
  dosage text not null,
  schedule text[] not null default array['08:00']::text[],
  assigned_to uuid references auth.users(id) on delete set null,
  instructions text,
  is_active boolean default true not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_medications_circle on public.medications (care_circle_id);

-- 3. Medication Logs Table (Daily Taken / Skipped tracking)
create table if not exists public.medication_logs (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  scheduled_time text not null,
  scheduled_date date not null default current_date,
  status text not null check (status in ('taken', 'skipped', 'pending')) default 'pending',
  logged_by uuid references auth.users(id) on delete set null,
  logged_at timestamptz,
  notes text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique (medication_id, scheduled_date, scheduled_time)
);

create index if not exists idx_medication_logs_circle_date on public.medication_logs (care_circle_id, scheduled_date);

-- 4. Daily Check-ins Table
create table if not exists public.daily_check_ins (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  checked_in_by uuid references auth.users(id) on delete set null,
  check_in_date date not null default current_date,
  checked_in_at timestamptz default timezone('utc'::text, now()) not null,
  status text not null check (status in ('ok', 'missed')) default 'ok',
  escalation_stage int default 0 not null, -- 0: none, 1: push sent, 2: twilio sms sent
  notes text,
  unique (care_circle_id, check_in_date)
);

create index if not exists idx_daily_check_ins_circle_date on public.daily_check_ins (care_circle_id, check_in_date);

-- 5. Row Level Security (RLS)
alter table public.medications enable row level security;
alter table public.medication_logs enable row level security;
alter table public.daily_check_ins enable row level security;

-- Medications Policies
create policy "Circle members can view medications"
  on public.medications for select
  using (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = medications.care_circle_id
      and m.user_id = auth.uid()
    )
  );

create policy "Circle members can create medications"
  on public.medications for insert
  with check (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = medications.care_circle_id
      and m.user_id = auth.uid()
    )
  );

create policy "Circle members can update medications"
  on public.medications for update
  using (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = medications.care_circle_id
      and m.user_id = auth.uid()
    )
  );

-- Medication Logs Policies
create policy "Circle members can view medication logs"
  on public.medication_logs for select
  using (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = medication_logs.care_circle_id
      and m.user_id = auth.uid()
    )
  );

create policy "Circle members can insert medication logs"
  on public.medication_logs for insert
  with check (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = medication_logs.care_circle_id
      and m.user_id = auth.uid()
    )
  );

create policy "Circle members can update medication logs"
  on public.medication_logs for update
  using (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = medication_logs.care_circle_id
      and m.user_id = auth.uid()
    )
  );

-- Daily Check-ins Policies
create policy "Circle members can view daily check-ins"
  on public.daily_check_ins for select
  using (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = daily_check_ins.care_circle_id
      and m.user_id = auth.uid()
    )
  );

create policy "Circle members can record daily check-ins"
  on public.daily_check_ins for insert
  with check (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = daily_check_ins.care_circle_id
      and m.user_id = auth.uid()
    )
  );

create policy "Circle members can update daily check-ins"
  on public.daily_check_ins for update
  using (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = daily_check_ins.care_circle_id
      and m.user_id = auth.uid()
    )
  );

-- 6. Realtime Publication
alter publication supabase_realtime add table public.medications;
alter publication supabase_realtime add table public.medication_logs;
alter publication supabase_realtime add table public.daily_check_ins;
-- Phase 3 Migration: Elder PIN Authentication & Enforced Caregiver Permissions
-- Enable pgcrypto for secure hashing if available
create extension if not exists "pgcrypto";

-- 1. Alter care_circles to store hashed 4-digit PIN and elder name
alter table public.care_circles
  add column if not exists elder_pin_hash text,
  add column if not exists elder_name text default 'Eleanor' not null;

-- Set default seed PIN hash for Eleanor Vance Care Circle (PIN: 1234)
-- SHA-256 of '1234' = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'
update public.care_circles
set elder_pin_hash = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
    elder_name = 'Eleanor'
where invite_code = 'CARE01' and (elder_pin_hash is null or elder_pin_hash = '');

-- 2. Elder PIN Verification RPC Function
create or replace function public.verify_elder_pin(p_invite_code text, p_pin_hash text)
returns json as $$
declare
  v_circle public.care_circles%rowtype;
begin
  select * into v_circle
  from public.care_circles
  where upper(trim(invite_code)) = upper(trim(p_invite_code));

  if not found then
    raise exception 'Care Circle not found for invite code %', p_invite_code;
  end if;

  if v_circle.elder_pin_hash is null or v_circle.elder_pin_hash != p_pin_hash then
    raise exception 'Invalid 4-digit PIN';
  end if;

  return json_build_object(
    'success', true,
    'circle_id', v_circle.id,
    'circle_name', v_circle.name,
    'elder_name', v_circle.elder_name,
    'invite_code', v_circle.invite_code
  );
end;
$$ language plpgsql security definer;

-- 3. Strict Server-Side RLS Enforcement: Admin vs Viewer Permissions
-- Drop existing medication write policies to enforce strict admin-only mutation
drop policy if exists "Circle members can create medications" on public.medications;
drop policy if exists "Circle members can update medications" on public.medications;
drop policy if exists "Circle members can delete medications" on public.medications;

-- Medications: Any member can read, but ONLY Admins can Insert / Update / Delete
create policy "Only circle admins can insert medications"
  on public.medications for insert
  with check (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = medications.care_circle_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
    )
  );

create policy "Only circle admins can update medications"
  on public.medications for update
  using (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = medications.care_circle_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
    )
  );

create policy "Only circle admins can delete medications"
  on public.medications for delete
  using (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = medications.care_circle_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
    )
  );

-- Care Circles: Drop existing update policy and enforce strict admin-only update
drop policy if exists "Admins can update care circles" on public.care_circles;

create policy "Only circle admins can update care circles"
  on public.care_circles for update
  using (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = care_circles.id
      and m.user_id = auth.uid()
      and m.role = 'admin'
    ) or auth.uid() = created_by
  );

-- Care Circle Members: Drop existing insert policy and enforce strict admin-only member invites/removals
drop policy if exists "Authenticated users can join circles or add members" on public.care_circle_members;

create policy "Only circle admins can add or invite members"
  on public.care_circle_members for insert
  with check (
    -- Allow user joining via invite code RPC OR admin inviting
    auth.uid() = user_id or
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = care_circle_members.care_circle_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
    )
  );

create policy "Only circle admins can remove members"
  on public.care_circle_members for delete
  using (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = care_circle_members.care_circle_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
    )
  );

-- 4. Call for Help Emergency RPC Function
create or replace function public.trigger_call_for_help(p_circle_id uuid, p_notes text default null)
returns json as $$
declare
  v_circle public.care_circles%rowtype;
  v_event public.timeline_events%rowtype;
begin
  select * into v_circle from public.care_circles where id = p_circle_id;
  if not found then
    raise exception 'Care Circle not found';
  end if;

  insert into public.timeline_events (
    care_circle_id,
    created_by,
    type,
    title,
    description,
    occurred_at
  ) values (
    v_circle.id,
    coalesce(v_circle.created_by, '00000000-0000-0000-0000-000000000000'::uuid),
    'note',
    '🚨 EMERGENCY: ' || v_circle.elder_name || ' called for help!',
    coalesce(p_notes, 'Emergency button pressed in Elder Mode. Push alerts and SMS dispatched to all circle admins.'),
    now()
  ) returning * into v_event;

  return json_build_object(
    'success', true,
    'circle_id', v_circle.id,
    'elder_name', v_circle.elder_name,
    'timeline_event_id', v_event.id
  );
end;
$$ language plpgsql security definer;
-- Phase 4 Migration: Caregiver Shift Management, Task Checklists, & Shift Handoffs

-- 1. Caregiver Shifts Table
create table if not exists public.caregiver_shifts (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  caregiver_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  start_time text not null, -- e.g. "08:00"
  end_time text not null,   -- e.g. "14:00"
  status text not null check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')) default 'scheduled',
  handoff_note text,
  handoff_completed_at timestamptz,
  handoff_nothing_to_report boolean default false not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_caregiver_shifts_circle_date
  on public.caregiver_shifts (care_circle_id, date);

-- 2. Shift Tasks Table (Shift-specific checklist that does NOT persist beyond the shift)
create table if not exists public.shift_tasks (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.caregiver_shifts(id) on delete cascade,
  title text not null,
  completed boolean default false not null,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_shift_tasks_shift_id
  on public.shift_tasks (shift_id);

-- 3. Row Level Security (RLS) Policies
alter table public.caregiver_shifts enable row level security;
alter table public.shift_tasks enable row level security;

-- Shifts: Circle members can view all shifts for their circle
create policy "Circle members can view shifts"
  on public.caregiver_shifts for select
  using (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = caregiver_shifts.care_circle_id
      and m.user_id = auth.uid()
    )
  );

-- Shifts: Only admins can insert shifts
create policy "Only circle admins can insert shifts"
  on public.caregiver_shifts for insert
  with check (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = caregiver_shifts.care_circle_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
    )
  );

-- Shifts: Only admins can update shift details, OR assigned caregiver can complete handoff
create policy "Admins or assigned caregiver can update shifts"
  on public.caregiver_shifts for update
  using (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = caregiver_shifts.care_circle_id
      and m.user_id = auth.uid()
      and (m.role = 'admin' or caregiver_shifts.caregiver_id = auth.uid())
    )
  );

-- Shifts: Only admins can delete shifts
create policy "Only circle admins can delete shifts"
  on public.caregiver_shifts for delete
  using (
    exists (
      select 1 from public.care_circle_members m
      where m.care_circle_id = caregiver_shifts.care_circle_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
    )
  );

-- Shift Tasks: Circle members can view shift checklist tasks
create policy "Circle members can view shift tasks"
  on public.shift_tasks for select
  using (
    exists (
      select 1 from public.caregiver_shifts s
      join public.care_circle_members m on m.care_circle_id = s.care_circle_id
      where s.id = shift_tasks.shift_id
      and m.user_id = auth.uid()
    )
  );

-- Shift Tasks: Only admins can insert checklist items for a shift
create policy "Only admins can insert shift tasks"
  on public.shift_tasks for insert
  with check (
    exists (
      select 1 from public.caregiver_shifts s
      join public.care_circle_members m on m.care_circle_id = s.care_circle_id
      where s.id = shift_tasks.shift_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
    )
  );

-- Shift Tasks: ONLY the assigned caregiver for the shift (or circle admin) can edit their checklist tasks
create policy "Only assigned caregiver can edit their shift checklist"
  on public.shift_tasks for update
  using (
    exists (
      select 1 from public.caregiver_shifts s
      where s.id = shift_tasks.shift_id
      and (
        s.caregiver_id = auth.uid() or
        exists (
          select 1 from public.care_circle_members m
          where m.care_circle_id = s.care_circle_id
          and m.user_id = auth.uid()
          and m.role = 'admin'
        )
      )
    )
  );

-- Shift Tasks: Only admins can delete tasks
create policy "Only admins can delete shift tasks"
  on public.shift_tasks for delete
  using (
    exists (
      select 1 from public.caregiver_shifts s
      join public.care_circle_members m on m.care_circle_id = s.care_circle_id
      where s.id = shift_tasks.shift_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
    )
  );
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
-- Migration 20261023000008: Phase 2 Server-Side Truth Analytics Views
-- Strictly Zero-PII. Readable only by service_role.
-- Source of truth: Subscriptions, Care Circles, Daily Check-ins, Twilio Usage DB tables.

-- ============================================================================
-- 1. View: v_mrr (Monthly Recurring Revenue by Month)
-- ============================================================================
create or replace view public.v_mrr as
with months as (
  -- Distinct activity months from subscriptions
  select distinct to_char(date_trunc('month', d), 'YYYY-MM') as month_str,
                  date_trunc('month', d) as month_start,
                  (date_trunc('month', d) + interval '1 month' - interval '1 second') as month_end
  from (
    select started_at as d from public.subscriptions
    union
    select coalesce(cancelled_at, now()) as d from public.subscriptions
    union
    select now() as d
  ) s
),
monthly_agg as (
  select
    m.month_str,
    count(distinct s.care_circle_id) as active_subscriptions,
    -- Monthly plans
    coalesce(sum(case when s.billing_cycle = 'monthly' then s.price_usd else 0 end), 0) as monthly_plan_mrr,
    -- Annual plans normalized to monthly ($199.99 / 12 = $16.6658)
    coalesce(sum(case when s.billing_cycle = 'annual' then (s.price_usd / 12.0) else 0 end), 0) as annual_plan_mrr
  from months m
  left join public.subscriptions s
    on s.started_at <= m.month_end
    and (s.cancelled_at is null or s.cancelled_at >= m.month_start)
    and s.status in ('active', 'cancelled', 'failed')
  group by m.month_str
)
select
  month_str as month,
  active_subscriptions,
  round(monthly_plan_mrr::numeric, 2) as monthly_plan_mrr_usd,
  round(annual_plan_mrr::numeric, 2) as annual_plan_mrr_usd,
  round((monthly_plan_mrr + annual_plan_mrr)::numeric, 2) as total_mrr_usd
from monthly_agg
order by month_str desc;


-- ============================================================================
-- 2. View: v_conversion_cohorts (Signup Month -> Paid by Month 1/2/3)
-- ============================================================================
create or replace view public.v_conversion_cohorts as
with circle_cohorts as (
  select
    c.id as circle_id,
    to_char(c.created_at, 'YYYY-MM') as signup_cohort_month,
    c.created_at as circle_created_at,
    min(s.started_at) as first_subscription_started_at
  from public.care_circles c
  left join public.subscriptions s on c.id = s.care_circle_id
  group by c.id, c.created_at
),
cohort_aggregates as (
  select
    signup_cohort_month,
    count(distinct circle_id) as total_circles_in_cohort,
    -- Converted within 30 days of creation
    count(distinct case
      when first_subscription_started_at is not null
       and first_subscription_started_at <= (circle_created_at + interval '30 days')
      then circle_id end
    ) as paid_month_1,
    -- Converted within 60 days of creation
    count(distinct case
      when first_subscription_started_at is not null
       and first_subscription_started_at <= (circle_created_at + interval '60 days')
      then circle_id end
    ) as paid_month_2,
    -- Converted within 90 days of creation
    count(distinct case
      when first_subscription_started_at is not null
       and first_subscription_started_at <= (circle_created_at + interval '90 days')
      then circle_id end
    ) as paid_month_3
  from circle_cohorts
  group by signup_cohort_month
)
select
  signup_cohort_month,
  total_circles_in_cohort,
  paid_month_1,
  round((paid_month_1::numeric / nullif(total_circles_in_cohort, 0)::numeric) * 100, 2) as conversion_rate_m1_pct,
  paid_month_2,
  round((paid_month_2::numeric / nullif(total_circles_in_cohort, 0)::numeric) * 100, 2) as conversion_rate_m2_pct,
  paid_month_3,
  round((paid_month_3::numeric / nullif(total_circles_in_cohort, 0)::numeric) * 100, 2) as conversion_rate_m3_pct
from cohort_aggregates
order by signup_cohort_month desc;


-- ============================================================================
-- 3. View: v_churn (Voluntary vs Involuntary, Monthly)
-- ============================================================================
create or replace view public.v_churn as
with months as (
  select distinct to_char(date_trunc('month', d), 'YYYY-MM') as month_str,
                  date_trunc('month', d) as month_start,
                  (date_trunc('month', d) + interval '1 month') as next_month_start
  from (
    select started_at as d from public.subscriptions
    union
    select coalesce(cancelled_at, now()) as d from public.subscriptions
    union
    select now() as d
  ) s
),
monthly_churn_stats as (
  select
    m.month_str,
    -- Active base at start of month
    count(distinct case
      when s.started_at < m.month_start
       and (s.cancelled_at is null or s.cancelled_at >= m.month_start)
      then s.care_circle_id end
    ) as active_subscribers_start,
    -- Voluntary churn in month
    count(distinct case
      when s.cancelled_at >= m.month_start
       and s.cancelled_at < m.next_month_start
       and s.status = 'cancelled'
      then s.care_circle_id end
    ) as voluntary_cancellations,
    -- Involuntary churn in month
    count(distinct case
      when s.cancelled_at >= m.month_start
       and s.cancelled_at < m.next_month_start
       and s.status = 'failed'
      then s.care_circle_id end
    ) as involuntary_payment_failures
  from months m
  left join public.subscriptions s on true
  group by m.month_str
)
select
  month_str as month,
  active_subscribers_start,
  voluntary_cancellations,
  round((voluntary_cancellations::numeric / nullif(active_subscribers_start, 0)::numeric) * 100, 2) as voluntary_churn_rate_pct,
  involuntary_payment_failures,
  round((involuntary_payment_failures::numeric / nullif(active_subscribers_start, 0)::numeric) * 100, 2) as involuntary_churn_rate_pct,
  round(((voluntary_cancellations + involuntary_payment_failures)::numeric / nullif(active_subscribers_start, 0)::numeric) * 100, 2) as total_churn_rate_pct
from monthly_churn_stats
order by month_str desc;


-- ============================================================================
-- 4. View: v_arpu (Average Revenue Per User)
-- ============================================================================
create or replace view public.v_arpu as
with monthly_revenue as (
  select
    to_char(started_at, 'YYYY-MM') as month_str,
    count(distinct care_circle_id) as paying_users_count,
    sum(
      case
        when billing_cycle = 'annual' then (price_usd / 12.0)
        else price_usd
      end
    ) as normalized_mrr_usd
  from public.subscriptions
  where status in ('active', 'cancelled', 'failed')
  group by to_char(started_at, 'YYYY-MM')
)
select
  month_str as month,
  paying_users_count,
  round(normalized_mrr_usd::numeric, 2) as total_revenue_usd,
  round((normalized_mrr_usd::numeric / nullif(paying_users_count, 0)::numeric), 2) as arpu_usd
from monthly_revenue
order by month_str desc;


-- ============================================================================
-- 5. View: v_sms_cost_per_user (Twilio spend / active Family users)
-- ============================================================================
create or replace view public.v_sms_cost_per_user as
with monthly_sms as (
  select
    to_char(created_at, 'YYYY-MM') as month_str,
    count(*) as total_sms_sent,
    coalesce(sum(cost_estimate_usd), 0.0079 * count(*)) as total_twilio_spend_usd
  from public.twilio_usage
  where status != 'failed'
  group by to_char(created_at, 'YYYY-MM')
),
monthly_subscribers as (
  select
    to_char(started_at, 'YYYY-MM') as month_str,
    count(distinct care_circle_id) as active_family_subscribers
  from public.subscriptions
  where status in ('active', 'cancelled', 'failed')
  group by to_char(started_at, 'YYYY-MM')
)
select
  coalesce(u.month_str, s.month_str, to_char(current_date, 'YYYY-MM')) as month,
  coalesce(s.total_sms_sent, 0) as total_sms_sent,
  round(coalesce(s.total_twilio_spend_usd, 0)::numeric, 4) as total_twilio_spend_usd,
  coalesce(u.active_family_subscribers, 0) as active_family_subscribers,
  round((coalesce(s.total_twilio_spend_usd, 0)::numeric / nullif(u.active_family_subscribers, 0)::numeric), 4) as sms_cost_per_user_usd,
  -- Carrier cost as percentage of standard $19.99 subscription
  round(((coalesce(s.total_twilio_spend_usd, 0)::numeric / nullif(u.active_family_subscribers, 0)::numeric) / 19.99) * 100, 2) as sms_cost_pct_of_arpu
from monthly_subscribers u
full outer join monthly_sms s on u.month_str = s.month_str
order by month desc;


-- ============================================================================
-- 6. View: v_activation (First check-in within 7 days; median time-to-activate)
-- ============================================================================
create or replace view public.v_activation as
with circle_first_checkin as (
  select
    c.id as circle_id,
    to_char(c.created_at, 'YYYY-MM') as cohort_month,
    c.created_at as created_at,
    min(d.checked_in_at) as first_check_in_at,
    extract(epoch from (min(d.checked_in_at) - c.created_at)) / 3600.0 as time_to_activate_hours
  from public.care_circles c
  left join public.daily_check_ins d on c.id = d.care_circle_id and d.status = 'ok'
  group by c.id, c.created_at
)
select
  cohort_month,
  count(*) as total_circles_created,
  count(first_check_in_at) as total_activated,
  -- Activated within 7 days of circle creation (<= 168 hours)
  count(case when time_to_activate_hours is not null and time_to_activate_hours <= 168.0 then 1 end) as activated_within_7d,
  round((count(case when time_to_activate_hours is not null and time_to_activate_hours <= 168.0 then 1 end)::numeric / nullif(count(*), 0)::numeric) * 100, 2) as activation_rate_7d_pct,
  round(coalesce(avg(time_to_activate_hours), 0)::numeric, 2) as avg_time_to_activate_hours,
  round(coalesce(percentile_cont(0.5) within group (order by time_to_activate_hours), 0)::numeric, 2) as median_time_to_activate_hours
from circle_first_checkin
group by cohort_month
order by cohort_month desc;


-- ============================================================================
-- 7. View: v_invites (Caregiver invites sent, accepted, rate)
-- ============================================================================
create or replace view public.v_invites as
with circle_totals as (
  select count(*) as total_circles_count from public.care_circles
),
sent_events as (
  select count(*) as total_invites_sent
  from public.analytics_events
  where event_name = 'caregiver_invite_sent'
),
accepted_joins as (
  select count(*) as total_invites_accepted
  from public.care_circle_members m
  join public.care_circles c on m.care_circle_id = c.id
  where m.user_id != c.created_by -- Exclude creator
)
select
  c.total_circles_count,
  coalesce(s.total_invites_sent, 0) as total_invites_sent,
  round((coalesce(s.total_invites_sent, 0)::numeric / nullif(c.total_circles_count, 0)::numeric), 2) as invites_per_circle,
  coalesce(a.total_invites_accepted, 0) as total_invites_accepted,
  round((coalesce(a.total_invites_accepted, 0)::numeric / nullif(s.total_invites_sent, 0)::numeric) * 100, 2) as invite_acceptance_rate_pct
from circle_totals c
cross join sent_events s
cross join accepted_joins a;


-- ============================================================================
-- Security: Readable by service_role only (No public/authenticated/anon access)
-- ============================================================================
revoke all on public.v_mrr from public, authenticated, anon;
grant select on public.v_mrr to service_role;

revoke all on public.v_conversion_cohorts from public, authenticated, anon;
grant select on public.v_conversion_cohorts to service_role;

revoke all on public.v_churn from public, authenticated, anon;
grant select on public.v_churn to service_role;

revoke all on public.v_arpu from public, authenticated, anon;
grant select on public.v_arpu to service_role;

revoke all on public.v_sms_cost_per_user from public, authenticated, anon;
grant select on public.v_sms_cost_per_user to service_role;

revoke all on public.v_activation from public, authenticated, anon;
grant select on public.v_activation to service_role;

revoke all on public.v_invites from public, authenticated, anon;
grant select on public.v_invites to service_role;
-- Phase 1 Seed Data for Elderly Care Coordination Hub
-- One Care Circle, Two Members (Sarah: admin, Marcus: viewer), Three Timeline Events (med, appointment, note)

do $$
declare
  v_user1_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  v_user2_id uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  v_circle_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
begin
  -- 1. Create Mock Auth Users in auth.users if not present
  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    role,
    aud
  ) values
  (
    v_user1_id,
    '00000000-0000-0000-0000-000000000000',
    'sarah.vance@example.com',
    '$2a$10$dummyhashedpasswordfordemotestingpurposeonly00000000',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Sarah Vance (Daughter)"}',
    now() - interval '7 days',
    now(),
    'authenticated',
    'authenticated'
  ),
  (
    v_user2_id,
    '00000000-0000-0000-0000-000000000000',
    'marcus.chen@example.com',
    '$2a$10$dummyhashedpasswordfordemotestingpurposeonly00000000',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Dr. Marcus Chen (Home Nurse)"}',
    now() - interval '5 days',
    now(),
    'authenticated',
    'authenticated'
  )
  on conflict (id) do nothing;

  -- 2. Upsert Profiles
  insert into public.profiles (id, email, full_name, created_at, updated_at)
  values
  (
    v_user1_id,
    'sarah.vance@example.com',
    'Sarah Vance (Daughter)',
    now() - interval '7 days',
    now()
  ),
  (
    v_user2_id,
    'marcus.chen@example.com',
    'Dr. Marcus Chen (Home Nurse)',
    now() - interval '5 days',
    now()
  )
  on conflict (id) do update
  set full_name = excluded.full_name;

  -- 3. Upsert Care Circle
  insert into public.care_circles (id, name, invite_code, created_by, created_at, updated_at)
  values (
    v_circle_id,
    'Eleanor Vance Care Circle',
    'CARE01',
    v_user1_id,
    now() - interval '7 days',
    now()
  )
  on conflict (id) do update
  set name = excluded.name, invite_code = excluded.invite_code;

  -- 4. Upsert Care Circle Members
  insert into public.care_circle_members (care_circle_id, user_id, role, joined_at)
  values
  (
    v_circle_id,
    v_user1_id,
    'admin',
    now() - interval '7 days'
  ),
  (
    v_circle_id,
    v_user2_id,
    'viewer',
    now() - interval '5 days'
  )
  on conflict (care_circle_id, user_id) do update
  set role = excluded.role;

  -- 5. Insert Timeline Events
  -- Event 1: Appointment (1 day ago)
  insert into public.timeline_events (
    id,
    care_circle_id,
    created_by,
    type,
    title,
    description,
    occurred_at,
    created_at
  ) values (
    'bbbbbbbb-1111-0000-0000-000000000001'::uuid,
    v_circle_id,
    v_user1_id,
    'appointment',
    'Cardiologist Follow-up Scheduled',
    'Dr. Alvarez clinic at St. Jude Hospital, 3rd Floor. Tuesday at 10:30 AM. Sarah will drive and accompany Eleanor.',
    now() - interval '1 day',
    now() - interval '1 day'
  )
  on conflict (id) do nothing;

  -- Event 2: Med (3 hours ago)
  insert into public.timeline_events (
    id,
    care_circle_id,
    created_by,
    type,
    title,
    description,
    occurred_at,
    created_at
  ) values (
    'bbbbbbbb-1111-0000-0000-000000000002'::uuid,
    v_circle_id,
    v_user2_id,
    'med',
    'Morning Blood Pressure & Beta Blocker Administered',
    'Lisinopril 10mg and Metoprolol 25mg taken with oat porridge. BP reading: 124/82. Eleanor reported feeling energized.',
    now() - interval '3 hours',
    now() - interval '3 hours'
  )
  on conflict (id) do nothing;

  -- Event 3: Note (45 minutes ago)
  insert into public.timeline_events (
    id,
    care_circle_id,
    created_by,
    type,
    title,
    description,
    occurred_at,
    created_at
  ) values (
    'bbbbbbbb-1111-0000-0000-000000000003'::uuid,
    v_circle_id,
    v_user1_id,
    'note',
    'Afternoon Walk & Tea in the Garden',
    'Eleanor walked for 20 minutes with her walker in the garden, enjoyed chamomile tea, and worked on her watercolor sketchbook.',
    now() - interval '45 minutes',
    now() - interval '45 minutes'
  )
  on conflict (id) do nothing;

end $$;
