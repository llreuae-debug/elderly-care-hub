import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  AnalyticsEvent,
  BusinessMetricsSummary,
  SubscriptionRecord,
} from '../types/database';
import { analyticsService } from './analyticsService';
import { notificationDeliveryService } from './notificationDeliveryService';
import { SEED_CARE_CIRCLE } from './mockData';

const CURRENT_COHORT = new Date().toISOString().substring(0, 7); // e.g. "2026-10"

const INITIAL_DEMO_SUBSCRIPTIONS: SubscriptionRecord[] = [
  {
    id: 'sub-seed-01',
    care_circle_id: SEED_CARE_CIRCLE.id,
    user_id: '11111111-1111-1111-1111-111111111111',
    plan_id: 'family_monthly',
    status: 'active',
    price_usd: 19.99,
    billing_cycle: 'monthly',
    cohort_month: CURRENT_COHORT,
    started_at: '2026-10-01T12:00:00Z',
    created_at: '2026-10-01T12:00:00Z',
  },
  {
    id: 'sub-seed-02',
    care_circle_id: 'circle-demo-beta',
    user_id: 'user-beta-01',
    plan_id: 'family_monthly',
    status: 'active',
    price_usd: 19.99,
    billing_cycle: 'monthly',
    cohort_month: CURRENT_COHORT,
    started_at: '2026-10-05T09:30:00Z',
    created_at: '2026-10-05T09:30:00Z',
  },
  {
    id: 'sub-seed-03',
    care_circle_id: 'circle-demo-gamma',
    user_id: 'user-gamma-01',
    plan_id: 'family_annual',
    status: 'active',
    price_usd: 199.99,
    billing_cycle: 'annual',
    cohort_month: CURRENT_COHORT,
    started_at: '2026-10-10T14:15:00Z',
    created_at: '2026-10-10T14:15:00Z',
  },
  {
    id: 'sub-seed-04',
    care_circle_id: 'circle-demo-churned-vol',
    user_id: 'user-churn-01',
    plan_id: 'family_monthly',
    status: 'cancelled',
    price_usd: 19.99,
    billing_cycle: 'monthly',
    cohort_month: CURRENT_COHORT,
    started_at: '2026-10-02T10:00:00Z',
    cancelled_at: '2026-10-18T16:00:00Z',
    created_at: '2026-10-02T10:00:00Z',
  },
  {
    id: 'sub-seed-05',
    care_circle_id: 'circle-demo-churned-invol',
    user_id: 'user-churn-02',
    plan_id: 'family_monthly',
    status: 'failed',
    price_usd: 19.99,
    billing_cycle: 'monthly',
    cohort_month: CURRENT_COHORT,
    started_at: '2026-10-03T11:00:00Z',
    cancelled_at: '2026-10-20T08:00:00Z',
    created_at: '2026-10-03T11:00:00Z',
  },
];

// In-memory telemetry buffer for local/demo/test mode
let inMemorySubscriptions: SubscriptionRecord[] = [...INITIAL_DEMO_SUBSCRIPTIONS];
let initializedSeedEvents = false;

function ensureSeedAnalyticsEvents() {
  if (initializedSeedEvents) return;
  initializedSeedEvents = true;

  // Cohort creation baselines (10 circles created in cohort)
  for (let i = 1; i <= 10; i++) {
    analyticsService.track('circle_created', {
      cohort_month: CURRENT_COHORT,
      initial_member_role: 'admin',
    });
  }

  // 8 circles activated (completed first check-in)
  const activationHours = [1.2, 2.5, 4.0, 6.5, 12.0, 18.5, 24.0, 36.0];
  activationHours.forEach((hrs) => {
    analyticsService.track('first_check_in_completed', {
      time_to_activate_seconds: Math.round(hrs * 3600),
      time_to_activate_hours: hrs,
      is_first_check_in: true,
    });
  });

  // Caregiver Invites: 18 invites sent across circles, 14 accepted
  for (let i = 1; i <= 18; i++) {
    analyticsService.track('caregiver_invite_sent', {
      invite_channel: i % 2 === 0 ? 'copy_code' : 'share_link',
    });
  }
  for (let i = 1; i <= 14; i++) {
    analyticsService.track('caregiver_invite_accepted', {
      role: 'viewer',
    });
  }

  // Payments and SMS dispatches
  analyticsService.track('payment_succeeded', {
    amount_usd: 19.99,
    plan_id: 'family_monthly',
    billing_cycle: 'monthly',
  });
  analyticsService.track('payment_succeeded', {
    amount_usd: 19.99,
    plan_id: 'family_monthly',
    billing_cycle: 'monthly',
  });
  analyticsService.track('payment_succeeded', {
    amount_usd: 199.99,
    plan_id: 'family_annual',
    billing_cycle: 'annual',
  });

  // Churn events
  analyticsService.track('subscription_cancelled', {
    plan_id: 'family_monthly',
    churn_type: 'voluntary',
    reason: 'loved_one_recovered',
    mrr_lost_usd: 19.99,
  });
  analyticsService.track('payment_failed', {
    plan_id: 'family_monthly',
    churn_type: 'involuntary',
    attempt_number: 3,
    is_terminal: true,
    mrr_lost_usd: 19.99,
  });

  // Twilio SMS usage events ($0.0079 standard Twilio SMS cost)
  for (let i = 1; i <= 25; i++) {
    analyticsService.track('sms_dispatched', {
      cost_usd: 0.0079,
      provider: 'twilio',
      escalation_stage: i % 5 === 0 ? 2 : 1,
    });
  }
}

