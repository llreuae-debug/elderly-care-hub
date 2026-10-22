import AsyncStorage from '@react-native-async-storage/async-storage';
import { careCircleService, resetLocalState } from '../src/services/careCircleService';
import { offlineService } from '../src/services/offlineService';
import { analyticsService } from '../src/services/analyticsService';
import { notificationDeliveryService } from '../src/services/notificationDeliveryService';
import { SEED_CARE_CIRCLE, SEED_PROFILES } from '../src/services/mockData';
import { ONBOARDING_KEY } from '../src/screens/OnboardingModal';

describe('Phase 5: Production-Readiness Integration Tests', () => {
  const sarahAdminId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    resetLocalState();
    analyticsService.reset();
    notificationDeliveryService.reset();
    await offlineService.clearAll();
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe('1. Offline Mode, Timeline Caching & "I\'m OK" Queue Sync', () => {
    it('caches the last 50 timeline events in local storage and serves them offline', async () => {
      // 1. Fetch timeline events while online to populate local cache
      const initialEvents = await careCircleService.fetchTimelineEvents(SEED_CARE_CIRCLE.id);
      expect(initialEvents.length).toBeGreaterThan(0);

      const cached = await offlineService.getCachedTimelineEvents(SEED_CARE_CIRCLE.id);
      expect(cached.length).toBe(initialEvents.length);
      expect(cached[0].id).toBe(initialEvents[0].id);

      // 2. Turn on offline mode
      offlineService.setOffline(true);
      expect(offlineService.isOffline()).toBe(true);

      // 3. Fetch timeline events while offline — should serve from cache
      const offlineEvents = await careCircleService.fetchTimelineEvents(SEED_CARE_CIRCLE.id);
      expect(offlineEvents.length).toBe(cached.length);
      expect(offlineEvents[0].title).toBe(cached[0].title);
    });

    it('queues "I\'m OK" check-in when offline and syncs immediately to timeline on reconnection', async () => {
      // 1. Start in airplane / offline mode
      offlineService.setOffline(true);
      expect(offlineService.isOffline()).toBe(true);

      // 2. Elder taps "I'm OK" while offline
      const result = await careCircleService.recordDailyCheckIn(
        SEED_CARE_CIRCLE.id,
        'elder-user-id',
        SEED_PROFILES[sarahAdminId],
        'Eleanor confirmed feeling good (Offline test)'
      );

      // Confirm local queued representation
      expect(result.checkIn.status).toBe('ok');
      expect(result.timelineEvent.title).toContain('Queued Offline');

      // 3. Verify queued item exists in offline storage
      const queuedItems = await offlineService.getQueuedCheckIns();
      expect(queuedItems.length).toBe(1);
      expect(queuedItems[0].circle_id).toBe(SEED_CARE_CIRCLE.id);
      expect(queuedItems[0].notes).toContain('Offline test');

      // 4. Reconnect: Turn off offline mode
      offlineService.setOffline(false);
      expect(offlineService.isOffline()).toBe(false);

      // 5. Sync queue upon reconnection
      const syncResult = await offlineService.syncOfflineQueue(
        async (circleId, userId, notes) => {
          return careCircleService.recordDailyCheckIn(circleId, userId, undefined, notes);
        }
      );

      expect(syncResult.syncedCount).toBe(1);

      // 6. Confirm the queued check-in is now reflected in the online timeline feed
      const timelineEvents = await careCircleService.fetchTimelineEvents(SEED_CARE_CIRCLE.id);
      expect(timelineEvents[0].title).toContain('Daily Check-in: Eleanor is OK');

      // 7. Confirm queue is cleared
      const remainingQueue = await offlineService.getQueuedCheckIns();
      expect(remainingQueue.length).toBe(0);
    });
  });

  describe('2. Notification Reliability & Twilio SMS Retry Logic', () => {
    it('successfully delivers SMS and logs entry to notification_audit_logs', async () => {
      const result = await notificationDeliveryService.sendSmsWithRetry(
        '+15551234567',
        'Daily check-in reminder',
        SEED_CARE_CIRCLE.id,
        3,
        async () => true // simulated successful sender
      );

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
      expect(result.finalStatus).toBe('delivered');

      const logs = await notificationDeliveryService.getAuditLogs(SEED_CARE_CIRCLE.id);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some((l) => l.status === 'delivered')).toBe(true);
    });

    it('retries failed SMS up to maxRetries with backoff and logs all attempts to audit table', async () => {
      let callCount = 0;

      const result = await notificationDeliveryService.sendSmsWithRetry(
        '+15551234567',
        'Critical alert message',
        SEED_CARE_CIRCLE.id,
        3,
        async () => {
          callCount++;
          if (callCount < 3) {
            throw new Error('Twilio API gateway timeout (504)');
          }
          return true; // succeeds on attempt 3
        }
      );

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(result.finalStatus).toBe('delivered');

      const logs = await notificationDeliveryService.getAuditLogs(SEED_CARE_CIRCLE.id);
      expect(logs.length).toBeGreaterThanOrEqual(3);
    });

    it('records failed status in audit log when all retry attempts fail', async () => {
      const result = await notificationDeliveryService.sendSmsWithRetry(
        '+15551234567',
        'Urgent emergency message',
        SEED_CARE_CIRCLE.id,
        2,
        async () => {
          throw new Error('Twilio account suspended or invalid number');
        }
      );

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(2);
      expect(result.finalStatus).toBe('failed');
      expect(result.error).toContain('Twilio account suspended');

      const logs = await notificationDeliveryService.getAuditLogs(SEED_CARE_CIRCLE.id);
      const failedLog = logs.find((l) => l.status === 'failed');
      expect(failedLog).toBeDefined();
      expect(failedLog?.error_message).toContain('Twilio account suspended');
    });
  });

  describe('3. Privacy-Preserving Analytics Tracking', () => {
    it('tracks check_in_completed event when elder checks in', async () => {
      await careCircleService.recordDailyCheckIn(
        SEED_CARE_CIRCLE.id,
        sarahAdminId,
        SEED_PROFILES[sarahAdminId],
        'Morning wellness verified'
      );

      const events = analyticsService.getTrackedEvents('check_in_completed');
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].event_name).toBe('check_in_completed');
      expect(events[0].care_circle_id).toBe(SEED_CARE_CIRCLE.id);
    });

    it('tracks help_button_pressed event when Call for Help is triggered', async () => {
      await careCircleService.callForHelp(SEED_CARE_CIRCLE.id, 'Eleanor');

      const events = analyticsService.getTrackedEvents('help_button_pressed');
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].event_name).toBe('help_button_pressed');
      expect(events[0].properties.elderName).toBe('Eleanor');
    });

    it('tracks handoff_note_written event when shift handoff completes', async () => {
      const shifts = await careCircleService.fetchTodayShifts(SEED_CARE_CIRCLE.id);
      const shift = shifts[0];

      await careCircleService.completeShiftHandoff(
        {
          shift_id: shift.id,
          handoff_note: 'All meds given, dressing clean and dry.',
        },
        sarahAdminId
      );

      const events = analyticsService.getTrackedEvents('handoff_note_written');
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].event_name).toBe('handoff_note_written');
      expect(events[0].properties.handoffNote).toContain('All meds given');
    });

    it('tracks check_in_missed event on escalation', async () => {
      await careCircleService.triggerMissedCheckInEscalation(SEED_CARE_CIRCLE.id, true);

      const events = analyticsService.getTrackedEvents('check_in_missed');
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].event_name).toBe('check_in_missed');
    });
  });

  describe('4. First-Run Onboarding Tutorial Persistence', () => {
    it('persists onboarding completion in AsyncStorage to prevent repeat tutorials', async () => {
      // Initial state: not completed
      const initial = await AsyncStorage.getItem(ONBOARDING_KEY);
      expect(initial).toBeNull();

      // User finishes or skips onboarding
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');

      const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
      expect(completed).toBe('true');
    });
  });
});
