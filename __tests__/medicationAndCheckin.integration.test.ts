import { careCircleService, resetLocalState } from '../src/services/careCircleService';
import {
  SEED_CARE_CIRCLE,
  SEED_MEDICATIONS,
  SEED_PROFILES,
} from '../src/services/mockData';
import { notificationService } from '../src/services/notificationService';

describe('Phase 2: Medication Reminders & Daily Check-in Integration Tests', () => {
  beforeEach(() => {
    resetLocalState();
    jest.clearAllMocks();
  });

  describe('1. Medication Model & Schedules', () => {
    it('fetches seeded medications with name, dosage, schedule, and assigned caregiver', async () => {
      const meds = await careCircleService.fetchMedications(SEED_CARE_CIRCLE.id);

      expect(meds.length).toBeGreaterThanOrEqual(3);

      const lisinopril = meds.find((m) => m.name === 'Lisinopril');
      expect(lisinopril).toBeDefined();
      expect(lisinopril?.dosage).toBe('10mg');
      expect(lisinopril?.schedule).toContain('08:00');
      expect(lisinopril?.assigned_to).toBe('11111111-1111-1111-1111-111111111111'); // Sarah

      const metoprolol = meds.find((m) => m.name === 'Metoprolol Tartrate');
      expect(metoprolol).toBeDefined();
      expect(metoprolol?.schedule).toEqual(['08:00', '20:00']);
      expect(metoprolol?.assigned_to).toBe('22222222-2222-2222-2222-222222222222'); // Dr. Marcus
    });

    it('creates a new medication with validation for schedule and dosage', async () => {
      const newMed = await careCircleService.createMedication(
        {
          care_circle_id: SEED_CARE_CIRCLE.id,
          name: 'Aspirin Low Dose',
          dosage: '81mg',
          schedule: ['09:00'],
          instructions: 'Take with morning juice',
        },
        SEED_CARE_CIRCLE.id
      );

      expect(newMed.id).toBeDefined();
      expect(newMed.name).toBe('Aspirin Low Dose');
      expect(newMed.schedule).toEqual(['09:00']);

      const allMeds = await careCircleService.fetchMedications(SEED_CARE_CIRCLE.id);
      expect(allMeds.some((m) => m.id === newMed.id)).toBe(true);
    });
  });

  describe('2. Medication Reminders & Action Logging', () => {
    it('schedules a local push notification 2 minutes out for medication reminder', async () => {
      const med = SEED_MEDICATIONS[0];
      const notifId = await notificationService.scheduleMedicationReminder(med, '08:00', 120);

      expect(notifId).toBeDefined();
      const active = notificationService.getActiveScheduledNotifications();
      expect(active.length).toBeGreaterThanOrEqual(1);

      const scheduled = active.find((n) => n.id === notifId);
      expect(scheduled?.title).toContain('Lisinopril');
      expect(scheduled?.triggerSeconds).toBe(120);
    });

    it('marks medication as Taken and automatically logs a med event to the timeline', async () => {
      const sarah = SEED_PROFILES['11111111-1111-1111-1111-111111111111'];
      const med = SEED_MEDICATIONS[2]; // Vitamin D3 (12:00)

      const result = await careCircleService.logMedicationAction(
        med.id,
        '12:00',
        'taken',
        SEED_CARE_CIRCLE.id,
        sarah.id,
        sarah,
        'Given after lunch'
      );

      expect(result.log.status).toBe('taken');
      expect(result.log.scheduled_time).toBe('12:00');
      expect(result.timelineEvent).toBeDefined();
      expect(result.timelineEvent.type).toBe('med');
      expect(result.timelineEvent.title).toContain('Vitamin D3');
      expect(result.timelineEvent.title).toContain('Taken');

      // Verify timeline feed reflection
      const timelineEvents = await careCircleService.fetchTimelineEvents(SEED_CARE_CIRCLE.id);
      expect(timelineEvents[0].id).toBe(result.timelineEvent.id);
    });

    it('marks medication as Skipped and logs warning to the timeline', async () => {
      const marcus = SEED_PROFILES['22222222-2222-2222-2222-222222222222'];
      const med = SEED_MEDICATIONS[1]; // Metoprolol (20:00)

      const result = await careCircleService.logMedicationAction(
        med.id,
        '20:00',
        'skipped',
        SEED_CARE_CIRCLE.id,
        marcus.id,
        marcus,
        'Elder resting, skipped per care plan'
      );

      expect(result.log.status).toBe('skipped');
      expect(result.timelineEvent.title).toContain('Skipped');
      expect(result.timelineEvent.description).toContain('skipped per care plan');
    });
  });

  describe("3. Daily Check-in (Elder / Caregiver 'I’m OK')", () => {
    it('records daily check-in as ok and logs Eleanor is OK to the timeline', async () => {
      const sarah = SEED_PROFILES['11111111-1111-1111-1111-111111111111'];

      const result = await careCircleService.recordDailyCheckIn(
        SEED_CARE_CIRCLE.id,
        sarah.id,
        sarah,
        'Eleanor is in great spirits and had breakfast'
      );

      expect(result.checkIn.status).toBe('ok');
      expect(result.checkIn.escalation_stage).toBe(0);
      expect(result.timelineEvent.title).toContain("Daily Check-in: Eleanor is OK");

      const todayCheckIn = await careCircleService.fetchTodayCheckIn(SEED_CARE_CIRCLE.id);
      expect(todayCheckIn?.status).toBe('ok');
    });
  });

  describe('4. Missed Check-in Escalation (Push & Twilio SMS)', () => {
    it('triggers stage 1 push notification alert when check-in is overdue', async () => {
      // Clear today check-in to simulate missed check-in
      resetLocalState();

      const escalation = await careCircleService.triggerMissedCheckInEscalation(
        SEED_CARE_CIRCLE.id,
        false
      );

      expect(escalation.pushSent).toBe(true);
      expect(escalation.smsSent).toBe(false);
      expect(escalation.stage).toBe(1);

      // Verify timeline warning event logged
      const timelineEvents = await careCircleService.fetchTimelineEvents(SEED_CARE_CIRCLE.id);
      expect(timelineEvents[0].title).toContain('Missed Daily Check-in');
    });

    it('escalates to stage 2 Twilio SMS after 30-minute escalation window or forced escalation', async () => {
      const escalation = await careCircleService.triggerMissedCheckInEscalation(
        SEED_CARE_CIRCLE.id,
        true
      );

      expect(escalation.pushSent).toBe(true);
      expect(escalation.smsSent).toBe(true);
      expect(escalation.stage).toBe(2);
      expect(escalation.message).toContain('SMS sent via Twilio');

      // Verify emergency escalation logged to timeline
      const timelineEvents = await careCircleService.fetchTimelineEvents(SEED_CARE_CIRCLE.id);
      expect(timelineEvents[0].title).toContain('Emergency Escalation: SMS Dispatched');
      expect(timelineEvents[0].description).toContain('+15551234567');
    });
  });
});
