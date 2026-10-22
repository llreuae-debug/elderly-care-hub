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
  elder_pin_hash?: string | null;
  elder_name: string;
  created_at: string;
  updated_at: string;
}

export interface ElderSession {
  circle_id: string;
  circle_name: string;
  elder_name: string;
  invite_code: string;
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

// Phase 4: Caregiver Shifts, Checklists, & Handoffs
export type ShiftStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface ShiftTask {
  id: string;
  shift_id: string;
  title: string;
  completed: boolean;
  completed_at?: string | null;
  completed_by?: string | null;
  created_at: string;
}

export interface CaregiverShift {
  id: string;
  care_circle_id: string;
  caregiver_id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // e.g. "08:00"
  end_time: string; // e.g. "14:00"
  status: ShiftStatus;
  handoff_note?: string | null;
  handoff_completed_at?: string | null;
  handoff_nothing_to_report?: boolean;
  tasks?: ShiftTask[];
  caregiver?: UserProfile | null;
  created_at: string;
  updated_at: string;
}

export interface CreateShiftInput {
  care_circle_id: string;
  caregiver_id: string;
  date: string;
  start_time: string;
  end_time: string;
  initial_tasks?: string[];
}

export interface CompleteHandoffInput {
  shift_id: string;
  handoff_note?: string;
  nothing_to_report?: boolean;
}

export interface CoverageStatus {
  currentShift: CaregiverShift | null;
  nextShift: CaregiverShift | null;
  hasCoverageGap: boolean;
  gapMessage?: string;
  allTodayShifts: CaregiverShift[];
}

// Phase 5: Production-Readiness, Audit Logs, Offline Queue & Analytics
export interface NotificationAuditLog {
  id: string;
  recipient: string;
  channel: 'sms' | 'push';
  message: string;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempt_count: number;
  error_message?: string | null;
  care_circle_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type AnalyticsEventName =
  | 'check_in_completed'
  | 'check_in_missed'
  | 'help_button_pressed'
  | 'handoff_note_written'
  | 'app_opened'
  | 'screen_viewed';

export interface AnalyticsEvent {
  id: string;
  event_name: AnalyticsEventName;
  user_id?: string | null;
  care_circle_id?: string | null;
  properties: Record<string, string | number | boolean | null>;
  created_at: string;
}

export interface QueuedCheckIn {
  id: string;
  circle_id: string;
  user_id: string;
  notes?: string;
  queued_at: string;
}

