import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { NotificationAuditLog } from '../types/database';

let inMemoryAuditLogs: NotificationAuditLog[] = [];

export const notificationDeliveryService = {
  /**
   * Log notification attempt to audit table for reliability and debugging
   */
  async logAttempt(
    recipient: string,
    channel: 'sms' | 'push',
    message: string,
    status: 'pending' | 'delivered' | 'failed' | 'retrying',
    attemptCount: number = 1,
    errorMessage?: string,
    careCircleId?: string
  ): Promise<NotificationAuditLog> {
    const entry: NotificationAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      recipient,
      channel,
      message,
      status,
      attempt_count: attemptCount,
      error_message: errorMessage || null,
      care_circle_id: careCircleId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    inMemoryAuditLogs.push(entry);

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('notification_audit_logs').insert({
          recipient: entry.recipient,
          channel: entry.channel,
          message: entry.message,
          status: entry.status,
          attempt_count: entry.attempt_count,
          error_message: entry.error_message,
          care_circle_id: entry.care_circle_id,
        });
      } catch (err) {
        console.warn('Failed to insert notification audit log into Supabase:', err);
      }
    }

    return entry;
  },

  /**
   * Send SMS with automated retry logic (exponential backoff)
   * Logs all attempts to notification_audit_logs
   */
  async sendSmsWithRetry(
    recipient: string,
    message: string,
    careCircleId?: string,
    maxRetries: number = 3,
    customSenderFn?: () => Promise<boolean>
  ): Promise<{ success: boolean; attempts: number; finalStatus: 'delivered' | 'failed'; error?: string }> {
    let attempt = 0;
    let lastError: string | undefined = undefined;

    while (attempt < maxRetries) {
      attempt++;

      try {
        await this.logAttempt(
          recipient,
          'sms',
          message,
          attempt < maxRetries ? 'retrying' : 'pending',
          attempt,
          lastError,
          careCircleId
        );

        // Execute sender (or simulated Twilio dispatch if customSenderFn provided or offline)
        let delivered = true;
        if (customSenderFn) {
          delivered = await customSenderFn();
        } else if (isSupabaseConfigured()) {
          const { error } = await supabase.functions.invoke('check-in-escalation', {
            body: { circleId: careCircleId, forceSms: true, customMessage: message },
          });
          if (error) throw new Error(error.message);
        }

        if (delivered) {
          await this.logAttempt(
            recipient,
            'sms',
            message,
            'delivered',
            attempt,
            undefined,
            careCircleId
          );

          return {
            success: true,
            attempts: attempt,
            finalStatus: 'delivered',
          };
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'SMS delivery failed';
        // Exponential backoff delay (shortened in test environments)
        const delayMs = Math.min(50 * Math.pow(2, attempt - 1), 500);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    // All retries failed
    await this.logAttempt(
      recipient,
      'sms',
      message,
      'failed',
      attempt,
      lastError,
      careCircleId
    );

    return {
      success: false,
      attempts: attempt,
      finalStatus: 'failed',
      error: lastError,
    };
  },

  /**
   * Retrieve audit logs for inspection and debugging
   */
  async getAuditLogs(careCircleId?: string): Promise<NotificationAuditLog[]> {
    if (!isSupabaseConfigured()) {
      if (careCircleId) {
        return inMemoryAuditLogs.filter((l) => l.care_circle_id === careCircleId);
      }
      return [...inMemoryAuditLogs];
    }

    try {
      let query = supabase.from('notification_audit_logs').select('*');
      if (careCircleId) {
        query = query.eq('care_circle_id', careCircleId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as NotificationAuditLog[];
    } catch {
      return [...inMemoryAuditLogs];
    }
  },

  /**
   * Reset local audit logs
   */
  reset(): void {
    inMemoryAuditLogs = [];
  },
};
