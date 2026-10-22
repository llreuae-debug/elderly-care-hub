import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { AnalyticsEvent, AnalyticsEventName } from '../types/database';

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

export const analyticsService = {
  /**
   * Track key user actions (Dignity-first, privacy-preserving)
   */
  async track(
    eventName: AnalyticsEventName,
    properties: Record<string, string | number | boolean | null> = {},
    userId?: string | null,
    circleId?: string | null
  ): Promise<AnalyticsEvent> {
    const sanitizedProps = sanitizeProperties(properties);

    const event: AnalyticsEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      event_name: eventName,
      user_id: userId || null,
      care_circle_id: circleId || null,
      properties: sanitizedProps,
      created_at: new Date().toISOString(),
    };

    inMemoryAnalytics.push(event);

    if (!isSupabaseConfigured()) {
      return event;
    }

    try {
      await supabase.from('analytics_events').insert({
        event_name: event.event_name,
        user_id: event.user_id,
        care_circle_id: event.care_circle_id,
        properties: event.properties,
      });
    } catch (err) {
      console.warn('Failed to send analytics event to Supabase:', err);
    }

    return event;
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
  },
};
