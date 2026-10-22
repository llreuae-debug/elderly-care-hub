import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { careCircleService } from '../services/careCircleService';
import { notificationService } from '../services/notificationService';
import {
  CareCircle,
  DailyCheckIn,
  Medication,
  MedicationLog,
  UserProfile,
} from '../types/database';

interface TodayScreenProps {
  circle: CareCircle;
  currentUser: UserProfile;
  onNavigateToToday?: () => void;
  onNavigateToCoverage: () => void;
  onNavigateToTimeline: () => void;
  onBackToCircles: () => void;
}

export const TodayScreen: React.FC<TodayScreenProps> = ({
  circle,
  currentUser,
  onNavigateToCoverage,
  onNavigateToTimeline,
  onBackToCircles,
}) => {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>([]);
  const [todayCheckIn, setTodayCheckIn] = useState<DailyCheckIn | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [escalationLoading, setEscalationLoading] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const loadTodayData = useCallback(async () => {
    try {
      const [medsData, logsData, checkInData] = await Promise.all([
        careCircleService.fetchMedications(circle.id),
        careCircleService.fetchTodayMedicationLogs(circle.id),
        careCircleService.fetchTodayCheckIn(circle.id),
      ]);
      setMedications(medsData);
      setMedicationLogs(logsData);
      setTodayCheckIn(checkInData);
    } catch (err) {
      console.warn('Failed to load Today data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [circle.id]);

  useEffect(() => {
    loadTodayData();
    notificationService.initialize();

    // Listen for notification responses (Taken / Skipped actions from push alerts)
    const unsubscribeListener = notificationService.addResponseListener(
      async (action, data) => {
        if (action === 'taken' || action === 'skipped') {
          const medId = String(data.medicationId || '');
          const time = String(data.scheduledTime || '');
          if (medId && time) {
            await handleMarkMedication(medId, time, action);
          }
        }
      }
    );

    return () => {
      unsubscribeListener();
    };
  }, [circle.id, loadTodayData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTodayData();
  };

  const handleCheckIn = async () => {
    try {
      setCheckInLoading(true);
      const result = await careCircleService.recordDailyCheckIn(
        circle.id,
        currentUser.id,
        currentUser
      );
      setTodayCheckIn(result.checkIn);
      setBannerNotice("✓ Thank you! Eleanor's check-in has been logged for today.");
      setTimeout(() => setBannerNotice(null), 4000);
    } catch (err) {
      Alert.alert('Notice', err instanceof Error ? err.message : 'Could not record check-in');
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleMarkMedication = async (
    medicationId: string,
    scheduledTime: string,
    status: 'taken' | 'skipped'
  ) => {
    const actionKey = `${medicationId}-${scheduledTime}`;
    try {
      setActionLoadingId(actionKey);
      const result = await careCircleService.logMedicationAction(
        medicationId,
        scheduledTime,
        status,
        circle.id,
        currentUser.id,
        currentUser
      );

      // Update state
      setMedicationLogs((prev) =>
        prev.map((l) =>
          l.medication_id === medicationId && l.scheduled_time === scheduledTime
            ? result.log
            : l
        )
      );

      setBannerNotice(
        `✓ Medication marked ${status === 'taken' ? 'Taken' : 'Skipped'} and logged to Timeline.`
      );
      setTimeout(() => setBannerNotice(null), 4000);
    } catch (err) {
      Alert.alert('Notice', err instanceof Error ? err.message : 'Failed to update medication');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleScheduleTestReminder = async (med: Medication, time: string) => {
    const notifId = await notificationService.scheduleMedicationReminder(med, time, 120);
    Alert.alert(
      '🔔 Reminder Scheduled',
      `Medication reminder for ${med.name} (${med.dosage}) scheduled 2 minutes out. It will fire with "Taken" and "Skipped" action buttons.\n[ID: ${notifId}]`
    );
  };

  const handleTestEscalation = async () => {
    try {
      setEscalationLoading(true);
      const res = await careCircleService.triggerMissedCheckInEscalation(circle.id, true);
      // Also schedule a local push alert so the tester feels the immediate alarm
      await notificationService.scheduleMissedCheckInAlert(
        circle.name,
        circle.check_in_deadline_time || '10:00',
        2
      );

      await loadTodayData();
      Alert.alert(
        '🚨 Missed Check-in Escalation Tested',
        `Step 1: Push alert broadcasted to all care circle members.\nStep 2: Twilio SMS dispatched to primary caregiver (${circle.primary_caregiver_phone || '+15551234567'}).\n\nResult: ${res.message}`
      );
    } catch (err) {
      Alert.alert('Notice', err instanceof Error ? err.message : 'Escalation failed');
    } finally {
      setEscalationLoading(false);
    }
  };

  const todayFormatted = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const isCheckedIn = todayCheckIn?.status === 'ok';
  const isMissed = todayCheckIn?.status === 'missed';
  const deadlineTime = circle.check_in_deadline_time || '10:00';

  const takenCount = medicationLogs.filter((l) => l.status === 'taken').length;
  const totalDoses = medicationLogs.length;

  return (
    <View style={styles.container}>
      {/* Top Header Card */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={onBackToCircles}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Switch Circle"
          >
            <Text style={styles.backButtonText}>← Circles</Text>
          </TouchableOpacity>

          {/* Tab Switcher: Today | Coverage | Timeline */}
          <View style={styles.tabSwitcher}>
            <View style={[styles.tabButton, styles.tabButtonActive]}>
              <Text style={styles.tabTextActive}>☀️ Today</Text>
            </View>
            <TouchableOpacity
              onPress={onNavigateToCoverage}
              style={styles.tabButton}
              accessibilityRole="button"
              accessibilityLabel="View Coverage"
            >
              <Text style={styles.tabTextInactive}>👥 Coverage</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onNavigateToTimeline}
              style={styles.tabButton}
              accessibilityRole="button"
              accessibilityLabel="View Timeline"
            >
              <Text style={styles.tabTextInactive}>📜 Timeline</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.dateRow}>
          <Text style={styles.todayDate}>{todayFormatted}</Text>
          <Text style={styles.circleName}>{circle.name}</Text>
        </View>

        {bannerNotice ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{bannerNotice}</Text>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0E7490" />
          <Text style={styles.loadingText}>Loading today's schedule...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#0E7490']}
              tintColor="#0E7490"
            />
          }
        >
          {/* 1. Daily Check-in Card (Elder Dignity First) */}
          <View
            style={[
              styles.card,
              isCheckedIn
                ? styles.checkInCardOk
                : isMissed
                ? styles.checkInCardMissed
                : styles.checkInCardPending,
            ]}
          >
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.checkInPretitle}>DAILY CHECK-IN</Text>
                <Text style={styles.checkInTitle}>
                  {isCheckedIn
                    ? '✓ Eleanor is OK Today'
                    : isMissed
                    ? '⚠️ Missed Check-in Alert'
                    : 'Morning Wellness Check'}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  isCheckedIn
                    ? styles.statusBadgeOk
                    : isMissed
                    ? styles.statusBadgeMissed
                    : styles.statusBadgePending,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    isCheckedIn
                      ? styles.statusBadgeTextOk
                      : isMissed
                      ? styles.statusBadgeTextMissed
                      : styles.statusBadgeTextPending,
                  ]}
                >
                  {isCheckedIn ? 'CONFIRMED' : isMissed ? 'OVERDUE' : `BY ${deadlineTime}`}
                </Text>
              </View>
            </View>

            <Text style={styles.checkInDescription}>
              {isCheckedIn
                ? `Confirmed at ${new Date(
                    todayCheckIn?.checked_in_at || ''
                  ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Family and nurses know Eleanor is safe.`
                : isMissed
                ? `The ${deadlineTime} check-in deadline passed. Caregiver push alerts and Twilio SMS escalation are active.`
                : `Tap "I'm OK" to give the family peace of mind. If unconfirmed by ${deadlineTime}, caregivers will be alerted.`}
            </Text>

            {/* Dignified Large Touch Target Button */}
            <Button
              title={isCheckedIn ? '✓ Check-in Confirmed ("I’m OK")' : "☀️ Tap: I'm OK"}
              variant={isCheckedIn ? 'secondary' : 'primary'}
              size="large"
              onPress={handleCheckIn}
              loading={checkInLoading}
              style={[
                styles.checkInButton,
                isCheckedIn ? styles.checkInButtonDone : null,
              ]}
            />

            {/* Missed Check-in Escalation Test Button */}
            <TouchableOpacity
              onPress={handleTestEscalation}
              style={styles.escalationLink}
              activeOpacity={0.7}
              disabled={escalationLoading}
              accessibilityRole="button"
              accessibilityLabel="Test missed check-in escalation alerts"
            >
              {escalationLoading ? (
                <ActivityIndicator size="small" color="#B45309" />
              ) : (
                <Text style={styles.escalationLinkText}>
                  🔔 Test Escalation: Trigger Missed Alert (Push + Twilio SMS)
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Quick Coverage Link Card */}
          <TouchableOpacity
            onPress={onNavigateToCoverage}
            style={styles.coverageShortcutCard}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="View Caregiver Shift Coverage"
          >
            <View style={styles.coverageShortcutContent}>
              <Text style={styles.coverageShortcutIcon}>👥</Text>
              <View style={styles.coverageShortcutTextCol}>
                <Text style={styles.coverageShortcutTitle}>Caregiver Shift Coverage</Text>
                <Text style={styles.coverageShortcutSub}>
                  View active caregiver, task checklists & handoff notes
                </Text>
              </View>
            </View>
            <Text style={styles.coverageShortcutChevron}>→</Text>
          </TouchableOpacity>

          {/* 2. Today's Medications List */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Today’s Medications</Text>
            <View style={styles.counterBadge}>
              <Text style={styles.counterText}>
                {takenCount} of {totalDoses} Taken
              </Text>
            </View>
          </View>

          {medicationLogs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No medications scheduled for today.</Text>
            </View>
          ) : (
            medicationLogs.map((log) => {
              const med =
                log.medication || medications.find((m) => m.id === log.medication_id);
              const actionKey = `${log.medication_id}-${log.scheduled_time}`;
              const isBusy = actionLoadingId === actionKey;
              const isTaken = log.status === 'taken';
              const isSkipped = log.status === 'skipped';

              return (
                <View
                  key={`${log.medication_id}-${log.scheduled_time}`}
                  style={[
                    styles.medCard,
                    isTaken && styles.medCardTaken,
                    isSkipped && styles.medCardSkipped,
                  ]}
                >
                  <View style={styles.medCardTop}>
                    <View style={styles.medTimeBadge}>
                      <Text style={styles.medTimeText}>{log.scheduled_time}</Text>
                    </View>

                    <View style={styles.medStatusChip}>
                      <Text
                        style={[
                          styles.medStatusChipText,
                          isTaken
                            ? styles.chipTextTaken
                            : isSkipped
                            ? styles.chipTextSkipped
                            : styles.chipTextPending,
                        ]}
                      >
                        {isTaken ? '✓ Taken' : isSkipped ? '✕ Skipped' : 'Pending'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.medName}>
                    {med?.name || 'Medication'} <Text style={styles.medDosage}>{med?.dosage}</Text>
                  </Text>

                  {med?.instructions ? (
                    <Text style={styles.medInstructions}>{med.instructions}</Text>
                  ) : null}

                  {log.notes ? (
                    <Text style={styles.logNotes}>Note: {log.notes}</Text>
                  ) : null}

                  {/* Actions Row */}
                  <View style={styles.medActionsRow}>
                    <Button
                      title="✓ Taken"
                      size="normal"
                      variant={isTaken ? 'primary' : 'outline'}
                      onPress={() =>
                        handleMarkMedication(log.medication_id, log.scheduled_time, 'taken')
                      }
                      loading={isBusy && log.status !== 'taken'}
                      style={styles.actionBtn}
                    />

                    <Button
                      title="✕ Skip"
                      size="normal"
                      variant={isSkipped ? 'secondary' : 'ghost'}
                      onPress={() =>
                        handleMarkMedication(log.medication_id, log.scheduled_time, 'skipped')
                      }
                      loading={isBusy && log.status !== 'skipped'}
                      style={styles.actionBtn}
                    />

                    {med && (
                      <Button
                        title="🔔 2m Reminder"
                        size="normal"
                        variant="ghost"
                        onPress={() => handleScheduleTestReminder(med, log.scheduled_time)}
                        style={styles.actionBtn}
                      />
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0E7490',
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  tabTextActive: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0E7490',
  },
  tabTextInactive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  dateRow: {
    marginTop: 4,
  },
  todayDate: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  circleName: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  banner: {
    marginTop: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    padding: 10,
  },
  bannerText: {
    fontSize: 14,
    color: '#047857',
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  checkInCardOk: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  checkInCardPending: {
    backgroundColor: '#FEFCE8',
    borderColor: '#FEF08A',
  },
  checkInCardMissed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  checkInPretitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#64748B',
    marginBottom: 2,
  },
  checkInTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  checkInDescription: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
    marginBottom: 18,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeOk: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  statusBadgePending: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FDE047',
  },
  statusBadgeMissed: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusBadgeTextOk: {
    color: '#15803D',
  },
  statusBadgeTextPending: {
    color: '#A16207',
  },
  statusBadgeTextMissed: {
    color: '#B91C1C',
  },
  checkInButton: {
    minHeight: 58,
  },
  checkInButtonDone: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  escalationLink: {
    marginTop: 14,
    paddingVertical: 6,
    alignItems: 'center',
  },
  escalationLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
    textDecorationLine: 'underline',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
  },
  counterBadge: {
    backgroundColor: '#E0F2FE',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  counterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
  },
  medCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  medCardTaken: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  medCardSkipped: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  medCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  medTimeBadge: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  medTimeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  medStatusChip: {},
  medStatusChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextTaken: {
    color: '#16A34A',
  },
  chipTextSkipped: {
    color: '#D97706',
  },
  chipTextPending: {
    color: '#0284C7',
  },
  medName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  medDosage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0E7490',
  },
  medInstructions: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 12,
    lineHeight: 20,
  },
  logNotes: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
    marginBottom: 8,
  },
  medActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  actionBtn: {
    flex: 1,
    minHeight: 44,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyCardText: {
    fontSize: 15,
    color: '#64748B',
  },
  coverageShortcutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  coverageShortcutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  coverageShortcutIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  coverageShortcutTextCol: {
    flex: 1,
  },
  coverageShortcutTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  coverageShortcutSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  coverageShortcutChevron: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0E7490',
    marginLeft: 8,
  },
});
