import { careCircleService, resetLocalState } from '../src/services/careCircleService';
import {
  SEED_CARE_CIRCLE,
  SEED_SHIFTS,
  SEED_SHIFT_TASKS,
} from '../src/services/mockData';

describe('Phase 4: Caregiver Shift Handoff, Checklists & Coverage Integration Tests', () => {
  const sarahAdminId = '11111111-1111-1111-1111-111111111111'; // Admin
  const marcusViewerId = '22222222-2222-2222-2222-222222222222'; // Viewer

  beforeEach(() => {
    resetLocalState();
    jest.clearAllMocks();
  });

  describe('1. Shift Model & Admin Assignment Permissions (RLS)', () => {
    it('fetches seeded today shifts with assigned caregivers and shift tasks', async () => {
      const shifts = await careCircleService.fetchTodayShifts(SEED_CARE_CIRCLE.id);

      expect(shifts.length).toBeGreaterThanOrEqual(2);
      expect(shifts[0].caregiver_id).toBe(sarahAdminId);
      expect(shifts[0].start_time).toBe('08:00');
      expect(shifts[0].end_time).toBe('14:00');
      expect(shifts[0].tasks?.length).toBeGreaterThanOrEqual(3);

      expect(shifts[1].caregiver_id).toBe(marcusViewerId);
      expect(shifts[1].start_time).toBe('14:00');
      expect(shifts[1].end_time).toBe('20:00');
    });

    it('allows Admin (Sarah) to schedule and assign a new shift with checklist tasks', async () => {
      const newShift = await careCircleService.createShift(
        {
          care_circle_id: SEED_CARE_CIRCLE.id,
          caregiver_id: sarahAdminId,
          date: new Date().toISOString().split('T')[0],
          start_time: '20:00',
          end_time: '23:30',
          initial_tasks: ['Night vitals check', 'Ensure front door locked'],
        },
        sarahAdminId
      );

      expect(newShift.id).toBeDefined();
      expect(newShift.start_time).toBe('20:00');
      expect(newShift.end_time).toBe('23:30');
      expect(newShift.tasks?.length).toBe(2);
      expect(newShift.tasks?.[0].title).toBe('Night vitals check');

      const allShifts = await careCircleService.fetchTodayShifts(SEED_CARE_CIRCLE.id);
      expect(allShifts.some((s) => s.id === newShift.id)).toBe(true);
    });

    it('REJECTS Viewer (Dr. Marcus) from creating or assigning shifts via RLS enforcement', async () => {
      await expect(
        careCircleService.createShift(
          {
            care_circle_id: SEED_CARE_CIRCLE.id,
            caregiver_id: marcusViewerId,
            date: new Date().toISOString().split('T')[0],
            start_time: '20:00',
            end_time: '23:00',
          },
          marcusViewerId
        )
      ).rejects.toThrow(/Permission denied: Only Care Circle Admins can create or assign shifts/);
    });

    it('allows Admin to delete shifts, but REJECTS Viewer from deleting shifts', async () => {
      // Viewer attempt
      await expect(
        careCircleService.deleteShift('shift-002', SEED_CARE_CIRCLE.id, marcusViewerId)
      ).rejects.toThrow(/Permission denied: Only Care Circle Admins can delete shifts/);

      // Admin attempt
      await careCircleService.deleteShift('shift-002', SEED_CARE_CIRCLE.id, sarahAdminId);
      const shifts = await careCircleService.fetchTodayShifts(SEED_CARE_CIRCLE.id);
      expect(shifts.some((s) => s.id === 'shift-002')).toBe(false);
    });
  });

  describe('2. Today Coverage View & Gap Warnings', () => {
    it('identifies who is responsible right now and who is next in coverage', async () => {
      const coverage = await careCircleService.fetchCoverageStatus(SEED_CARE_CIRCLE.id);

      expect(coverage.allTodayShifts.length).toBeGreaterThanOrEqual(2);
      // Either currentShift is active or nextShift is upcoming
      expect(coverage.currentShift || coverage.nextShift).toBeDefined();

      if (coverage.currentShift && coverage.nextShift) {
        expect(coverage.currentShift.id).not.toBe(coverage.nextShift.id);
        expect(coverage.nextShift.start_time >= coverage.currentShift.end_time).toBe(true);
      }
    });

    it('displays a coverage warning when there is an unassigned gap between shifts', async () => {
      // Clear shifts and add a morning shift (08:00 - 12:00) and evening shift (16:00 - 20:00) with a 4-hour gap
      await careCircleService.deleteShift('shift-001', SEED_CARE_CIRCLE.id, sarahAdminId);
      await careCircleService.deleteShift('shift-002', SEED_CARE_CIRCLE.id, sarahAdminId);

      await careCircleService.createShift(
        {
          care_circle_id: SEED_CARE_CIRCLE.id,
          caregiver_id: sarahAdminId,
          date: new Date().toISOString().split('T')[0],
          start_time: '08:00',
          end_time: '12:00',
        },
        sarahAdminId
      );

      await careCircleService.createShift(
        {
          care_circle_id: SEED_CARE_CIRCLE.id,
          caregiver_id: marcusViewerId,
          date: new Date().toISOString().split('T')[0],
          start_time: '16:00',
          end_time: '20:00',
        },
        sarahAdminId
      );

      const coverage = await careCircleService.fetchCoverageStatus(SEED_CARE_CIRCLE.id);
      expect(coverage.hasCoverageGap).toBe(true);
      expect(coverage.gapMessage).toBeDefined();
    });

    it('warns when no caregiver coverage is scheduled for today', async () => {
      await careCircleService.deleteShift('shift-001', SEED_CARE_CIRCLE.id, sarahAdminId);
      await careCircleService.deleteShift('shift-002', SEED_CARE_CIRCLE.id, sarahAdminId);

      const coverage = await careCircleService.fetchCoverageStatus(SEED_CARE_CIRCLE.id);
      expect(coverage.hasCoverageGap).toBe(true);
      expect(coverage.gapMessage).toContain('No caregiver coverage scheduled for today');
      expect(coverage.currentShift).toBeNull();
      expect(coverage.nextShift).toBeNull();
    });
  });

  describe('3. Shift Task Checklist & Caregiver Isolation (RLS)', () => {
    it('allows assigned caregiver (Sarah) to check off task on her own shift', async () => {
      const task = SEED_SHIFT_TASKS.find((t) => t.shift_id === 'shift-001' && !t.completed);
      expect(task).toBeDefined();

      const updated = await careCircleService.toggleShiftTask(
        task!.id,
        true,
        'shift-001',
        sarahAdminId
      );

      expect(updated.completed).toBe(true);
      expect(updated.completed_by).toBe(sarahAdminId);
      expect(updated.completed_at).toBeDefined();
    });

    it('REJECTS non-assigned caregiver (Dr. Marcus) from editing Sarah shift checklist', async () => {
      const task = SEED_SHIFT_TASKS.find((t) => t.shift_id === 'shift-001');
      expect(task).toBeDefined();

      await expect(
        careCircleService.toggleShiftTask(
          task!.id,
          true,
          'shift-001',
          marcusViewerId // Marcus is NOT assigned to shift-001 and is NOT an admin
        )
      ).rejects.toThrow(/Permission denied: Only the assigned caregiver can edit their shift checklist/);
    });

    it('ensures tasks belong strictly to their specific shift and do not persist across other shifts', async () => {
      const shifts = await careCircleService.fetchTodayShifts(SEED_CARE_CIRCLE.id);
      const shift1 = shifts.find((s) => s.id === 'shift-001');
      const shift2 = shifts.find((s) => s.id === 'shift-002');

      expect(shift1?.tasks).toBeDefined();
      expect(shift2?.tasks).toBeDefined();

      // Verify task IDs are disjoint
      const shift1TaskIds = new Set(shift1?.tasks?.map((t) => t.id));
      shift2?.tasks?.forEach((t) => {
        expect(shift1TaskIds.has(t.id)).toBe(false);
      });
    });
  });

  describe('4. Shift Handoff Flow: End Shift, Note, Timeline & Immediate Notification', () => {
    it('ends first shift, writes handoff note, and notifies second caregiver immediately', async () => {
      // 1. Verify two back-to-back shifts exist
      const initialShifts = await careCircleService.fetchTodayShifts(SEED_CARE_CIRCLE.id);
      expect(initialShifts.length).toBeGreaterThanOrEqual(2);
      const firstShift = initialShifts[0]; // Sarah 08:00 - 14:00
      const secondShift = initialShifts[1]; // Marcus 14:00 - 20:00

      expect(firstShift.end_time).toBe(secondShift.start_time); // Back to back!

      // 2. Sarah ends first shift with a detailed handoff note
      const handoffResult = await careCircleService.completeShiftHandoff(
        {
          shift_id: firstShift.id,
          handoff_note:
            'Eleanor ate oatmeal and took Lisinopril. Knee surgical dressing was changed and is clean with no redness. Enjoyed garden walk.',
        },
        sarahAdminId
      );

      // 3. Verify shift status is completed and handoff saved
      expect(handoffResult.shift.status).toBe('completed');
      expect(handoffResult.shift.handoff_note).toContain('Knee surgical dressing was changed');
      expect(handoffResult.shift.handoff_completed_at).toBeDefined();
      expect(handoffResult.nextCaregiverNotified).toBe(true);

      // 4. Verify high-visibility timeline event was created for the handoff
      expect(handoffResult.timelineEvent).toBeDefined();
      expect(handoffResult.timelineEvent.title).toContain('Shift Handoff: Sarah → Dr.');
      expect(handoffResult.timelineEvent.description).toContain('Knee surgical dressing');

      // 5. Confirm second caregiver (Dr. Marcus) immediately sees the handoff note in the timeline
      const timelineEvents = await careCircleService.fetchTimelineEvents(SEED_CARE_CIRCLE.id);
      expect(timelineEvents[0].id).toBe(handoffResult.timelineEvent.id);
      expect(timelineEvents[0].title).toContain('Shift Handoff');

      // 6. Confirm second caregiver sees updated coverage status immediately
      const updatedCoverage = await careCircleService.fetchCoverageStatus(SEED_CARE_CIRCLE.id);
      const updatedFirstShift = updatedCoverage.allTodayShifts.find((s) => s.id === firstShift.id);
      expect(updatedFirstShift?.status).toBe('completed');
      expect(updatedFirstShift?.handoff_note).toBeDefined();
    });

    it('supports "Nothing to report" option in handoff note', async () => {
      const shifts = await careCircleService.fetchTodayShifts(SEED_CARE_CIRCLE.id);
      const shift = shifts[0];

      const result = await careCircleService.completeShiftHandoff(
        {
          shift_id: shift.id,
          nothing_to_report: true,
        },
        sarahAdminId
      );

      expect(result.shift.status).toBe('completed');
      expect(result.shift.handoff_nothing_to_report).toBe(true);
      expect(result.shift.handoff_note).toContain('Nothing to report');
      expect(result.timelineEvent.description).toContain('Nothing to report');
    });

    it('REJECTS unassigned caregiver from completing another caregiver handoff', async () => {
      await expect(
        careCircleService.completeShiftHandoff(
          {
            shift_id: 'shift-001', // Sarah's shift
            handoff_note: 'Unauthorized attempt',
          },
          marcusViewerId // Marcus is not assigned to shift-001 and not an admin
        )
      ).rejects.toThrow(/Permission denied: Only the assigned caregiver can complete shift handoff/);
    });
  });
});
