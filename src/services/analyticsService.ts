import { Platform } from 'react-native';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { AnalyticsEvent, AnalyticsEventName } from '../types/database';

// Query source statement: Supabase is the single server-side source of truth for
// all analytics and business metrics queries. No third-party SDK is required in v1.
export const ANALYTICS_QUERY_SOURCE = 'supabase';

const APP_VERSION = '1.0.0';
const CURRENT_PLATFORM = Platform?.OS || 'web';

const FORBIDDEN_PII_KEYS = new Set([
  'email',
  'phone',
  'telephone',
  'mobile',
  'name',
  'first_name',
  'last_name',
  'elder_name',
  'address',
  'street',
  'ssn',
  'medication',
  'notes',
  'note_content',
]);

function sanitizeProperties(
  props: Record<string, string | number | boolean | null>
): Record<string, string | number | boolean | null> {
  const clean: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(props)) {
    if (!FORBIDDEN_PII_KEYS.has(k)) {
      clean[k] = v;
    }
  }
  return clean;
}

let inMemoryAnalytics: AnalyticsEvent[] = [];
let batchQueue: AnalyticsEvent[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;

const BATCH_SIZE_THRESHOLD = 5;
const BATCH_FLUSH_DELAY_MS = 1000;

async function flushBatch(): Promise<void> {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  if (batchQueue.length === 0 || !isSupabaseConfigured()) {
    batchQueue = [];
    return;
  }

  const toSend = [...batchQueue];
  batchQueue = [];

  try {
    const payload = toSend.map((evt) => ({
      id: evt.id,
      user_id: evt.user_id || null,
      circle_id: evt.circle_id || evt.care_circle_id || null,
      care_circle_id: evt.care_circle_id || evt.circle_id || null,
      event_name: evt.event_name,
      properties: evt.properties,
      app_version: evt.app_version || APP_VERSION,
      platform: evt.platform || CURRENT_PLATFORM,
      created_at: evt.created_at,
    }));

    const { error } = await supabase.from('analytics_events').insert(payload);
    if (error && typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[Analytics DEV] Batch insert error:', error.message);
    }
  } catch (err) {
    // Fail silently on the client; log in dev only
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[Analytics DEV] Batch flush exception:', err);
    }
  }
}

export const analyticsService = {
  /**
   * Tiny, typed track(event, props) wrapper.
   * - Strict Zero PII (sanitized automatically)
   * - Batched asynchronous delivery (never blocks UI)
   * - Silent failure on client (dev-only logging)
   * - Supabase is the primary query source of truth
   */
  track(
    eventName: AnalyticsEventName,
    properties: Record<string, string | number | boolean | null> = {},
    userIdOrOptions?:
      | string
      | null
      | { userId?: string | null; circleId?: string | null },
    circleIdArg?: string | null
  ): AnalyticsEvent {
    let userId: string | null = null;
    let circleId: string | null = null;

    if (typeof userIdOrOptions === 'object' && userIdOrOptions !== null) {
      userId = userIdOrOptions.userId || null;
      circleId = userIdOrOptions.circleId || null;
    } else {
      userId = userIdOrOptions || null;
      circleId = circleIdArg || null;
    }

    const sanitizedProps = sanitizeProperties(properties);

    const event: AnalyticsEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      event_name: eventName,
      user_id: userId,
      circle_id: circleId,
      care_circle_id: circleId,
      properties: sanitizedProps,
      app_version: APP_VERSION,
      platform: CURRENT_PLATFORM,
      created_at: new Date().toISOString(),
    };

    inMemoryAnalytics.push(event);
    batchQueue.push(event);

    // Trigger batch flush if queue hits threshold, otherwise debounce
    if (batchQueue.length >= BATCH_SIZE_THRESHOLD) {
      // Fire-and-forget, never block UI
      flushBatch().catch(() => {});
    } else if (!flushTimeout) {
      flushTimeout = setTimeout(() => {
        flushBatch().catch(() => {});
      }, BATCH_FLUSH_DELAY_MS);
      if (typeof flushTimeout?.unref === 'function') {
        flushTimeout.unref();
      }
    }

    return event;
  },

  /**
   * Force flush of any queued analytics events (useful for tests and app lifecycle)
   */
  async flush(): Promise<void> {
    await flushBatch();
  },

  /**
   * Get all tracked events (useful for tests and verification)
   */
  getTrackedEvents(eventName?: AnalyticsEventName): AnalyticsEvent[] {
    if (eventName) {
      return inMemoryAnalytics.filter((e) => e.event_name === eventName);
    }
    return [...inMemoryAnalytics];
  },

  /**
   * Reset local analytics buffer
   */
  reset(): void {
    inMemoryAnalytics = [];
    batchQueue = [];
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
  },
};
