import { careCircleService } from '../src/services/careCircleService';
import { SEED_PROFILES } from '../src/services/mockData';

describe('Auth Integration Tests (Caregiver Magic Link)', () => {
  it('rejects empty or malformed email addresses', async () => {
    const emptyResult = await careCircleService.sendMagicLink('');
    expect(emptyResult.success).toBe(false);
    expect(emptyResult.error).toBe('Invalid email');

    const invalidResult = await careCircleService.sendMagicLink('not-an-email');
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.error).toBe('Invalid email');
  });

  it('sends magic link successfully for valid caregiver email', async () => {
    const validEmail = 'sarah.vance@example.com';
    const result = await careCircleService.sendMagicLink(validEmail);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Magic link sent');
  });

  it('provides seed user profiles for testing without password friction', () => {
    const sarah = SEED_PROFILES['11111111-1111-1111-1111-111111111111'];
    const marcus = SEED_PROFILES['22222222-2222-2222-2222-222222222222'];

    expect(sarah).toBeDefined();
    expect(sarah.full_name).toBe('Sarah Vance (Daughter)');
    expect(sarah.email).toBe('sarah.vance@example.com');

    expect(marcus).toBeDefined();
    expect(marcus.full_name).toBe('Dr. Marcus Chen (Home Nurse)');
    expect(marcus.email).toBe('marcus.chen@example.com');
  });
});
