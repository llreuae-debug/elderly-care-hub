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
