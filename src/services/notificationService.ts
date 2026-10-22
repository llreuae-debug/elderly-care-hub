import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Medication } from '../types/database';

export const MED_CATEGORY_ID = 'MEDICATION_REMINDER';
export const ACTION_TAKEN = 'ACTION_TAKEN';
export const ACTION_SKIPPED = 'ACTION_SKIPPED';

// Configure foreground presentation behavior
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Graceful fallback for non-native/test environments
}

export interface ScheduledNotificationInfo {
  id: string;
  title: string;
  body: string;
  triggerSeconds: number;
  scheduledAt: string;
}

// In-memory registry for verification and testing
const activeScheduledNotifications: ScheduledNotificationInfo[] = [];

export const notificationService = {
  /**
   * Initialize notification categories and permissions
   */
  async initialize(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return true;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      // Configure interactive notification category for Taken / Skipped
      await Notifications.setNotificationCategoryAsync(MED_CATEGORY_ID, [
        {
          identifier: ACTION_TAKEN,
          buttonTitle: '✓ Taken',
          options: {
            opensAppToForeground: true,
          },
        },
        {
          identifier: ACTION_SKIPPED,
          buttonTitle: '✕ Skipped',
          options: {
            isDestructive: true,
            opensAppToForeground: true,
          },
        },
      ]);

      // Set Android Notification Channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('medication_reminders', {
          name: 'Medication Reminders',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0E7490',
        });
      }

      return finalStatus === 'granted';
    } catch (err) {
      console.warn('Could not initialize notifications:', err);
      return false;
    }
  },

  /**
   * Schedule a medication reminder notification (e.g. 2 minutes out for testing, or at scheduled time)
   */
  async scheduleMedicationReminder(
    medication: Medication,
    scheduledTime: string,
    secondsFromNow: number = 120
  ): Promise<string> {
    const title = `💊 Medication Reminder: ${medication.name} (${medication.dosage})`;
    const body = `Scheduled for ${scheduledTime}. Tap to mark Taken or Skipped.`;

    let notificationId = `notif-${Date.now()}`;

    try {
      if (Platform.OS !== 'web') {
        notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            categoryIdentifier: MED_CATEGORY_ID,
            data: {
              type: 'medication_reminder',
              medicationId: medication.id,
              medicationName: medication.name,
              dosage: medication.dosage,
              scheduledTime,
              careCircleId: medication.care_circle_id,
            },
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: Math.max(1, secondsFromNow),
            channelId: 'medication_reminders',
          },
        });
      }
    } catch (err) {
      console.warn('Failed to schedule native notification, recorded in local scheduler:', err);
    }

    activeScheduledNotifications.unshift({
      id: notificationId,
      title,
      body,
      triggerSeconds: secondsFromNow,
      scheduledAt: new Date().toISOString(),
    });

    return notificationId;
  },

  /**
   * Schedule Missed Check-in Push Alert to Caregivers
   */
  async scheduleMissedCheckInAlert(
    circleName: string,
    deadlineTime: string,
    secondsFromNow: number = 5
  ): Promise<string> {
    const title = `⚠️ Alert: Missed Daily Check-in`;
    const body = `${circleName} has not checked in by ${deadlineTime}. Please verify your loved one is safe.`;

    let id = `missed-checkin-${Date.now()}`;

    try {
      if (Platform.OS !== 'web') {
        id = await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: true,
            data: {
              type: 'missed_check_in_alert',
              circleName,
              deadlineTime,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: Math.max(1, secondsFromNow),
          },
        });
      }
    } catch {
      // Local fallback
    }

    activeScheduledNotifications.unshift({
      id,
      title,
      body,
      triggerSeconds: secondsFromNow,
      scheduledAt: new Date().toISOString(),
    });

    return id;
  },

  /**
   * Listen for user responses on notifications (interactive actions or taps)
   */
  addResponseListener(
    onResponse: (action: 'taken' | 'skipped' | 'opened', data: Record<string, unknown>) => void
  ): () => void {
    try {
      const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const actionId = response.actionIdentifier;
        const data = (response.notification.request.content.data || {}) as Record<string, unknown>;

        if (actionId === ACTION_TAKEN) {
          onResponse('taken', data);
        } else if (actionId === ACTION_SKIPPED) {
          onResponse('skipped', data);
        } else {
          onResponse('opened', data);
        }
      });

      return () => {
        subscription.remove();
      };
    } catch {
      return () => {};
    }
  },

  /**
   * Get all actively scheduled notifications
   */
  getActiveScheduledNotifications(): ScheduledNotificationInfo[] {
    return [...activeScheduledNotifications];
  },

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications(): Promise<void> {
    activeScheduledNotifications.length = 0;
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
      // Ignore
    }
  },
};
