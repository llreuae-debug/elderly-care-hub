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
