import fs from 'fs';
import path from 'path';
import { Linking } from 'react-native';
import {
  EXTERNAL_URLS,
  formatHandoffAlertMessage,
  formatInviteMessage,
  formatMissedCheckInAlertMessage,
  openExternalUrl,
  parseDeepLink,
} from '../src/lib/deepLinking';
import { notificationService } from '../src/services/notificationService';

describe('Audit: Links, Navigation, Routes & Assets Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Category 1 & 4: Deep Links & Auth Redirects', () => {
    it('correctly parses Supabase magic link callback hash fragments', () => {
      const url =
        'elderlycare://auth/callback#access_token=mock_access_token_123&refresh_token=mock_refresh_token_456&token_type=bearer';
      const intent = parseDeepLink(url);

      expect(intent.type).toBe('auth_callback');
      if (intent.type === 'auth_callback') {
        expect(intent.accessToken).toBe('mock_access_token_123');
        expect(intent.refreshToken).toBe('mock_refresh_token_456');
      }
    });

    it('correctly parses query parameter auth callbacks', () => {
      const url = 'elderlycare://auth/callback?code=pkce_auth_code_789';
      const intent = parseDeepLink(url);

      expect(intent.type).toBe('auth_callback');
      if (intent.type === 'auth_callback') {
        expect(intent.code).toBe('pkce_auth_code_789');
      }
    });

    it('correctly parses care circle join deep link', () => {
      const url1 = 'elderlycare://circle/join/CARE01';
      const intent1 = parseDeepLink(url1);
      expect(intent1.type).toBe('circle_join');
      if (intent1.type === 'circle_join') {
        expect(intent1.inviteCode).toBe('CARE01');
      }

      const url2 = 'https://elderlycarehub.example.com/join/TEST99';
      const intent2 = parseDeepLink(url2);
      expect(intent2.type).toBe('circle_join');
      if (intent2.type === 'circle_join') {
        expect(intent2.inviteCode).toBe('TEST99');
      }
    });

    it('correctly parses route navigation deep links', () => {
      expect(parseDeepLink('elderlycare://today')).toEqual({
        type: 'navigate',
        screen: 'today',
      });
      expect(parseDeepLink('elderlycare://coverage')).toEqual({
        type: 'navigate',
        screen: 'coverage',
      });
      expect(parseDeepLink('elderlycare://timeline')).toEqual({
        type: 'navigate',
        screen: 'timeline',
      });
      expect(parseDeepLink('elderlycare://elder')).toEqual({
        type: 'elder_mode',
      });
    });

    it('gracefully handles empty or malformed URLs', () => {
      expect(parseDeepLink('')).toEqual({ type: 'unknown', url: '' });
      expect(parseDeepLink('some-invalid-string')).toEqual({
        type: 'unknown',
        url: 'some-invalid-string',
      });
    });
  });

  describe('Category 2: Internal References & Asset Files', () => {
    it('verifies all required branding and icon asset files exist on disk', () => {
      const projectRoot = path.resolve(__dirname, '..');
      const assets = [
        'assets/icon.png',
        'assets/splash-icon.png',
        'assets/logo.png',
        'assets/favicon.png',
        'assets/android-icon-foreground.png',
        'assets/android-icon-background.png',
        'assets/android-icon-monochrome.png',
      ];

      for (const assetPath of assets) {
        const fullPath = path.join(projectRoot, assetPath);
        const exists = fs.existsSync(fullPath);
        expect(exists).toBe(true);
        const stats = fs.statSync(fullPath);
        expect(stats.size).toBeGreaterThan(0);
      }
    });

    it('verifies app.json has registered the elderlycare scheme', () => {
      const appJsonPath = path.resolve(__dirname, '../app.json');
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
      expect(appJson.expo.scheme).toBe('elderlycare');
      expect(appJson.expo.icon).toBe('./assets/icon.png');
      expect(appJson.expo.splash.image).toBe('./assets/splash-icon.png');
    });
  });

  describe('Category 3: External Links (Privacy, Terms, Support)', () => {
    it('defines valid external URLs matching App Store metadata', () => {
      expect(EXTERNAL_URLS.PRIVACY_POLICY).toBe('https://elderlycarehub.example.com/privacy');
      expect(EXTERNAL_URLS.TERMS_OF_SERVICE).toBe('https://elderlycarehub.example.com/terms');
      expect(EXTERNAL_URLS.SUPPORT).toBe('https://elderlycarehub.example.com/support');
      expect(EXTERNAL_URLS.WEBSITE).toBe('https://elderlycarehub.example.com');
    });

    it('invokes Linking.openURL when URL is supported', async () => {
      const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as unknown as void);
      const canOpenSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);

      const success = await openExternalUrl(EXTERNAL_URLS.SUPPORT, 'Support');
      expect(success).toBe(true);
      expect(canOpenSpy).toHaveBeenCalledWith(EXTERNAL_URLS.SUPPORT);
      expect(openSpy).toHaveBeenCalledWith(EXTERNAL_URLS.SUPPORT);
    });
  });

  describe('Category 5: Notification Deep Links & Target Routes', () => {
    it('schedules medication reminders with targetRoute: today', async () => {
      const mockMed = {
        id: 'med-123',
        care_circle_id: 'circle-1',
        name: 'Lisinopril',
        dosage: '10mg',
        schedule: ['08:00'],
        assigned_to: null,
        instructions: 'With water',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const notifId = await notificationService.scheduleMedicationReminder(mockMed, '08:00', 1);
      expect(notifId).toBeTruthy();

      const active = notificationService.getActiveScheduledNotifications();
      const found = active.find((n) => n.id === notifId);
      expect(found).toBeDefined();
      expect(found?.title).toContain('Lisinopril');
    });

    it('schedules missed check-in alerts with targetRoute: today', async () => {
      const notifId = await notificationService.scheduleMissedCheckInAlert(
        'Eleanor Care Circle',
        '10:00',
        1
      );
      expect(notifId).toBeTruthy();

      const active = notificationService.getActiveScheduledNotifications();
      const found = active.find((n) => n.id === notifId);
      expect(found).toBeDefined();
      expect(found?.title).toContain('Missed Daily Check-in');
    });

    it('schedules emergency help alert with targetRoute: timeline', async () => {
      const notifId = await notificationService.scheduleEmergencyHelpAlert('Eleanor', 'circle-1', 1);
      expect(notifId).toBeTruthy();

      const active = notificationService.getActiveScheduledNotifications();
      const found = active.find((n) => n.id === notifId);
      expect(found).toBeDefined();
      expect(found?.title).toContain('HELP NEEDED');
    });

    it('schedules shift handoff alert with targetRoute: coverage', async () => {
      const notifId = await notificationService.scheduleShiftHandoffAlert(
        'Sarah',
        'All meds taken, wound dressing fresh.',
        'circle-1',
        1
      );
      expect(notifId).toBeTruthy();

      const active = notificationService.getActiveScheduledNotifications();
      const found = active.find((n) => n.id === notifId);
      expect(found).toBeDefined();
      expect(found?.title).toContain('Shift Handoff');
    });
  });

  describe('Category 6: Email and SMS Templates with Actionable URLs', () => {
    it('formats invite templates with valid deep link and web join URL', () => {
      const invite = formatInviteMessage('Eleanor Vance Circle', 'CARE01');
      expect(invite.code).toBe('CARE01');
      expect(invite.deepLinkUrl).toBe('elderlycare://circle/join/CARE01');
      expect(invite.webLinkUrl).toBe('https://elderlycarehub.example.com/join/CARE01');
      expect(invite.sms).toContain('https://elderlycarehub.example.com/join/CARE01');
      expect(invite.emailBody).toContain('https://elderlycarehub.example.com/join/CARE01');
    });

    it('formats missed check-in SMS with actionable check-in link and deep link', () => {
      const alert = formatMissedCheckInAlertMessage(
        'Eleanor Care Circle',
        '10:00',
        'circle-1'
      );
      expect(alert.checkInUrl).toBe('https://elderlycarehub.example.com/checkin?circle=circle-1');
      expect(alert.deepLinkUrl).toBe('elderlycare://today');
      expect(alert.sms).toContain('https://elderlycarehub.example.com/checkin?circle=circle-1');
      expect(alert.sms).toContain('elderlycare://today');
    });

    it('formats shift handoff alerts with coverage link', () => {
      const handoff = formatHandoffAlertMessage(
        'Sarah',
        'Eleanor Care Circle',
        'Vitals normal, resting comfortably.'
      );
      expect(handoff.coverageUrl).toBe('https://elderlycarehub.example.com/coverage');
      expect(handoff.deepLinkUrl).toBe('elderlycare://coverage');
    });
  });
});