// Disallow PII keys in analytics payloads
const FORBIDDEN_PII_KEYS = new Set([
  'email',
  'phone',
  'name',
  'first_name',
  'last_name',
  'elder_name',
  'address',
  'ssn',
  'medication',
  'med_name',
  'dosage',
  'notes',
  'note_content',
  'text',
]);

function sanitizeProperties(
  props: Record<string, string | number | boolean | null>
): Record<string, string | number | boolean | null> {
  const clean: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(props)) {
    const lower = k.toLowerCase();
    if (!FORBIDDEN_PII_KEYS.has(lower)) {
      clean[k] = v;
    }
  }
  return clean;
}

export const billingAnalyticsService = {
  /**
   * Record a new subscription start (Free -> Paid conversion)
   */
  async recordSubscriptionStarted(
    circleId: string,
    userId: string,
    planId: 'family_monthly' | 'family_annual',
    priceUsd: number,
    billingCycle: 'monthly' | 'annual' = 'monthly'
  ): Promise<SubscriptionRecord> {
    const cohortMonth = new Date().toISOString().substring(0, 7);
    const sub: SubscriptionRecord = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      care_circle_id: circleId,
      user_id: userId,
      plan_id: planId,
      status: 'active',
      price_usd: priceUsd,
      billing_cycle: billingCycle,
      cohort_month: cohortMonth,
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    inMemorySubscriptions.push(sub);

    // Track business event (Zero PII)
    await analyticsService.track(
      'subscription_started',
      sanitizeProperties({
        plan_id: planId,
        price_usd: priceUsd,
        billing_cycle: billingCycle,
        cohort_month: cohortMonth,
      }),
      userId,
      circleId
    );

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('subscriptions').insert({
          care_circle_id: sub.care_circle_id,
          user_id: sub.user_id,
          plan_id: sub.plan_id,
          status: sub.status,
          price_usd: sub.price_usd,
          billing_cycle: sub.billing_cycle,
          cohort_month: sub.cohort_month,
          started_at: sub.started_at,
        });
      } catch (err) {
        console.warn('Supabase subscription insert error:', err);
      }
    }

    return sub;
  },

  /**
   * Record voluntary subscription cancellation (Voluntary Churn)
   */
  async recordSubscriptionCancelled(
    circleId: string,
    userId: string,
    planId: 'family_monthly' | 'family_annual',
    reason: string = 'user_request',
    mrrLostUsd: number = 19.99
  ): Promise<void> {
    const found = inMemorySubscriptions.find(
      (s) => s.care_circle_id === circleId && s.status === 'active'
    );
    if (found) {
      found.status = 'cancelled';
      found.cancelled_at = new Date().toISOString();
    }

    await analyticsService.track(
      'subscription_cancelled',
      sanitizeProperties({
        plan_id: planId,
        churn_type: 'voluntary',
        reason,
        mrr_lost_usd: mrrLostUsd,
      }),
      userId,
      circleId
    );

    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('subscriptions')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
          })
          .eq('care_circle_id', circleId)
          .eq('status', 'active');
      } catch (err) {
        console.warn('Supabase subscription update error:', err);
      }
    }
  },

  /**
   * Record involuntary churn from failed payment
   */
  async recordPaymentFailed(
    circleId: string,
    userId: string,
    planId: 'family_monthly' | 'family_annual',
    attemptNumber: number = 1,
    isTerminal: boolean = false,
    mrrLostUsd: number = 19.99
  ): Promise<void> {
    if (isTerminal) {
      const found = inMemorySubscriptions.find(
        (s) => s.care_circle_id === circleId && s.status === 'active'
      );
      if (found) {
        found.status = 'failed';
        found.cancelled_at = new Date().toISOString();
      }
    }

    await analyticsService.track(
      'payment_failed',
      sanitizeProperties({
        plan_id: planId,
        churn_type: 'involuntary',
        attempt_number: attemptNumber,
        is_terminal: isTerminal,
        mrr_lost_usd: mrrLostUsd,
      }),
      userId,
      circleId
    );
  },

  /**
   * Record successful subscription payment (for ARPU and revenue tracking)
   */
  async recordPaymentSucceeded(
    circleId: string,
    userId: string,
    planId: 'family_monthly' | 'family_annual',
    amountUsd: number,
    billingCycle: 'monthly' | 'annual' = 'monthly'
  ): Promise<void> {
    await analyticsService.track(
      'payment_succeeded',
      sanitizeProperties({
        plan_id: planId,
        amount_usd: amountUsd,
        billing_cycle: billingCycle,
      }),
      userId,
      circleId
    );
  },

  /**
   * Record Twilio SMS carrier dispatch for unit economics tracking
   */
  async recordSmsDispatched(
    circleId: string,
    costUsd: number = 0.0079,
    escalationStage: number = 1
  ): Promise<void> {
    await analyticsService.track(
      'sms_dispatched',
      sanitizeProperties({
        cost_usd: costUsd,
        provider: 'twilio',
        escalation_stage: escalationStage,
      }),
      null,
      circleId
    );
  },

  /**
   * Record Caregiver Invite Sent
   */
  async recordCaregiverInviteSent(
    circleId: string,
    inviteChannel: 'copy_code' | 'share_link' = 'copy_code'
  ): Promise<void> {
    await analyticsService.track(
      'caregiver_invite_sent',
      sanitizeProperties({
        invite_channel: inviteChannel,
      }),
      null,
      circleId
    );
  },

  /**
   * Record Caregiver Invite Accepted
   */
  async recordCaregiverInviteAccepted(
    circleId: string,
    role: 'viewer' | 'admin' = 'viewer'
  ): Promise<void> {
    await analyticsService.track(
      'caregiver_invite_accepted',
      sanitizeProperties({
        role,
      }),
      null,
      circleId
    );
  },

  /**
   * Record First Check-in Completed (Activation)
   */
  async recordFirstCheckInCompleted(
    circleId: string,
    userId: string,
    timeToActivateSeconds: number
  ): Promise<void> {
    const hours = Math.round((timeToActivateSeconds / 3600) * 100) / 100;
    await analyticsService.track(
      'first_check_in_completed',
      sanitizeProperties({
        time_to_activate_seconds: timeToActivateSeconds,
        time_to_activate_hours: hours,
        is_first_check_in: true,
      }),
      userId,
      circleId
    );
  },

  /**
   * Seed demo data for local UI and development preview
   */
  seedDemoData(): void {
    inMemorySubscriptions = [...INITIAL_DEMO_SUBSCRIPTIONS];
    initializedSeedEvents = false;
    ensureSeedAnalyticsEvents();
  },

  /**
   * Compute the 6 Business Metrics end-to-end
   */
  async getBusinessMetricsSummary(
    targetCohort: string = CURRENT_COHORT,
    ensureDemoDataIfEmpty: boolean = false
  ): Promise<BusinessMetricsSummary> {
    if (ensureDemoDataIfEmpty) {
      this.seedDemoData();
    }

    let allEvents: AnalyticsEvent[] = analyticsService.getTrackedEvents();
    let subscriptions: SubscriptionRecord[] = [...inMemorySubscriptions];

    // If Supabase live, attempt to pull latest records
    if (isSupabaseConfigured()) {
      try {
        const [eventsRes, subsRes] = await Promise.all([
          supabase.from('analytics_events').select('*'),
          supabase.from('subscriptions').select('*'),
        ]);
        if (eventsRes.data && eventsRes.data.length > 0) {
          allEvents = eventsRes.data as AnalyticsEvent[];
        }
        if (subsRes.data && subsRes.data.length > 0) {
          subscriptions = subsRes.data as SubscriptionRecord[];
        }
      } catch (err) {
        console.warn('Error fetching analytics from Supabase, using local telemetry:', err);
      }
    }

    // 1. Metric 1: Free -> Paid Conversion
    const cohortCircles = allEvents.filter(
      (e) =>
        e.event_name === 'circle_created' &&
        (!e.properties.cohort_month || e.properties.cohort_month === targetCohort)
    );
    const totalCirclesInCohort = Math.max(cohortCircles.length, 1);

    const paidSubsInCohort = subscriptions.filter(
      (s) => s.cohort_month === targetCohort && (s.status === 'active' || s.status === 'cancelled')
    );
    const paidConversions = paidSubsInCohort.length;
    const conversionRatePct =
      Math.round((paidConversions / totalCirclesInCohort) * 1000) / 10;

    // 2. Metric 2: Churn (Voluntary vs Involuntary)
    const activeSubscribersCount = subscriptions.filter((s) => s.status === 'active').length;
    const basePayingCount = Math.max(subscriptions.length, 1);

    const voluntaryCancellations = subscriptions.filter(
      (s) => s.status === 'cancelled'
    ).length;
    const involuntaryPaymentFailures = subscriptions.filter(
      (s) => s.status === 'failed'
    ).length;

    const voluntaryChurnRatePct =
      Math.round((voluntaryCancellations / basePayingCount) * 1000) / 10;
    const involuntaryChurnRatePct =
      Math.round((involuntaryPaymentFailures / basePayingCount) * 1000) / 10;
    const totalChurnRatePct =
      Math.round(((voluntaryCancellations + involuntaryPaymentFailures) / basePayingCount) * 1000) /
      10;

    // 3. Metric 3: ARPU (Average Revenue Per User)
    const paymentEvents = allEvents.filter((e) => e.event_name === 'payment_succeeded');
    let totalRevenueUsd = paymentEvents.reduce((acc, curr) => {
      const amt = Number(curr.properties.amount_usd || 0);
      return acc + amt;
    }, 0);

    // Fallback calculation from active subscriptions if payments not yet executed
    if (totalRevenueUsd === 0) {
      totalRevenueUsd = subscriptions
        .filter((s) => s.status === 'active')
        .reduce((acc, s) => acc + Number(s.price_usd || 0), 0);
    }

    const payingUsersCount = Math.max(activeSubscribersCount, 1);
    const arpuUsd = Math.round((totalRevenueUsd / payingUsersCount) * 100) / 100;

    // 4. Metric 4: SMS Cost Per User Per Month (Twilio spend / active Family users)
    const smsEvents = allEvents.filter((e) => e.event_name === 'sms_dispatched');
    const totalTwilioSpendUsd =
      Math.round(
        smsEvents.reduce((acc, curr) => {
          const cost = Number(curr.properties.cost_usd || 0.0079);
          return acc + cost;
        }, 0) * 1000
      ) / 1000;

    const costPerUserUsd =
      Math.round((totalTwilioSpendUsd / payingUsersCount) * 1000) / 1000;

    // 5. Metric 5: Activation Rate & Time to Activate (First check-in completed)
    const activationEvents = allEvents.filter(
      (e) => e.event_name === 'first_check_in_completed'
    );
    const activatedCirclesCount = activationEvents.length;
    const totalCirclesCreated = Math.max(totalCirclesInCohort, activatedCirclesCount, 1);
    const activationRatePct =
      Math.round((activatedCirclesCount / totalCirclesCreated) * 1000) / 10;

    const totalTtaHours = activationEvents.reduce((acc, curr) => {
      const hrs = Number(curr.properties.time_to_activate_hours || 0);
      return acc + hrs;
    }, 0);
    const averageTimeToActivateHours =
      activationEvents.length > 0
        ? Math.round((totalTtaHours / activationEvents.length) * 10) / 10
        : 0;

    // 6. Metric 6: Caregiver Invites Sent (Count per circle & Invite -> Accept Rate)
    const inviteSentEvents = allEvents.filter(
      (e) => e.event_name === 'caregiver_invite_sent'
    );
    const inviteAcceptedEvents = allEvents.filter(
      (e) => e.event_name === 'caregiver_invite_accepted'
    );

    const totalInvitesSent = inviteSentEvents.length;
    const totalInvitesAccepted = inviteAcceptedEvents.length;
    const invitesPerCircle =
      Math.round((totalInvitesSent / totalCirclesCreated) * 10) / 10;

    const inviteAcceptanceRatePct =
      totalInvitesSent > 0
        ? Math.round((totalInvitesAccepted / totalInvitesSent) * 1000) / 10
        : 0;

    return {
      conversion: {
        cohortMonth: targetCohort,
        totalCirclesOrUsers: totalCirclesCreated,
        paidConversions,
        conversionRatePct,
      },
      churn: {
        activeSubscribers: activeSubscribersCount,
        voluntaryCancellations,
        voluntaryChurnRatePct,
        involuntaryPaymentFailures,
        involuntaryChurnRatePct,
        totalChurnRatePct,
      },
      arpu: {
        totalRevenueUsd: Math.round(totalRevenueUsd * 100) / 100,
        payingUsersCount,
        arpuUsd,
      },
      smsCostPerUser: {
        totalTwilioSpendUsd,
        activeFamilyUsersCount: payingUsersCount,
        costPerUserUsd,
      },
      activation: {
        totalCircles: totalCirclesCreated,
        activatedCircles: activatedCirclesCount,
        activationRatePct,
        averageTimeToActivateHours,
      },
      caregiverInvites: {
        totalCircles: totalCirclesCreated,
        totalInvitesSent,
        invitesPerCircle,
        totalInvitesAccepted,
        inviteAcceptanceRatePct,
      },
    };
  },

  /**
   * Reset local subscriptions for testing
   */
  reset(populateSeedData: boolean = false): void {
    if (populateSeedData) {
      this.seedDemoData();
    } else {
      inMemorySubscriptions = [];
      initializedSeedEvents = true;
    }
  },
};
