import { careCircleService, resetLocalState } from '../src/services/careCircleService';
import { SEED_CARE_CIRCLE } from '../src/services/mockData';

describe('Care Circle Integration Tests', () => {
  beforeEach(() => {
    resetLocalState();
  });

  it('fetches existing seed care circle for registered member', async () => {
    const sarahId = '11111111-1111-1111-1111-111111111111';
    const circles = await careCircleService.fetchUserCircles(sarahId);

    expect(circles.length).toBeGreaterThanOrEqual(1);
    expect(circles.some((c) => c.name === 'Eleanor Vance Care Circle')).toBe(true);
  });

  it('verifies seed care circle has exactly two members with appropriate roles (admin and viewer)', async () => {
    const members = await careCircleService.fetchCircleMembers(SEED_CARE_CIRCLE.id);

    expect(members.length).toBe(2);

    const admin = members.find((m) => m.role === 'admin');
    const viewer = members.find((m) => m.role === 'viewer');

    expect(admin).toBeDefined();
    expect(admin?.profile?.full_name).toBe('Sarah Vance (Daughter)');

    expect(viewer).toBeDefined();
    expect(viewer?.profile?.full_name).toBe('Dr. Marcus Chen (Home Nurse)');
  });

  it('creates a new care circle and assigns creator as admin', async () => {
    const newUserId = 'test-creator-123';
    const circleName = 'Grandpa Joseph Care Circle';

    const circle = await careCircleService.createCareCircle(circleName, newUserId);

    expect(circle.id).toBeDefined();
    expect(circle.name).toBe(circleName);
    expect(circle.invite_code).toHaveLength(6);

    const members = await careCircleService.fetchCircleMembers(circle.id);
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe('admin');
    expect(members[0].user_id).toBe(newUserId);
  });

  it('allows another caregiver to join a care circle using the 6-character invite code', async () => {
    const newMemberId = 'new-caregiver-456';
    const inviteCode = SEED_CARE_CIRCLE.invite_code; // 'CARE01'

    const joinedCircle = await careCircleService.joinCareCircleByCode(inviteCode, newMemberId);

    expect(joinedCircle.id).toBe(SEED_CARE_CIRCLE.id);

    const members = await careCircleService.fetchCircleMembers(joinedCircle.id);
    const newMember = members.find((m) => m.user_id === newMemberId);

    expect(newMember).toBeDefined();
    expect(newMember?.role).toBe('viewer');
  });

  it('rejects invalid invite code gracefully', async () => {
    await expect(
      careCircleService.joinCareCircleByCode('INVALID99', 'user-xyz')
    ).rejects.toThrow('Invalid invite code');
  });
});
