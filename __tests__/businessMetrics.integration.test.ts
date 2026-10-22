import { billingAnalyticsService } from '../src/services/billingAnalyticsService';
import { analyticsService } from '../src/services/analyticsService';
import { careCircleService, resetLocalState } from '../src/services/careCircleService';
import { SEED_CARE_CIRCLE, SEED_PROFILES } from '../src/services/mockData';

describe('Business Metrics Instrumentation & Measurement Layer (6 Metrics)', () => {
  const adminId = '11111111-1111-1111-1111-111111111111';
  const cohort = new Date().toISOString().substring(0, 7);

  beforeEach(() => {
    resetLocalState();
    analyticsService.reset();
    billingAnalyticsService.reset();
    jest.clearAllMocks();
  });

  describe('Metric 1: Free → Paid Conversion', () => {
    it('accurately computes conversion rate and count by cohort month', async () => {
      // 1. Create circles in cohort
      for (let i = 0; i < 5; i++) {
        await analyticsService.track('circle_created', {
          cohort_month: cohort,
          initial_member_role: 'admin',
        });
      }

      // 2. Convert 2 of them to paid Family subscriptions
      await billingAnalyticsService.recordSubscriptionStarted(
        'circle-conv-1',
        'user-conv-1',
        'family_monthly',
        19.99,
        'monthly'
      );
      await billingAnalyticsService.recordSubscriptionStarted(
        'circle-conv-2',
        'user-conv-2',
        'family_annual',
        199.99,
        'annual'
      );

      const metrics = await billingAnalyticsService.getBusinessMetricsSummary(cohort);

      expect(metrics.conversion.paidConversions).toBe(2);
      expect(metrics.conversion.cohortMonth).toBe(cohort);
      expect(metrics.conversion.conversionRatePct).toBe(40.0); // 2 / 5 = 40%
    });

    it('records subscription_started event with zero PII', async () => {
      await billingAnalyticsService.recordSubscriptionStarted(
        SEED_CARE_CIRCLE.id,
        adminId,
        'family_monthly',
        19.99,
        'monthly'
      );

      const events = analyticsService.getTrackedEvents();
      const subEvent = events.find((e) => e.event_name === 'subscription_started');

      expect(subEvent).toBeDefined();
      expect(subEvent?.properties.plan_id).toBe('family_monthly');
      expect(subEvent?.properties.price_usd).toBe(19.99);
      expect(subEvent?.properties.billing_cycle).toBe('monthly');
      expect(subEvent?.properties.cohort_month).toBe(cohort);

      // Verify zero PII
      const props = subEvent?.properties || {};
      expect(props.email).toBeUndefined();
      expect(props.phone).toBeUndefined();
      expect(props.name).toBeUndefined();
    });
  });

  describe('Metric 2: Churn (Voluntary Cancellations vs Involuntary Failed Payments)', () => {
    it('separates voluntary cancellations and involuntary payment failures into distinct rates', async () => {
      // Setup 4 active subscriptions
      for (let i = 1; i <= 4; i++) {
        await billingAnalyticsService.recordSubscriptionStarted(
          `circle-sub-${i}`,
          `user-${i}`,
          'family_monthly',
          19.99
        );
      }

      // 1 voluntary cancellation
      await billingAnalyticsService.recordSubscriptionCancelled(
        'circle-sub-1',
        'user-1',
        'family_monthly',
        'loved_one_recovered',
        19.99
      );

      // 1 involuntary terminal payment failure
      await billingAnalyticsService.recordPaymentFailed(
        'circle-sub-2',
        'user-2',
        'family_monthly',
        3,
        true, // terminal failure = churn
        19.99
      );

      const metrics = await billingAnalyticsService.getBusinessMetricsSummary(cohort);

      // 4 total subscriptions: 1 voluntary cancelled, 1 involuntary failed, 2 active
      expect(metrics.churn.activeSubscribers).toBe(2);
      expect(metrics.churn.voluntaryCancellations).toBe(1);
      expect(metrics.churn.involuntaryPaymentFailures).toBe(1);
      expect(metrics.churn.voluntaryChurnRatePct).toBe(25.0); // 1 / 4
      expect(metrics.churn.involuntaryChurnRatePct).toBe(25.0); // 1 / 4
      expect(metrics.churn.totalChurnRatePct).toBe(50.0); // 2 / 4
    });
  });

  describe('Metric 3: ARPU (Average Revenue Per Paying User)', () => {
    it('computes net subscription revenue divided by active paying accounts', async () => {
      // 2 paying users with monthly subscription ($19.99)
      await billingAnalyticsService.recordSubscriptionStarted(
        'circle-rev-1',
        'user-rev-1',
        'family_monthly',
        19.99
      );
      await billingAnalyticsService.recordPaymentSucceeded(
        'circle-rev-1',
        'user-rev-1',
        'family_monthly',
        19.99
      );

      await billingAnalyticsService.recordSubscriptionStarted(
        'circle-rev-2',
        'user-rev-2',
        'family_monthly',
        19.99
      );
      await billingAnalyticsService.recordPaymentSucceeded(
        'circle-rev-2',
        'user-rev-2',
        'family_monthly',
        19.99
      );

      const metrics = await billingAnalyticsService.getBusinessMetricsSummary(cohort);

      expect(metrics.arpu.payingUsersCount).toBe(2);
      expect(metrics.arpu.totalRevenueUsd).toBe(39.98);
      expect(metrics.arpu.arpuUsd).toBe(19.99);
    });
  });

  describe('Metric 4: SMS Cost Per User Per Month', () => {
    it('computes Twilio spend divided by active Family subscribers', async () => {
      // 2 active Family subscribers
      await billingAnalyticsService.recordSubscriptionStarted(
        'circle-sms-1',
        'user-sms-1',
        'family_monthly',
        19.99
      );
      await billingAnalyticsService.recordSubscriptionStarted(
        'circle-sms-2',
        'user-sms-2',
        'family_monthly',
        19.99
      );

      // Dispatch 10 SMS alerts at standard Twilio carrier rate ($0.0079)
      for (let i = 0; i < 10; i++) {
        await billingAnalyticsService.recordSmsDispatched('circle-sms-1', 0.0079, 2);
      }

      const metrics = await billingAnalyticsService.getBusinessMetricsSummary(cohort);

      expect(metrics.smsCostPerUser.totalTwilioSpendUsd).toBe(0.079);
      expect(metrics.smsCostPerUser.activeFamilyUsersCount).toBe(2);
      // Cost per user = $0.079 / 2 = $0.0395 -> rounded to $0.040
      expect(metrics.smsCostPerUser.costPerUserUsd).toBe(0.04);
    });

    it('records sms_dispatched during emergency Call for Help with zero PII', async () => {
      const result = await careCircleService.callForHelp(
        SEED_CARE_CIRCLE.id,
        'Eleanor'
      );

      expect(result.success).toBe(true);

      const events = analyticsService.getTrackedEvents();
      const smsEvents = events.filter((e) => e.event_name === 'sms_dispatched');
      expect(smsEvents.length).toBeGreaterThan(0);

      const lastSms = smsEvents[smsEvents.length - 1];
      expect(lastSms.properties.cost_usd).toBe(0.0079);
      expect(lastSms.properties.provider).toBe('twilio');
      expect(lastSms.properties.escalation_stage).toBe(2);

      // Confirm no phone numbers or recipient names in properties
      expect(lastSms.properties.phone).toBeUndefined();
      expect(lastSms.properties.recipient).toBeUndefined();
      expect(lastSms.properties.elder_name).toBeUndefined();
    });
  });

  describe('Metric 5: Activation = First Check-In Completed', () => {
    it('computes activation rate and average time-to-activate', async () => {
      // 4 circles created
      for (let i = 1; i <= 4; i++) {
        await analyticsService.track('circle_created', {
          cohort_month: cohort,
          initial_member_role: 'admin',
        });
      }

      // 2 circles complete their first check-in (TTA = 2 hours and 4 hours)
      await billingAnalyticsService.recordFirstCheckInCompleted(
        'circle-act-1',
        'user-1',
        7200 // 2 hours
      );
      await billingAnalyticsService.recordFirstCheckInCompleted(
        'circle-act-2',
        'user-2',
        14400 // 4 hours
      );

      const metrics = await billingAnalyticsService.getBusinessMetricsSummary(cohort);

      expect(metrics.activation.totalCircles).toBe(4);
      expect(metrics.activation.activatedCircles).toBe(2);
      expect(metrics.activation.activationRatePct).toBe(50.0); // 2 / 4 = 50%
      expect(metrics.activation.averageTimeToActivateHours).toBe(3.0); // (2 + 4) / 2 = 3.0h
    });

    it('triggers first_check_in_completed event when elder marks "I\'m OK" for the first time', async () => {
      // Record first check-in on seed care circle
      const res = await careCircleService.recordDailyCheckIn(
        SEED_CARE_CIRCLE.id,
        'elder-user-id',
        SEED_PROFILES[adminId],
        'All good today!'
      );

      expect(res.checkIn.status).toBe('ok');

      const events = analyticsService.getTrackedEvents();
      const firstCheckInEvent = events.find(
        (e) => e.event_name === 'first_check_in_completed'
      );

      expect(firstCheckInEvent).toBeDefined();
      expect(firstCheckInEvent?.properties.is_first_check_in).toBe(true);
      expect(typeof firstCheckInEvent?.properties.time_to_activate_seconds).toBe('number');
      expect(typeof firstCheckInEvent?.properties.time_to_activate_hours).toBe('number');

      // Verify zero PII in first check-in analytics event
      expect(firstCheckInEvent?.properties.notes).toBeUndefined();
      expect(firstCheckInEvent?.properties.elder_name).toBeUndefined();
    });
  });

  describe('Metric 6: Caregiver Invites Sent & Acceptance Rate', () => {
    it('computes invites per circle and invite-to-accept conversion percentage', async () => {
      // 2 circles created
      await analyticsService.track('circle_created', { cohort_month: cohort });
      await analyticsService.track('circle_created', { cohort_month: cohort });

      // 4 invites sent
      for (let i = 0; i < 4; i++) {
        await billingAnalyticsService.recordCaregiverInviteSent('circle-1', 'copy_code');
      }

      // 3 invites accepted
      for (let i = 0; i < 3; i++) {
        await billingAnalyticsService.recordCaregiverInviteAccepted('circle-1', 'viewer');
      }

      const metrics = await billingAnalyticsService.getBusinessMetricsSummary(cohort);

      expect(metrics.caregiverInvites.totalInvitesSent).toBe(4);
      expect(metrics.caregiverInvites.totalInvitesAccepted).toBe(3);
      expect(metrics.caregiverInvites.invitesPerCircle).toBe(2.0); // 4 / 2 = 2.0
      expect(metrics.caregiverInvites.inviteAcceptanceRatePct).toBe(75.0); // 3 / 4 = 75.0%
    });

    it('tracks caregiver_invite_accepted with zero PII when caregiver joins with code', async () => {
      const newCaregiver = {
        id: 'new-caregiver-id',
        email: 'caregiver@example.com',
        full_name: 'Dr. John Watson',
        avatar_url: null,
        created_at: new Date().toISOString(),
      };

      const joinResult = await careCircleService.joinCareCircleByCode(
        SEED_CARE_CIRCLE.invite_code,
        newCaregiver.id,
        newCaregiver
      );

      expect(joinResult.name).toBe(SEED_CARE_CIRCLE.name);

      const events = analyticsService.getTrackedEvents();
      const acceptEvent = events.find(
        (e) => e.event_name === 'caregiver_invite_accepted'
      );

      expect(acceptEvent).toBeDefined();
      expect(acceptEvent?.properties.role).toBe('viewer');

      // Strict Zero-PII check
      expect(acceptEvent?.properties.email).toBeUndefined();
      expect(acceptEvent?.properties.full_name).toBeUndefined();
      expect(acceptEvent?.properties.name).toBeUndefined();
    });
  });

  describe('Strict Zero-PII Policy Enforcement Across All Telemetry', () => {
    it('sanitizes and strips forbidden PII keys automatically', async () => {
      // Attempt to track event with accidental PII fields
      await analyticsService.track(
        'subscription_started',
        {
          plan_id: 'family_monthly',
          price_usd: 19.99,
          // Unintended PII fields
          email: 'user@example.com',
          phone: '+15555555555',
          name: 'Jane Doe',
          notes: 'Sensitive health notes',
        } as unknown as Record<string, string | number | boolean | null>,
        adminId,
        SEED_CARE_CIRCLE.id
      );

      // Verify billingAnalyticsService sanitizer
      await billingAnalyticsService.recordSubscriptionStarted(
        SEED_CARE_CIRCLE.id,
        adminId,
        'family_monthly',
        19.99
      );

      const events = analyticsService.getTrackedEvents();
      events.forEach((ev) => {
        const keys = Object.keys(ev.properties || {});
        expect(keys).not.toContain('email');
        expect(keys).not.toContain('phone');
        expect(keys).not.toContain('name');
        expect(keys).not.toContain('notes');
        expect(keys).not.toContain('elder_name');
        expect(keys).not.toContain('medication');
      });
    });
  });
});
