import {
  CareCircle,
  CareCircleMember,
  CaregiverShift,
  DailyCheckIn,
  Medication,
  MedicationLog,
  ShiftTask,
  TimelineEvent,
  UserProfile,
} from '../types/database';

export const SEED_PROFILES: Record<string, UserProfile> = {
  '11111111-1111-1111-1111-111111111111': {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'sarah.vance@example.com',
    full_name: 'Sarah Vance (Daughter)',
    avatar_url: null,
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  '22222222-2222-2222-2222-222222222222': {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'marcus.chen@example.com',
    full_name: 'Dr. Marcus Chen (Home Nurse)',
    avatar_url: null,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
};

export const SEED_CARE_CIRCLE: CareCircle = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name: 'Eleanor Vance Care Circle',
  invite_code: 'CARE01',
  created_by: '11111111-1111-1111-1111-111111111111',
  check_in_deadline_time: '10:00',
  primary_caregiver_phone: '+15551234567',
  elder_name: 'Eleanor',
  elder_pin_hash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', // PIN: 1234
  created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  updated_at: new Date(Date.now() - 7 * 86400000).toISOString(),
};

export const SEED_MEMBERS: CareCircleMember[] = [
  {
    id: 'mem-1',
    care_circle_id: SEED_CARE_CIRCLE.id,
    user_id: '11111111-1111-1111-1111-111111111111',
    role: 'admin',
    joined_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    profile: SEED_PROFILES['11111111-1111-1111-1111-111111111111'],
  },
  {
    id: 'mem-2',
    care_circle_id: SEED_CARE_CIRCLE.id,
    user_id: '22222222-2222-2222-2222-222222222222',
    role: 'viewer',
    joined_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    profile: SEED_PROFILES['22222222-2222-2222-2222-222222222222'],
  },
];

export const SEED_TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: 'bbbbbbbb-1111-0000-0000-000000000003',
    care_circle_id: SEED_CARE_CIRCLE.id,
    created_by: '11111111-1111-1111-1111-111111111111',
    type: 'note',
    title: 'Afternoon Walk & Tea in the Garden',
    description:
      'Eleanor walked for 20 minutes with her walker in the garden, enjoyed chamomile tea, and worked on her watercolor sketchbook. She was in bright spirits.',
    occurred_at: new Date(Date.now() - 45 * 60000).toISOString(),
    created_at: new Date(Date.now() - 45 * 60000).toISOString(),
    author: SEED_PROFILES['11111111-1111-1111-1111-111111111111'],
  },
  {
    id: 'bbbbbbbb-1111-0000-0000-000000000002',
    care_circle_id: SEED_CARE_CIRCLE.id,
    created_by: '22222222-2222-2222-2222-222222222222',
    type: 'med',
    title: 'Morning Blood Pressure & Beta Blocker Administered',
    description:
      'Lisinopril 10mg and Metoprolol 25mg taken with oat porridge. BP reading: 124/82. Eleanor reported feeling rested and well.',
    occurred_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    author: SEED_PROFILES['22222222-2222-2222-2222-222222222222'],
  },
  {
    id: 'bbbbbbbb-1111-0000-0000-000000000001',
    care_circle_id: SEED_CARE_CIRCLE.id,
    created_by: '11111111-1111-1111-1111-111111111111',
    type: 'appointment',
    title: 'Cardiologist Follow-up Scheduled',
    description:
      'Dr. Alvarez clinic at St. Jude Hospital, 3rd Floor. Tuesday at 10:30 AM. Sarah will drive and accompany Eleanor.',
    occurred_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    author: SEED_PROFILES['11111111-1111-1111-1111-111111111111'],
  },
];

