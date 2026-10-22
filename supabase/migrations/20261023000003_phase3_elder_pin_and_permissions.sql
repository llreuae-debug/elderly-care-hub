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
