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
  check_in_deadline_time: string; // e.g. "10:00"
  primary_caregiver_phone?: string | null;
  created_at: string;
  updated_at: string;
}

export type MedicationStatus = 'taken' | 'skipped' | 'pending';

export interface Medication {
  id: string;
  care_circle_id: string;
  name: string;
  dosage: string;
  schedule: string[]; // e.g. ["08:00", "20:00"]
  assigned_to?: string | null;
  assigned_member?: UserProfile | null;
  instructions?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MedicationLog {
  id: string;
  medication_id: string;
  care_circle_id: string;
  scheduled_time: string;
  scheduled_date: string;
  status: MedicationStatus;
  logged_by?: string | null;
  logged_at?: string | null;
  notes?: string | null;
  medication?: Medication;
}

export interface DailyCheckIn {
  id: string;
  care_circle_id: string;
  checked_in_by?: string | null;
  check_in_date: string;
  checked_in_at: string;
  status: 'ok' | 'missed';
  escalation_stage: number; // 0: none, 1: push sent, 2: sms sent
  notes?: string | null;
  checker_profile?: UserProfile | null;
}

export interface CreateMedicationInput {
  care_circle_id: string;
  name: string;
  dosage: string;
  schedule: string[];
  assigned_to?: string;
  instructions?: string;
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
