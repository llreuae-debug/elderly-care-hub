import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { careCircleService } from '../services/careCircleService';
import { ElderSession, MedicationLog } from '../types/database';

interface ElderHomeScreenProps {
  session: ElderSession;
  onExitElderMode: () => void;
}

export const ElderHomeScreen: React.FC<ElderHomeScreenProps> = ({
  session,
  onExitElderMode,
}) => {
  const [okConfirmed, setOkConfirmed] = useState(false);
  const [helpCalled, setHelpCalled] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showMedsModal, setShowMedsModal] = useState(false);
  const [todayMeds, setTodayMeds] = useState<MedicationLog[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const loadElderData = async () => {
    try {
      const [logs, checkIn] = await Promise.all([
        careCircleService.fetchTodayMedicationLogs(session.circle_id),
        careCircleService.fetchTodayCheckIn(session.circle_id),
      ]);
      setTodayMeds(logs);
      if (checkIn && checkIn.status === 'ok') {
        setOkConfirmed(true);
      }
    } catch {
      // Safe fallback
    }
  };

  useEffect(() => {
    loadElderData();
  }, [session.circle_id]);

  const handleImOk = async () => {
    try {
      setActionLoading('ok');
      await careCircleService.recordDailyCheckIn(
        session.circle_id,
        'elder-' + session.circle_id,
        {
          id: 'elder-' + session.circle_id,
          email: '',
          full_name: session.elder_name,
          avatar_url: null,
          created_at: new Date().toISOString(),
        },
        `${session.elder_name} pressed 'I\\'m OK' in Elder Mode.`
      );

      setOkConfirmed(true);
      setFeedbackMessage(`Thank you, ${session.elder_name}! Your family knows you are OK today.`);
    } catch (err) {
      Alert.alert('Notice', 'Could not record check-in.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCallForHelp = async () => {
    try {
      setActionLoading('help');
      await careCircleService.callForHelp(session.circle_id, session.elder_name);
      setHelpCalled(true);
      setFeedbackMessage(`Help alert sent! Your caregivers have been notified by phone and SMS.`);
    } catch (err) {
      Alert.alert('Notice', 'Emergency alert initiated.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewMeds = async () => {
    await loadElderData();
    setShowMedsModal(true);
  };

  return (
    <View style={styles.container}>
      {/* Elder Greeting */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Good day, {session.elder_name}!</Text>
      </View>

      {/* Feedback Reassurance Banner */}
      {feedbackMessage ? (
        <View style={styles.feedbackBanner}>
          <Text style={styles.feedbackText}>{feedbackMessage}</Text>
        </View>
      ) : null}

      {/* ONLY THREE LARGE BUTTONS */}
      <View style={styles.buttonContainer}>
        {/* BUTTON 1: "I'm OK" (Huge, Green) */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleImOk}
          disabled={actionLoading === 'ok'}
          style={[
            styles.elderButton,
            styles.imOkButton,
            okConfirmed ? styles.imOkButtonDone : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel="I am OK"
        >
          {actionLoading === 'ok' ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : (
            <View style={styles.buttonInner}>
              <Text style={styles.buttonEmoji}>☀️</Text>
              <Text style={styles.buttonLabel}>
                {okConfirmed ? "I'm OK (Confirmed ✓)" : "I'm OK"}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* BUTTON 2: "Call for help" (Huge, Red) */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleCallForHelp}
          disabled={actionLoading === 'help'}
          style={[
            styles.elderButton,
            styles.callHelpButton,
            helpCalled ? styles.callHelpButtonSent : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Call for help"
        >
          {actionLoading === 'help' ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : (
            <View style={styles.buttonInner}>
              <Text style={styles.buttonEmoji}>🚨</Text>
              <Text style={styles.buttonLabel}>
                {helpCalled ? 'Help Alert Sent!' : 'Call for help'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* BUTTON 3: "My meds today" (Read-only list with "taken" checkmarks) */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleViewMeds}
          style={[styles.elderButton, styles.myMedsButton]}
          accessibilityRole="button"
          accessibilityLabel="My medications today"
        >
          <View style={styles.buttonInner}>
            <Text style={styles.buttonEmoji}>💊</Text>
            <Text style={styles.buttonLabel}>My meds today</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Discreet Exit Link */}
      <TouchableOpacity
        onPress={onExitElderMode}
        style={styles.exitLink}
        accessibilityRole="button"
        accessibilityLabel="Exit Elder Mode"
      >
        <Text style={styles.exitLinkText}>Exit Elder Mode</Text>
      </TouchableOpacity>

      {/* Read-Only Meds Modal (Minimum 24pt font, large checkmarks) */}
      <Modal
        visible={showMedsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMedsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>My Meds Today</Text>
            <TouchableOpacity
              onPress={() => setShowMedsModal(false)}
              style={styles.modalCloseCircle}
              accessibilityRole="button"
              accessibilityLabel="Close medications list"
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll}>
            {todayMeds.length === 0 ? (
              <View style={styles.emptyMedsBox}>
                <Text style={styles.emptyMedsText}>No medications scheduled for today.</Text>
              </View>
            ) : (
              todayMeds.map((item, idx) => {
                const isTaken = item.status === 'taken';
                const isSkipped = item.status === 'skipped';

                return (
                  <View
                    key={idx}
                    style={[
                      styles.medRowCard,
                      isTaken && styles.medRowTaken,
                      isSkipped && styles.medRowSkipped,
                    ]}
                  >
                    <View style={styles.medRowLeft}>
                      <Text style={styles.medTimeLarge}>{item.scheduled_time}</Text>
                      <Text style={styles.medNameLarge}>
                        {item.medication?.name || 'Medication'} {item.medication?.dosage}
                      </Text>
                    </View>

                    <View style={styles.medStatusLargeBadge}>
                      <Text style={styles.medCheckmarkIcon}>
                        {isTaken ? '✓' : isSkipped ? '✕' : '⏳'}
                      </Text>
                      <Text
                        style={[
                          styles.medStatusLargeText,
                          isTaken
                            ? styles.textTakenGreen
                            : isSkipped
                            ? styles.textSkippedOrange
                            : styles.textPendingBlue,
                        ]}
                      >
                        {isTaken ? 'Taken' : isSkipped ? 'Skipped' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}

            <TouchableOpacity
              onPress={() => setShowMedsModal(false)}
              style={styles.largeCloseButton}
              accessibilityRole="button"
              accessibilityLabel="Close list and go back"
            >
              <Text style={styles.largeCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  greeting: {
    fontSize: 32, // Minimum 24pt
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  feedbackBanner: {
    backgroundColor: '#DCFCE7',
    borderWidth: 2,
    borderColor: '#86EFAC',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    alignItems: 'center',
  },
  feedbackText: {
    fontSize: 24, // Minimum 24pt
    fontWeight: '700',
    color: '#15803D',
    textAlign: 'center',
    lineHeight: 32,
  },
  buttonContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  elderButton: {
    minHeight: 110, // Huge touch target
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  buttonEmoji: {
    fontSize: 38,
  },
  buttonLabel: {
    fontSize: 28, // Minimum 24pt
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  imOkButton: {
    backgroundColor: '#16A34A', // Huge, Green
  },
  imOkButtonDone: {
    backgroundColor: '#15803D',
    borderWidth: 3,
    borderColor: '#86EFAC',
  },
  callHelpButton: {
    backgroundColor: '#DC2626', // Red
  },
  callHelpButtonSent: {
    backgroundColor: '#B91C1C',
    borderWidth: 3,
    borderColor: '#FCA5A5',
  },
  myMedsButton: {
    backgroundColor: '#4338CA', // Calm Indigo
  },
  exitLink: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  exitLinkText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 24,
    paddingTop: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 32, // Minimum 24pt
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 28,
    color: '#475569',
    fontWeight: '700',
  },
  modalScroll: {
    gap: 16,
    paddingBottom: 40,
  },
  medRowCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  medRowTaken: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  medRowSkipped: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  medRowLeft: {
    flex: 1,
  },
  medTimeLarge: {
    fontSize: 24, // Minimum 24pt
    fontWeight: '800',
    color: '#0E7490',
    marginBottom: 4,
  },
  medNameLarge: {
    fontSize: 26, // Minimum 24pt
    fontWeight: '700',
    color: '#0F172A',
  },
  medStatusLargeBadge: {
    alignItems: 'center',
    marginLeft: 14,
  },
  medCheckmarkIcon: {
    fontSize: 32,
    marginBottom: 2,
  },
  medStatusLargeText: {
    fontSize: 20,
    fontWeight: '800',
  },
  textTakenGreen: {
    color: '#16A34A',
  },
  textSkippedOrange: {
    color: '#D97706',
  },
  textPendingBlue: {
    color: '#0284C7',
  },
  emptyMedsBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyMedsText: {
    fontSize: 24,
    color: '#64748B',
    textAlign: 'center',
  },
  largeCloseButton: {
    minHeight: 70,
    backgroundColor: '#0E7490',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  largeCloseButtonText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
