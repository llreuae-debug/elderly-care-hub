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
  | 'first_check_in_completed'
  | 'check_in_missed'
  | 'help_button_pressed'
  | 'handoff_note_written'
  | 'app_opened'
  | 'screen_viewed'
  | 'circle_created'
  | 'caregiver_invite_sent'
  | 'caregiver_invite_accepted'
  | 'subscription_started'
  | 'subscription_cancelled'
  | 'payment_failed'
  | 'payment_succeeded'
  | 'sms_dispatched';

export interface AnalyticsEvent {
  id: string;
  event_name: AnalyticsEventName;
  user_id?: string | null;
  circle_id?: string | null;
  care_circle_id?: string | null;
  properties: Record<string, string | number | boolean | null>;
  app_version?: string;
  platform?: string;
  created_at: string;
}

export interface TwilioUsageRecord {
  id: string;
  care_circle_id: string;
  message_sid?: string | null;
  cost_estimate_usd: number; // Cost estimate constant per SMS segment ($0.0079)
  status: 'sent' | 'delivered' | 'failed' | 'undelivered';
  escalation_stage: number;
  created_at: string;
}

export interface SubscriptionRecord {
  id: string;
  care_circle_id: string;
  user_id: string;
  plan_id: 'family_monthly' | 'family_annual';
  status: 'active' | 'cancelled' | 'past_due' | 'failed';
  price_usd: number;
  billing_cycle: 'monthly' | 'annual';
  cohort_month: string;
  started_at: string;
  cancelled_at?: string | null;
  created_at: string;
}

export interface BusinessMetricsSummary {
  conversion: {
    cohortMonth: string;
    totalCirclesOrUsers: number;
    paidConversions: number;
    conversionRatePct: number;
  };
  churn: {
    activeSubscribers: number;
    voluntaryCancellations: number;
    voluntaryChurnRatePct: number;
    involuntaryPaymentFailures: number;
    involuntaryChurnRatePct: number;
    totalChurnRatePct: number;
  };
  arpu: {
    totalRevenueUsd: number;
    payingUsersCount: number;
    arpuUsd: number;
  };
  smsCostPerUser: {
    totalTwilioSpendUsd: number;
    activeFamilyUsersCount: number;
    costPerUserUsd: number;
  };
  activation: {
    totalCircles: number;
    activatedCircles: number;
    activationRatePct: number;
    averageTimeToActivateHours: number;
  };
  caregiverInvites: {
    totalCircles: number;
    totalInvitesSent: number;
    invitesPerCircle: number;
    totalInvitesAccepted: number;
    inviteAcceptanceRatePct: number;
  };
}

export interface QueuedCheckIn {
  id: string;
  circle_id: string;
  user_id: string;
  notes?: string;
  queued_at: string;
}

// Phase 2: Server-Side Truth Views (Service Role Only)
export interface ServerViewMrr {
  month: string;
  active_subscriptions: number;
  monthly_plan_mrr_usd: number;
  annual_plan_mrr_usd: number;
  total_mrr_usd: number;
}

export interface ServerViewConversionCohorts {
  signup_cohort_month: string;
  total_circles_in_cohort: number;
  paid_month_1: number;
  conversion_rate_m1_pct: number;
  paid_month_2: number;
  conversion_rate_m2_pct: number;
  paid_month_3: number;
  conversion_rate_m3_pct: number;
}

export interface ServerViewChurn {
  month: string;
  active_subscribers_start: number;
  voluntary_cancellations: number;
  voluntary_churn_rate_pct: number;
  involuntary_payment_failures: number;
  involuntary_churn_rate_pct: number;
  total_churn_rate_pct: number;
}

export interface ServerViewArpu {
  month: string;
  paying_users_count: number;
  total_revenue_usd: number;
  arpu_usd: number;
}

export interface ServerViewSmsCostPerUser {
  month: string;
  total_sms_sent: number;
  total_twilio_spend_usd: number;
  active_family_subscribers: number;
  sms_cost_per_user_usd: number;
  sms_cost_pct_of_arpu: number;
}

export interface ServerViewActivation {
  cohort_month: string;
  total_circles_created: number;
  total_activated: number;
  activated_within_7d: number;
  activation_rate_7d_pct: number;
  avg_time_to_activate_hours: number;
  median_time_to_activate_hours: number;
}

export interface ServerViewInvites {
  total_circles_count: number;
  total_invites_sent: number;
  invites_per_circle: number;
  total_invites_accepted: number;
  invite_acceptance_rate_pct: number;
}

