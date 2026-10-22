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
