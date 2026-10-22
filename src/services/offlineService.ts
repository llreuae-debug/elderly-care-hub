import AsyncStorage from '@react-native-async-storage/async-storage';
import { DailyCheckIn, QueuedCheckIn, TimelineEvent } from '../types/database';

const TIMELINE_CACHE_KEY = '@elderlycare_timeline_cache';
const CHECKIN_QUEUE_KEY = '@elderlycare_checkin_queue';

let simulatedOffline = false;
let listeners: Array<(isOffline: boolean) => void> = [];

export const offlineService = {
  /**
   * Set simulated airplane / offline mode
   */
  setOffline(offline: boolean): void {
    simulatedOffline = offline;
    listeners.forEach((listener) => listener(offline));
  },

  /**
   * Check if currently offline (or simulated airplane mode)
   */
  isOffline(): boolean {
    return simulatedOffline;
  },

  /**
   * Add listener for connectivity changes
   */
  addConnectivityListener(cb: (isOffline: boolean) => void): () => void {
    listeners.push(cb);
    return () => {
      listeners = listeners.filter((l) => l !== cb);
    };
  },

  /**
   * Cache up to 50 timeline events in local AsyncStorage
   */
  async cacheTimelineEvents(circleId: string, events: TimelineEvent[]): Promise<void> {
    try {
      const top50 = events.slice(0, 50);
      await AsyncStorage.setItem(
        `${TIMELINE_CACHE_KEY}_${circleId}`,
        JSON.stringify(top50)
      );
    } catch (err) {
      console.warn('Failed to cache timeline events to AsyncStorage:', err);
    }
  },

  /**
   * Get cached timeline events from local AsyncStorage (fallback when offline)
   */
  async getCachedTimelineEvents(circleId: string): Promise<TimelineEvent[]> {
    try {
      const json = await AsyncStorage.getItem(`${TIMELINE_CACHE_KEY}_${circleId}`);
      if (json) {
        return JSON.parse(json) as TimelineEvent[];
      }
    } catch (err) {
      console.warn('Failed to read cached timeline events:', err);
    }
    return [];
  },

  /**
   * Queue an "I'm OK" check-in locally when offline
   */
  async queueCheckIn(
    circleId: string,
    userId: string,
    notes?: string
  ): Promise<QueuedCheckIn> {
    const item: QueuedCheckIn = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      circle_id: circleId,
      user_id: userId,
      notes: notes || 'Queued offline check-in ("I\'m OK")',
      queued_at: new Date().toISOString(),
    };

    try {
      const existingQueue = await this.getQueuedCheckIns();
      existingQueue.push(item);
      await AsyncStorage.setItem(CHECKIN_QUEUE_KEY, JSON.stringify(existingQueue));
    } catch (err) {
      console.warn('Failed to queue offline check-in:', err);
    }

    return item;
  },

  /**
   * Get list of currently queued check-ins waiting to sync
   */
  async getQueuedCheckIns(): Promise<QueuedCheckIn[]> {
    try {
      const json = await AsyncStorage.getItem(CHECKIN_QUEUE_KEY);
      if (json) {
        return JSON.parse(json) as QueuedCheckIn[];
      }
    } catch {
      // Empty fallback
    }
    return [];
  },

  /**
   * Synchronize queued check-ins once back online
   */
  async syncOfflineQueue(
    recordCheckInFn: (
      circleId: string,
      userId: string,
      notes?: string
    ) => Promise<{ checkIn: DailyCheckIn; timelineEvent: TimelineEvent }>
  ): Promise<{ syncedCount: number; results: Array<{ checkIn: DailyCheckIn; timelineEvent: TimelineEvent }> }> {
    const queue = await this.getQueuedCheckIns();
    if (queue.length === 0) {
      return { syncedCount: 0, results: [] };
    }

    const results: Array<{ checkIn: DailyCheckIn; timelineEvent: TimelineEvent }> = [];
    const remainingQueue: QueuedCheckIn[] = [];

    for (const item of queue) {
      try {
        const res = await recordCheckInFn(item.circle_id, item.user_id, item.notes);
        results.push(res);
      } catch (err) {
        console.warn('Failed to sync queued check-in item:', item.id, err);
        remainingQueue.push(item);
      }
    }

    // Update storage with remaining (if any failed)
    await AsyncStorage.setItem(CHECKIN_QUEUE_KEY, JSON.stringify(remainingQueue));

    return {
      syncedCount: results.length,
      results,
    };
  },

  /**
   * Clear all offline queues and caches
   */
  async clearAll(): Promise<void> {
    simulatedOffline = false;
    listeners = [];
    try {
      await AsyncStorage.removeItem(CHECKIN_QUEUE_KEY);
    } catch {
      // ignore
    }
  },
};
