import { Alert, Linking } from 'react-native';

export const EXTERNAL_URLS = {
  PRIVACY_POLICY: 'https://elderly-care-hub.vercel.app',
  TERMS_OF_SERVICE: 'https://elderly-care-hub.vercel.app',
  SUPPORT: 'https://elderly-care-hub.vercel.app',
  WEBSITE: 'https://elderly-care-hub.vercel.app',
};

export type DeepLinkIntent =
  | {
      type: 'auth_callback';
      accessToken?: string;
      refreshToken?: string;
      code?: string;
    }
  | {
      type: 'circle_join';
      inviteCode: string;
    }
  | {
      type: 'navigate';
      screen: 'today' | 'coverage' | 'timeline';
    }
  | {
      type: 'elder_mode';
    }
  | {
      type: 'unknown';
      url: string;
    };

/**
 * Safely parse deep link URLs (custom scheme `elderlycare://` or web URLs)
 */
export function parseDeepLink(rawUrl: string): DeepLinkIntent {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { type: 'unknown', url: '' };
  }

  const url = rawUrl.trim();

  // 1. Supabase Auth Magic Link callback:
  // e.g. elderlycare://auth/callback#access_token=abc&refresh_token=xyz
  // or https://elderly-care-hub.vercel.app/auth/callback#access_token=abc
  if (url.includes('auth/callback') || url.includes('callback#') || url.includes('#access_token=')) {
    const hashIndex = url.indexOf('#');
    const queryIndex = url.indexOf('?');

    const params: Record<string, string> = {};

    // Parse fragment (#access_token=...&refresh_token=...)
    if (hashIndex !== -1) {
      const fragment = url.substring(hashIndex + 1);
      fragment.split('&').forEach((part) => {
        const [k, v] = part.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }

    // Parse query params (?code=... or ?access_token=...)
    if (queryIndex !== -1) {
      const queryString = hashIndex > queryIndex ? url.substring(queryIndex + 1, hashIndex) : url.substring(queryIndex + 1);
      queryString.split('&').forEach((part) => {
        const [k, v] = part.split('=');
        if (k && !params[decodeURIComponent(k)]) {
          params[decodeURIComponent(k)] = decodeURIComponent(v || '');
        }
      });
    }

    return {
      type: 'auth_callback',
      accessToken: params.access_token,
      refreshToken: params.refresh_token,
      code: params.code,
    };
  }

  // Normalize scheme for path matching
  const cleaned = url
    .replace(/^elderlycare:\/\//i, '')
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\//, '');

  const [pathPart] = cleaned.split(/[?#]/);
  const segments = pathPart.split('/').filter(Boolean);

  // 2. Join Care Circle: elderlycare://circle/join/CARE01 or /join/CARE01
  if (
    (segments[0] === 'circle' && segments[1] === 'join' && segments[2]) ||
    (segments[0] === 'join' && segments[1])
  ) {
    const code = (segments[0] === 'circle' ? segments[2] : segments[1]).toUpperCase();
    return {
      type: 'circle_join',
      inviteCode: code,
    };
  }

  // 3. Tab Navigation: elderlycare://today, elderlycare://coverage, elderlycare://timeline
  if (segments[0] === 'today') {
    return { type: 'navigate', screen: 'today' };
  }
  if (segments[0] === 'coverage') {
    return { type: 'navigate', screen: 'coverage' };
  }
  if (segments[0] === 'timeline') {
    return { type: 'navigate', screen: 'timeline' };
  }

  // 4. Elder mode switch: elderlycare://elder
  if (segments[0] === 'elder' || segments[0] === 'elder-mode') {
    return { type: 'elder_mode' };
  }

  return { type: 'unknown', url };
}

/**
 * Open external URL safely with fallback alert
 */
export async function openExternalUrl(url: string, linkTitle?: string): Promise<boolean> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return true;
    } else {
      Alert.alert(
        linkTitle || 'External Link',
        `Unable to open link automatically on this device:\n${url}`
      );
      return false;
    }
  } catch (err) {
    Alert.alert(
      linkTitle || 'External Link',
      `Could not open ${linkTitle || 'link'}. Please visit:\n${url}`
    );
    return false;
  }
}

/**
 * Format Invite Message with valid Web and Deep Link URLs
 */
export function formatInviteMessage(circleName: string, inviteCode: string) {
  const code = inviteCode.trim().toUpperCase();
  const deepLinkUrl = `elderlycare://circle/join/${code}`;
  const webLinkUrl = `https://elderly-care-hub.vercel.app/join/${code}`;

  return {
    code,
    deepLinkUrl,
    webLinkUrl,
    sms: `You have been invited to join the ${circleName} on Elderly Care Hub! Tap here to join: ${webLinkUrl} (Invite Code: ${code})`,
    emailSubject: `Join ${circleName} on Elderly Care Hub`,
    emailBody: `Hello,\n\nYou have been invited to collaborate as a caregiver in ${circleName} on Elderly Care Hub.\n\nTo join, tap this link on your device:\n${webLinkUrl}\n\nOr enter invite code "${code}" directly in the app.`,
  };
}

/**
 * Format Missed Check-In Alert SMS & Push with valid action URLs
 */
export function formatMissedCheckInAlertMessage(
  circleName: string,
  deadline: string,
  circleId: string
) {
  const checkInUrl = `https://elderly-care-hub.vercel.app/checkin?circle=${encodeURIComponent(circleId)}`;
  const deepLinkUrl = `elderlycare://today`;

  return {
    checkInUrl,
    deepLinkUrl,
    sms: `URGENT [Elderly Care Hub]: ${circleName} missed daily check-in (deadline ${deadline}). 30-min escalation window expired without confirmation. Check status: ${checkInUrl} or open app: ${deepLinkUrl}`,
    push: `Check-in overdue for ${circleName} (deadline was ${deadline}). Tap to view Today's schedule.`,
  };
}

/**
 * Format Shift Handoff Alert
 */
export function formatHandoffAlertMessage(fromCaregiver: string, circleName: string, handoffNote: string) {
  const coverageUrl = `https://elderly-care-hub.vercel.app/coverage`;
  const deepLinkUrl = `elderlycare://coverage`;

  return {
    coverageUrl,
    deepLinkUrl,
    pushTitle: `📋 Shift Handoff: ${fromCaregiver}`,
    pushBody: `${handoffNote || 'Shift completed.'} Tap to view current coverage.`,
  };
}
