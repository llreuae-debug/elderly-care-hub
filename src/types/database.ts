export type MemberRole = 'admin' | 'viewer';

export type TimelineEventType = 'note' | 'med' | 'appointment';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  created_at: string;
}

export interface CareCircle {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CareCircleMember {
  id: string;
  care_circle_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
  profile?: UserProfile | null;
}

export interface TimelineEvent {
  id: string;
  care_circle_id: string;
  created_by: string;
  type: TimelineEventType;
  title: string;
  description: string | null;
  occurred_at: string;
  created_at: string;
  author?: UserProfile | null;
}

export interface CreateTimelineEventInput {
  care_circle_id: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  occurred_at?: string;
}

export interface CreateCareCircleInput {
  name: string;
}

export interface JoinCareCircleInput {
  invite_code: string;
}