export const SEED_MEDICATIONS: Medication[] = [
  {
    id: 'med-001',
    care_circle_id: SEED_CARE_CIRCLE.id,
    name: 'Lisinopril',
    dosage: '10mg',
    schedule: ['08:00'],
    assigned_to: '11111111-1111-1111-1111-111111111111',
    assigned_member: SEED_PROFILES['11111111-1111-1111-1111-111111111111'],
    instructions: 'Take with morning meal and full glass of water. Monitor BP.',
    is_active: true,
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'med-002',
    care_circle_id: SEED_CARE_CIRCLE.id,
    name: 'Metoprolol Tartrate',
    dosage: '25mg',
    schedule: ['08:00', '20:00'],
    assigned_to: '22222222-2222-2222-2222-222222222222',
    assigned_member: SEED_PROFILES['22222222-2222-2222-2222-222222222222'],
    instructions: 'Beta blocker for heart rate regulation. Take after food.',
    is_active: true,
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'med-003',
    care_circle_id: SEED_CARE_CIRCLE.id,
    name: 'Vitamin D3 & Calcium',
    dosage: '1000 IU',
    schedule: ['12:00'],
    assigned_to: '11111111-1111-1111-1111-111111111111',
    assigned_member: SEED_PROFILES['11111111-1111-1111-1111-111111111111'],
    instructions: 'Midday bone density supplement.',
    is_active: true,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
];

export const getTodayDateString = (): string => {
  return new Date().toISOString().split('T')[0];
};

export const SEED_MEDICATION_LOGS: MedicationLog[] = [
  {
    id: 'log-001',
    medication_id: 'med-001',
    care_circle_id: SEED_CARE_CIRCLE.id,
    scheduled_time: '08:00',
    scheduled_date: getTodayDateString(),
    status: 'taken',
    logged_by: '11111111-1111-1111-1111-111111111111',
    logged_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    notes: 'Taken with breakfast porridge.',
    medication: SEED_MEDICATIONS[0],
  },
  {
    id: 'log-002',
    medication_id: 'med-002',
    care_circle_id: SEED_CARE_CIRCLE.id,
    scheduled_time: '08:00',
    scheduled_date: getTodayDateString(),
    status: 'taken',
    logged_by: '22222222-2222-2222-2222-222222222222',
    logged_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    notes: 'Morning dose administered by Nurse Marcus.',
    medication: SEED_MEDICATIONS[1],
  },
  {
    id: 'log-003',
    medication_id: 'med-003',
    care_circle_id: SEED_CARE_CIRCLE.id,
    scheduled_time: '12:00',
    scheduled_date: getTodayDateString(),
    status: 'pending',
    medication: SEED_MEDICATIONS[2],
  },
  {
    id: 'log-004',
    medication_id: 'med-002',
    care_circle_id: SEED_CARE_CIRCLE.id,
    scheduled_time: '20:00',
    scheduled_date: getTodayDateString(),
    status: 'pending',
    medication: SEED_MEDICATIONS[1],
  },
];

export const SEED_CHECK_INS: DailyCheckIn[] = [
  {
    id: 'checkin-001',
    care_circle_id: SEED_CARE_CIRCLE.id,
    checked_in_by: '11111111-1111-1111-1111-111111111111',
    check_in_date: getTodayDateString(),
    checked_in_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    status: 'ok',
    escalation_stage: 0,
    notes: "Eleanor confirmed: 'Feeling wonderful, enjoyed morning tea.'",
    checker_profile: SEED_PROFILES['11111111-1111-1111-1111-111111111111'],
  },
];

export const SEED_SHIFT_TASKS: ShiftTask[] = [
  {
    id: 'task-001',
    shift_id: 'shift-001',
    title: 'Morning blood pressure check (Target: < 130/85)',
    completed: true,
    completed_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    completed_by: '11111111-1111-1111-1111-111111111111',
    created_at: new Date(Date.now() - 6 * 3600000).toISOString(),
  },
  {
    id: 'task-002',
    shift_id: 'shift-001',
    title: 'Change knee surgical dressing & inspect healing',
    completed: false,
    created_at: new Date(Date.now() - 6 * 3600000).toISOString(),
  },
  {
    id: 'task-003',
    shift_id: 'shift-001',
    title: 'Refill weekly pillbox with morning/evening doses',
    completed: false,
    created_at: new Date(Date.now() - 6 * 3600000).toISOString(),
  },
  {
    id: 'task-004',
    shift_id: 'shift-002',
    title: 'Afternoon physical therapy walking exercises (15 mins)',
    completed: false,
    created_at: new Date(Date.now() - 6 * 3600000).toISOString(),
  },
  {
    id: 'task-005',
    shift_id: 'shift-002',
    title: 'Evening vital signs & Metoprolol 25mg dose check',
    completed: false,
    created_at: new Date(Date.now() - 6 * 3600000).toISOString(),
  },
];

export const SEED_SHIFTS: CaregiverShift[] = [
  {
    id: 'shift-001',
    care_circle_id: SEED_CARE_CIRCLE.id,
    caregiver_id: '11111111-1111-1111-1111-111111111111',
    date: getTodayDateString(),
    start_time: '08:00',
    end_time: '14:00',
    status: 'in_progress',
    caregiver: SEED_PROFILES['11111111-1111-1111-1111-111111111111'],
    tasks: SEED_SHIFT_TASKS.filter((t) => t.shift_id === 'shift-001'),
    created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
  {
    id: 'shift-002',
    care_circle_id: SEED_CARE_CIRCLE.id,
    caregiver_id: '22222222-2222-2222-2222-222222222222',
    date: getTodayDateString(),
    start_time: '14:00',
    end_time: '20:00',
    status: 'scheduled',
    caregiver: SEED_PROFILES['22222222-2222-2222-2222-222222222222'],
    tasks: SEED_SHIFT_TASKS.filter((t) => t.shift_id === 'shift-002'),
    created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
];


