import { careCircleService, resetLocalState } from '../src/services/careCircleService';
import {
  SEED_CARE_CIRCLE,
  SEED_MEDICATIONS,
  SEED_PROFILES,
} from '../src/services/mockData';
import { hashPin } from '../src/lib/crypto';

describe('Phase 3: Elder Mode, 4-Digit PIN Auth & Caregiver Permissions Enforcement', () => {
  const sarahAdminId = '11111111-1111-1111-1111-111111111111'; // Admin
  const marcusViewerId = '22222222-2222-2222-2222-222222222222'; // Viewer

  beforeEach(() => {
    resetLocalState();
    jest.clearAllMocks();
  });

  describe('1. Elder 4-Digit PIN Authentication', () => {
    it('hashes the 4-digit PIN with SHA-256 and never stores or compares plaintext', async () => {
      const hashed = await hashPin('1234');
      expect(hashed).toBe('03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4');
      expect(hashed).not.toBe('1234');
    });

    it('successfully logs in elder with valid 4-digit PIN and returns elder session', async () => {
      const session = await careCircleService.loginElderWithPin('CARE01', '1234');

      expect(session).toBeDefined();
      expect(session.circle_id).toBe(SEED_CARE_CIRCLE.id);
      expect(session.elder_name).toBe('Eleanor');
      expect(session.circle_name).toBe(SEED_CARE_CIRCLE.name);
      expect(session.invite_code).toBe('CARE01');
    });

    it('rejects incorrect 4-digit PIN', async () => {
      await expect(
        careCircleService.loginElderWithPin('CARE01', '9999')
      ).rejects.toThrow('Incorrect 4-digit PIN for this Care Circle.');
    });

    it('rejects invalid non-4-digit input', async () => {
      await expect(
        careCircleService.loginElderWithPin('CARE01', '123')
      ).rejects.toThrow('PIN must be exactly 4 numeric digits.');

      await expect(
        careCircleService.loginElderWithPin('CARE01', '12345')
      ).rejects.toThrow('PIN must be exactly 4 numeric digits.');

      await expect(
        careCircleService.loginElderWithPin('CARE01', 'abcd')
      ).rejects.toThrow('PIN must be exactly 4 numeric digits.');
    });

    it('rejects invalid care circle code', async () => {
      await expect(
        careCircleService.loginElderWithPin('UNKNOWN', '1234')
      ).rejects.toThrow('Invalid Care Circle code.');
    });
  });

  describe('2. Elder Mode Core Actions', () => {
    it('allows elder to tap "I\'m OK" and records check-in to timeline', async () => {
      const session = await careCircleService.loginElderWithPin('CARE01', '1234');
      const sarah = SEED_PROFILES[sarahAdminId];
      const result = await careCircleService.recordDailyCheckIn(
        session.circle_id,
        'elder-user-id',
        sarah,
        'Checked in via Elder Mode ("I\'m OK" button)'
      );

      expect(result.checkIn.status).toBe('ok');
      expect(result.timelineEvent).toBeDefined();
      expect(result.timelineEvent.title).toContain("Eleanor is OK");

      const todayCheckIn = await careCircleService.fetchTodayCheckIn(session.circle_id);
      expect(todayCheckIn?.status).toBe('ok');
    });

    it('allows elder to view "My meds today" in read-only mode', async () => {
      const session = await careCircleService.loginElderWithPin('CARE01', '1234');
      const meds = await careCircleService.fetchMedications(session.circle_id);

      expect(meds.length).toBeGreaterThan(0);
      meds.forEach((med) => {
        expect(med.name).toBeDefined();
        expect(med.dosage).toBeDefined();
        expect(Array.isArray(med.schedule)).toBe(true);
      });
    });

    it('triggers "Call for help" creating a high-priority timeline event and dispatching SMS alert', async () => {
      const session = await careCircleService.loginElderWithPin('CARE01', '1234');
      const emergency = await careCircleService.callForHelp(session.circle_id, session.elder_name);

      expect(emergency.success).toBe(true);
      expect(emergency.timelineEvent).toBeDefined();
      expect(emergency.timelineEvent.title).toContain('🚨 EMERGENCY: Eleanor called for help!');
      expect(emergency.message).toContain('Emergency alert dispatched via Push & SMS');

      // Verify the high-priority event is present at the top of timeline
      const events = await careCircleService.fetchTimelineEvents(session.circle_id);
      expect(events[0].id).toBe(emergency.timelineEvent.id);
      expect(events[0].title).toContain('EMERGENCY');
    });
  });

  describe('3. Caregiver Permissions Enforcement (Server-Side RLS)', () => {
    describe('Admin Permissions', () => {
      it('allows Admin (Sarah) to add new medications', async () => {
        const newMed = await careCircleService.createMedication(
          {
            care_circle_id: SEED_CARE_CIRCLE.id,
            name: 'Atorvastatin',
            dosage: '20mg',
            schedule: ['21:00'],
            instructions: 'Take before bed',
          },
          SEED_CARE_CIRCLE.id,
          sarahAdminId
        );

        expect(newMed.id).toBeDefined();
        expect(newMed.name).toBe('Atorvastatin');
      });

      it('allows Admin (Sarah) to edit medications', async () => {
        const targetMed = SEED_MEDICATIONS[0];
        const updated = await careCircleService.updateMedication(
          targetMed.id,
          { dosage: '20mg', instructions: 'Increased dose by doctor' },
          SEED_CARE_CIRCLE.id,
          sarahAdminId
        );

        expect(updated.dosage).toBe('20mg');
        expect(updated.instructions).toBe('Increased dose by doctor');
      });

      it('allows Admin (Sarah) to change circle settings', async () => {
        const updatedCircle = await careCircleService.updateCareCircleSettings(
          SEED_CARE_CIRCLE.id,
          { check_in_deadline_time: '11:00', primary_caregiver_phone: '+15559876543' },
          sarahAdminId
        );

        expect(updatedCircle.check_in_deadline_time).toBe('11:00');
        expect(updatedCircle.primary_caregiver_phone).toBe('+15559876543');
      });

      it('allows Admin (Sarah) to remove circle members', async () => {
        await careCircleService.removeMember(
          SEED_CARE_CIRCLE.id,
          marcusViewerId,
          sarahAdminId
        );

        const members = await careCircleService.fetchCircleMembers(SEED_CARE_CIRCLE.id);
        expect(members.some((m) => m.user_id === marcusViewerId)).toBe(false);
      });
    });

    describe('Viewer Permissions (Read-Only Enforcement)', () => {
      it('allows Viewer (Dr. Marcus) to read timeline, meds, and check-in status', async () => {
        const events = await careCircleService.fetchTimelineEvents(SEED_CARE_CIRCLE.id);
        const meds = await careCircleService.fetchMedications(SEED_CARE_CIRCLE.id);
        const checkIn = await careCircleService.fetchTodayCheckIn(SEED_CARE_CIRCLE.id);

        expect(events.length).toBeGreaterThan(0);
        expect(meds.length).toBeGreaterThan(0);
        expect(checkIn).toBeDefined();
      });

      it('REJECTS Viewer (Dr. Marcus) from adding medications via RLS enforcement', async () => {
        await expect(
          careCircleService.createMedication(
            {
              care_circle_id: SEED_CARE_CIRCLE.id,
              name: 'Unauthorized Drug',
              dosage: '500mg',
              schedule: ['10:00'],
            },
            SEED_CARE_CIRCLE.id,
            marcusViewerId
          )
        ).rejects.toThrow(/Permission denied: Only Care Circle Admins can add or edit medications/);
      });

      it('REJECTS Viewer (Dr. Marcus) from editing existing medications via RLS enforcement', async () => {
        const targetMed = SEED_MEDICATIONS[0];
        await expect(
          careCircleService.updateMedication(
            targetMed.id,
            { dosage: '999mg' },
            SEED_CARE_CIRCLE.id,
            marcusViewerId
          )
        ).rejects.toThrow(/Permission denied: Only Care Circle Admins can edit medications/);
      });

      it('REJECTS Viewer (Dr. Marcus) from changing circle settings via RLS enforcement', async () => {
        await expect(
          careCircleService.updateCareCircleSettings(
            SEED_CARE_CIRCLE.id,
            { check_in_deadline_time: '07:00' },
            marcusViewerId
          )
        ).rejects.toThrow(/Permission denied: Only Care Circle Admins can change settings/);
      });

      it('REJECTS Viewer (Dr. Marcus) from removing members via RLS enforcement', async () => {
        await expect(
          careCircleService.removeMember(
            SEED_CARE_CIRCLE.id,
            sarahAdminId,
            marcusViewerId
          )
        ).rejects.toThrow(/Permission denied: Only Care Circle Admins can remove members/);
      });
    });
  });
});
