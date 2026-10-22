import { CareCircle, CareCircleMember, TimelineEvent, UserProfile } from '../types/database';

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
