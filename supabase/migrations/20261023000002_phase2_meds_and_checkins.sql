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
