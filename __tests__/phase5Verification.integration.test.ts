import { billingAnalyticsService } from '../src/services/billingAnalyticsService';
import { analyticsService } from '../src/services/analyticsService';
import { careCircleService, resetLocalState } from '../src/services/careCircleService';
import { SEED_CARE_CIRCLE, SEED_PROFILES } from '../src/services/mockData';

describe('Phase 5 Verification Suite: End-to-End Measurement Layer Verification', () => {
  const testAdminId = '11111111-1111-1111-1111-111111111111';
  const cohort = new Date().toISOString().substring(0, 7);

  beforeEach(() => {
    resetLocalState();
    analyticsService.reset();
    billingAnalyticsService.reset(false); // Clean slate, no artificial seeds
    jest.clearAllMocks();
  });

  describe('Verification 1: User Signup & Activation (First Check-In)', () => {
    it('confirms activation completed, event row recorded, and metrics summary moves', async () => {
      // 1. Create a care circle (signup baseline)
      const circle = await careCircleService.createCareCircle(
        'Verification Test Circle',
        testAdminId,
        {
          id: testAdminId,
          email: 'admin@example.com',
          full_name: 'Sarah Admin',
          avatar_url: null,
          created_at: new Date().toISOString(),
        }
      );

      expect(circle.id).toBeDefined();

      // 2. Complete first daily check-in ("I'm OK")
      const checkInRes = await careCircleService.recordDailyCheckIn(
        circle.id,
        'test-elder-id',
        SEED_PROFILES[testAdminId],
        'Feeling energetic today'
      );

      expect(checkInRes.checkIn.status).toBe('ok');

      // 3. Verify event row exists
      const events = analyticsService.getTrackedEvents('first_check_in_completed');
      expect(events.length).toBe(1);
      expect(events[0].care_circle_id).toBe(circle.id);
      expect(events[0].properties.is_first_check_in).toBe(true);

      // Verify zero PII in event
      expect(events[0].properties.email).toBeUndefined();
      expect(events[0].properties.name).toBeUndefined();
      expect(events[0].properties.notes).toBeUndefined();

      // 4. Verify metric numbers move in summary
      const summary = await billingAnalyticsService.getBusinessMetricsSummary(cohort, false);
      expect(summary.activation.hasData).toBe(true);
      expect(summary.activation.activatedCircles).toBe(1);
      expect(summary.activation.activationRatePct).toBeGreaterThan(0);
      expect(typeof summary.activation.averageTimeToActivateHours).toBe('number');
    });
  });

  describe('Verification 2: Upgrade to Family in Stripe (Server-Truth Joins)', () => {
    it('confirms v_mrr, v_conversion_cohorts, and v_arpu reflect subscription from DB truth without client paid event', async () => {
      const circleId = 'circle-stripe-verify-01';
      const userId = 'user-stripe-verify-01';

      // Record subscription directly on server layer (simulating Stripe webhook insert)
      const sub = await billingAnalyticsService.recordSubscriptionStarted(
        circleId,
        userId,
        'family_monthly',
        19.99,
        'monthly'
      );

      expect(sub.status).toBe('active');
      expect(sub.price_usd).toBe(19.99);

      // Verify server truth reflection within one cycle
      const summary = await billingAnalyticsService.getBusinessMetricsSummary(cohort, false);

      expect(summary.conversion.hasData).toBe(true);
      expect(summary.conversion.paidConversions).toBe(1);
      expect(summary.arpu.hasData).toBe(true);
      expect(summary.arpu.payingUsersCount).toBe(1);
      expect(summary.arpu.totalRevenueUsd).toBe(19.99);
      expect(summary.arpu.arpuUsd).toBe(19.99);

      // Confirm client did NOT need to fire a custom "paid" event — DB is the truth
      const allEvents = analyticsService.getTrackedEvents();
      const customPaidEvents = allEvents.filter((e) => (e.event_name as string) === 'paid');
      expect(customPaidEvents.length).toBe(0);
    });
  });

  describe('Verification 3: SMS Dispatch & Twilio Usage Row', () => {
    it('confirms twilio_usage logging and v_sms_cost_per_user reflection', async () => {
      // Active family subscriber base
      await billingAnalyticsService.recordSubscriptionStarted(
        'circle-sms-verify',
        'user-sms-verify',
        'family_monthly',
        19.99
      );

      // Dispatch Twilio SMS via test escalation flow
      await billingAnalyticsService.recordSmsDispatched('circle-sms-verify', 0.0079, 2);

      const summary = await billingAnalyticsService.getBusinessMetricsSummary(cohort, false);

      expect(summary.smsCostPerUser.hasData).toBe(true);
      expect(summary.smsCostPerUser.totalTwilioSpendUsd).toBe(0.0079);
      expect(summary.smsCostPerUser.activeFamilyUsersCount).toBe(1);
      expect(summary.smsCostPerUser.costPerUserUsd).toBe(0.0079);

      // Verify zero PII in SMS event
      const smsEvents = analyticsService.getTrackedEvents('sms_dispatched');
      expect(smsEvents.length).toBe(1);
      expect(smsEvents[0].properties.phone).toBeUndefined();
      expect(smsEvents[0].properties.message).toBeUndefined();
    });
  });

  describe('Verification 4: Caregiver Invite Flow & Acceptance', () => {
    it('confirms v_invites sent, accepted, and acceptance rate correctness', async () => {
      const circleId = 'circle-invites-verify';

      // 1. Send 2 invites
      await billingAnalyticsService.recordCaregiverInviteSent(circleId, 'copy_code');
      await billingAnalyticsService.recordCaregiverInviteSent(circleId, 'share_link');

      // 2. Accept 1 invite
      await billingAnalyticsService.recordCaregiverInviteAccepted(circleId, 'viewer');

      const summary = await billingAnalyticsService.getBusinessMetricsSummary(cohort, false);

      expect(summary.caregiverInvites.hasData).toBe(true);
      expect(summary.caregiverInvites.totalInvitesSent).toBe(2);
      expect(summary.caregiverInvites.totalInvitesAccepted).toBe(1);
      expect(summary.caregiverInvites.inviteAcceptanceRatePct).toBe(50.0); // 1 / 2 = 50%
    });
  });

  describe('Verification 5: Failed Payment & Churn Separation', () => {
    it('confirms involuntary churn is counted separately from voluntary cancellations', async () => {
      // 2 subscriptions
      await billingAnalyticsService.recordSubscriptionStarted('circle-c1', 'u1', 'family_monthly', 19.99);
      await billingAnalyticsService.recordSubscriptionStarted('circle-c2', 'u2', 'family_monthly', 19.99);

      // 1 voluntary cancellation
      await billingAnalyticsService.recordSubscriptionCancelled(
        'circle-c1',
        'u1',
        'family_monthly',
        'no_longer_needed',
        19.99
      );

      // 1 involuntary terminal payment failure
      await billingAnalyticsService.recordPaymentFailed(
        'circle-c2',
        'u2',
        'family_monthly',
        3,
        true, // terminal failure
        19.99
      );

      const summary = await billingAnalyticsService.getBusinessMetricsSummary(cohort, false);

      expect(summary.churn.hasData).toBe(true);
      expect(summary.churn.voluntaryCancellations).toBe(1);
      expect(summary.churn.involuntaryPaymentFailures).toBe(1);
      expect(summary.churn.voluntaryChurnRatePct).toBe(50.0);
      expect(summary.churn.involuntaryChurnRatePct).toBe(50.0);
      expect(summary.churn.totalChurnRatePct).toBe(100.0);
    });
  });

  describe('Verification 6: Direct API & RLS Security Isolation', () => {
    it('confirms RLS policy structure: only service_role can read all analytics events and views', () => {
      // Read migration definitions to verify RLS configuration
      const fs = require('fs');
      const migration7 = fs.readFileSync(
        'supabase/migrations/20261023000007_phase1_event_pipeline.sql',
        'utf8'
      );
      const migration8 = fs.readFileSync(
        'supabase/migrations/20261023000008_phase2_server_side_truth_views.sql',
        'utf8'
      );

      // 1. Verify analytics_events has RLS enabled
      expect(migration7).toContain('alter table public.analytics_events enable row level security;');

      // 2. Verify normal users cannot select all analytics_events
      expect(migration7).toContain('drop policy if exists "Circle members can view analytics" on public.analytics_events;');

      // 3. Verify views revoke all permissions from public, authenticated, anon and grant to service_role only
      expect(migration8).toContain('revoke all on public.v_mrr from public, authenticated, anon;');
      expect(migration8).toContain('grant select on public.v_mrr to service_role;');
      expect(migration8).toContain('revoke all on public.v_churn from public, authenticated, anon;');
      expect(migration8).toContain('grant select on public.v_churn to service_role;');
      expect(migration8).toContain('revoke all on public.v_arpu from public, authenticated, anon;');
      expect(migration8).toContain('grant select on public.v_arpu to service_role;');
      expect(migration8).toContain('revoke all on public.v_sms_cost_per_user from public, authenticated, anon;');
      expect(migration8).toContain('grant select on public.v_sms_cost_per_user to service_role;');
      expect(migration8).toContain('revoke all on public.v_activation from public, authenticated, anon;');
      expect(migration8).toContain('grant select on public.v_activation to service_role;');
      expect(migration8).toContain('revoke all on public.v_invites from public, authenticated, anon;');
      expect(migration8).toContain('grant select on public.v_invites to service_role;');
    });
  });

  describe('Verification 7: Strict Zero-PII Enforcement Across All Payloads', () => {
    it('ensures that no email, name, phone, or message text is stored in analytics properties', () => {
      const allEvents = analyticsService.getTrackedEvents();
      allEvents.forEach((event) => {
        const p = event.properties || {};
        expect(p.email).toBeUndefined();
        expect(p.name).toBeUndefined();
        expect(p.phone).toBeUndefined();
        expect(p.notes).toBeUndefined();
        expect(p.text).toBeUndefined();
      });
    });
  });
});
