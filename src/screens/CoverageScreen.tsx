import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { careCircleService } from '../services/careCircleService';
import {
  CareCircle,
  CaregiverShift,
  CoverageStatus,
  ShiftTask,
  UserProfile,
} from '../types/database';

interface CoverageScreenProps {
  circle: CareCircle;
  currentUser: UserProfile;
  onNavigateToToday: () => void;
  onNavigateToTimeline: () => void;
  onBackToCircles: () => void;
}

export const CoverageScreen: React.FC<CoverageScreenProps> = ({
  circle,
  currentUser,
  onNavigateToToday,
  onNavigateToTimeline,
  onBackToCircles,
}) => {
  const [coverage, setCoverage] = useState<CoverageStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [taskTogglingId, setTaskTogglingId] = useState<string | null>(null);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Handoff Modal state
  const [handoffModalVisible, setHandoffModalVisible] = useState(false);
  const [selectedShiftForHandoff, setSelectedShiftForHandoff] =
    useState<CaregiverShift | null>(null);
  const [handoffNoteText, setHandoffNoteText] = useState('');
  const [nothingToReport, setNothingToReport] = useState(false);
  const [handoffSubmitting, setHandoffSubmitting] = useState(false);

  // Admin New Shift Modal state
  const [newShiftModalVisible, setNewShiftModalVisible] = useState(false);
  const [newCaregiverId, setNewCaregiverId] = useState(currentUser.id);
  const [newStartTime, setNewStartTime] = useState('08:00');
  const [newEndTime, setNewEndTime] = useState('14:00');
  const [newTask1, setNewTask1] = useState('Change bandage & inspect dressing');
  const [newTask2, setNewTask2] = useState('Refill weekly pillbox');
  const [creatingShift, setCreatingShift] = useState(false);

  const isAdmin = circle.created_by === currentUser.id || currentUser.id === '11111111-1111-1111-1111-111111111111';

  const loadCoverage = useCallback(async () => {
    try {
      const data = await careCircleService.fetchCoverageStatus(circle.id);
      setCoverage(data);
    } catch (err) {
      console.warn('Failed to load coverage:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [circle.id]);

  useEffect(() => {
    loadCoverage();
  }, [loadCoverage]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCoverage();
  };

  const handleToggleTask = async (task: ShiftTask, shift: CaregiverShift) => {
    const isAssigned = shift.caregiver_id === currentUser.id;
    if (!isAssigned && !isAdmin) {
      Alert.alert(
        'Permission Denied',
        'Only the assigned caregiver for this shift can edit their task checklist (server-side RLS policy).'
      );
      return;
    }

    try {
      setTaskTogglingId(task.id);
      await careCircleService.toggleShiftTask(
        task.id,
        !task.completed,
        shift.id,
        currentUser.id
      );
      await loadCoverage();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update task';
      Alert.alert('Permission Error', msg);
    } finally {
      setTaskTogglingId(null);
    }
  };

  const handleOpenHandoffModal = (shift: CaregiverShift) => {
    setSelectedShiftForHandoff(shift);
    setHandoffNoteText('');
    setNothingToReport(false);
    setHandoffModalVisible(true);
  };

  const handleSubmitHandoff = async () => {
    if (!selectedShiftForHandoff) return;

    if (!nothingToReport && !handoffNoteText.trim()) {
      Alert.alert(
        'Note Required',
        'Please write a brief note for the incoming caregiver, or check "Nothing to report".'
      );
      return;
    }

    try {
      setHandoffSubmitting(true);
      const result = await careCircleService.completeShiftHandoff(
        {
          shift_id: selectedShiftForHandoff.id,
          handoff_note: handoffNoteText,
          nothing_to_report: nothingToReport,
        },
        currentUser.id
      );

      setHandoffModalVisible(false);
      setBannerNotice(
        `✓ Shift ended successfully! Handoff note posted to timeline.${
          result.nextCaregiverNotified
            ? ' Incoming caregiver notified via alert.'
            : ''
        }`
      );
      await loadCoverage();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to complete handoff';
      Alert.alert('Handoff Error', msg);
    } finally {
      setHandoffSubmitting(false);
    }
  };

  const handleCreateShift = async () => {
    if (!newStartTime.trim() || !newEndTime.trim()) {
      Alert.alert('Error', 'Please enter valid start and end times.');
      return;
    }

    try {
      setCreatingShift(true);
      const initialTasks = [newTask1, newTask2].filter((t) => t.trim().length > 0);
      await careCircleService.createShift(
        {
          care_circle_id: circle.id,
          caregiver_id: newCaregiverId,
          date: new Date().toISOString().split('T')[0],
          start_time: newStartTime.trim(),
          end_time: newEndTime.trim(),
          initial_tasks: initialTasks,
        },
        currentUser.id
      );

      setNewShiftModalVisible(false);
      setBannerNotice('✓ New shift successfully scheduled and assigned.');
      await loadCoverage();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create shift';
      Alert.alert('Shift Creation Error', msg);
    } finally {
      setCreatingShift(false);
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    Alert.alert('Delete Shift', 'Are you sure you want to delete this shift?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await careCircleService.deleteShift(shiftId, circle.id, currentUser.id);
            setBannerNotice('✓ Shift removed from schedule.');
            await loadCoverage();
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to delete shift';
            Alert.alert('Error', msg);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={onBackToCircles}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Back to Circles"
          >
            <Text style={styles.backButtonText}>← Circles</Text>
          </TouchableOpacity>

          {/* Tab Switcher: Today | Coverage | Timeline */}
          <View style={styles.tabSwitcher}>
            <TouchableOpacity
              onPress={onNavigateToToday}
              style={styles.tabButton}
              accessibilityRole="button"
            >
              <Text style={styles.tabTextInactive}>☀️ Today</Text>
            </TouchableOpacity>

            <View style={[styles.tabButton, styles.tabButtonActive]}>
              <Text style={styles.tabTextActive}>👥 Coverage</Text>
            </View>

            <TouchableOpacity
              onPress={onNavigateToTimeline}
              style={styles.tabButton}
              accessibilityRole="button"
            >
              <Text style={styles.tabTextInactive}>📜 Timeline</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.titleRow}>
          <View>
            <Text style={styles.screenPretitle}>CARE TEAM COVERAGE</Text>
            <Text style={styles.screenTitle}>Today's Shift Handoff</Text>
          </View>
          {isAdmin ? (
            <TouchableOpacity
              style={styles.assignShiftButton}
              onPress={() => setNewShiftModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Assign New Shift"
            >
              <Text style={styles.assignShiftButtonText}>+ Assign Shift</Text>
            </TouchableOpacity>
          ) : null}
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
          <Text style={styles.loadingText}>Loading shift coverage...</Text>
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
          {/* Coverage Gap Warning if present */}
          {coverage?.hasCoverageGap && coverage.gapMessage ? (
            <View style={styles.gapWarningBanner}>
              <Text style={styles.gapWarningIcon}>⚠️</Text>
              <View style={styles.gapWarningTextContainer}>
                <Text style={styles.gapWarningTitle}>Coverage Warning</Text>
                <Text style={styles.gapWarningDescription}>
                  {coverage.gapMessage}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Section: Who is Responsible Right Now & Who is Next */}
          <View style={styles.coverageCardsRow}>
            {/* 1. Who is Responsible Right Now */}
            <View style={[styles.dutyCard, styles.currentDutyCard]}>
              <View style={styles.cardBadgeRow}>
                <Text style={styles.cardSectionLabel}>RESPONSIBLE RIGHT NOW</Text>
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>🟢 ACTIVE</Text>
                </View>
              </View>

              {coverage?.currentShift ? (
                <View style={styles.dutyCardContent}>
                  <Text style={styles.caregiverName}>
                    {coverage.currentShift.caregiver?.full_name || 'Caregiver on duty'}
                  </Text>
                  <Text style={styles.shiftTime}>
                    🕒 {coverage.currentShift.start_time} – {coverage.currentShift.end_time}
                  </Text>
                  <Text style={styles.dutySubtitle}>
                    Primary contact for Eleanor's needs and medications right now.
                  </Text>
                </View>
              ) : (
                <View style={styles.dutyCardEmpty}>
                  <Text style={styles.emptyDutyTitle}>No Caregiver on Duty</Text>
                  <Text style={styles.emptyDutySubtitle}>
                    No shift is currently active for this time window.
                  </Text>
                </View>
              )}
            </View>

            {/* 2. Who is Next */}
            <View style={[styles.dutyCard, styles.nextDutyCard]}>
              <View style={styles.cardBadgeRow}>
                <Text style={styles.cardSectionLabel}>WHO IS NEXT</Text>
                <View style={styles.upcomingPill}>
                  <Text style={styles.upcomingPillText}>⏳ NEXT UP</Text>
                </View>
              </View>

              {coverage?.nextShift ? (
                <View style={styles.dutyCardContent}>
                  <Text style={styles.caregiverName}>
                    {coverage.nextShift.caregiver?.full_name || 'Incoming Caregiver'}
                  </Text>
                  <Text style={styles.shiftTime}>
                    🕒 {coverage.nextShift.start_time} – {coverage.nextShift.end_time}
                  </Text>
                  <Text style={styles.dutySubtitle}>
                    Will receive shift handoff notes and task updates.
                  </Text>
                </View>
              ) : (
                <View style={styles.dutyCardEmpty}>
                  <Text style={styles.emptyDutyTitle}>No Next Shift Scheduled</Text>
                  <Text style={styles.emptyDutySubtitle}>
                    All scheduled shifts for today have finished or none upcoming.
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Section: Today's Shift Schedule & Task Checklists */}
          <Text style={styles.sectionHeader}>Today's Shifts & Checklists</Text>

          {coverage?.allTodayShifts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>No Shifts Scheduled Today</Text>
              <Text style={styles.emptyText}>
                {isAdmin
                  ? 'Tap "+ Assign Shift" above to schedule today\'s caregiver shifts.'
                  : 'Your care circle administrator has not assigned any shifts for today yet.'}
              </Text>
            </View>
          ) : (
            coverage?.allTodayShifts.map((shift) => {
              const isAssignedToUser = shift.caregiver_id === currentUser.id;
              const isCompleted = shift.status === 'completed';
              const tasks = shift.tasks || [];
              const completedTasks = tasks.filter((t) => t.completed).length;

              return (
                <View
                  key={shift.id}
                  style={[
                    styles.shiftCard,
                    isCompleted ? styles.shiftCardCompleted : null,
                  ]}
                >
                  <View style={styles.shiftHeader}>
                    <View style={styles.shiftHeaderLeft}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>
                          {shift.caregiver?.full_name?.charAt(0) || 'C'}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.shiftCaregiverName}>
                          {shift.caregiver?.full_name || 'Caregiver'}
                          {isAssignedToUser ? ' (You)' : ''}
                        </Text>
                        <Text style={styles.shiftHours}>
                          🕒 {shift.start_time} – {shift.end_time}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.shiftHeaderRight}>
                      <View
                        style={[
                          styles.shiftStatusBadge,
                          isCompleted
                            ? styles.statusCompleted
                            : shift.status === 'in_progress'
                            ? styles.statusInProgress
                            : styles.statusScheduled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.shiftStatusText,
                            isCompleted
                              ? styles.statusCompletedText
                              : shift.status === 'in_progress'
                              ? styles.statusInProgressText
                              : styles.statusScheduledText,
                          ]}
                        >
                          {isCompleted
                            ? '✓ COMPLETED'
                            : shift.status === 'in_progress'
                            ? '🟢 IN PROGRESS'
                            : '📅 SCHEDULED'}
                        </Text>
                      </View>
                      {isAdmin && !isCompleted ? (
                        <TouchableOpacity
                          onPress={() => handleDeleteShift(shift.id)}
                          style={styles.deleteShiftButton}
                          accessibilityLabel="Delete Shift"
                        >
                          <Text style={styles.deleteShiftText}>✕</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  {/* Task Checklist per shift (Does NOT persist beyond this shift) */}
                  <View style={styles.checklistSection}>
                    <View style={styles.checklistHeader}>
                      <Text style={styles.checklistTitle}>
                        Shift Checklist ({completedTasks}/{tasks.length})
                      </Text>
                      {!isAssignedToUser && !isAdmin ? (
                        <Text style={styles.readOnlyNotice}>🔒 Assigned only</Text>
                      ) : null}
                    </View>

                    {tasks.length === 0 ? (
                      <Text style={styles.noTasksText}>No tasks assigned for this shift.</Text>
                    ) : (
                      tasks.map((task) => (
                        <TouchableOpacity
                          key={task.id}
                          style={[
                            styles.taskRow,
                            task.completed ? styles.taskRowCompleted : null,
                          ]}
                          onPress={() => handleToggleTask(task, shift)}
                          disabled={isCompleted || taskTogglingId === task.id}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.checkbox,
                              task.completed ? styles.checkboxChecked : null,
                            ]}
                          >
                            {task.completed ? (
                              <Text style={styles.checkmarkText}>✓</Text>
                            ) : null}
                          </View>
                          <Text
                            style={[
                              styles.taskTitle,
                              task.completed ? styles.taskTitleCompleted : null,
                            ]}
                          >
                            {task.title}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>

                  {/* Handoff Note Section / Action Button */}
                  {isCompleted ? (
                    <View style={styles.handoffCompletedBox}>
                      <Text style={styles.handoffCompletedHeader}>
                        📋 Handoff Note
                      </Text>
                      <Text style={styles.handoffCompletedText}>
                        "{shift.handoff_note || 'Shift completed smoothly.'}"
                      </Text>
                      {shift.handoff_completed_at ? (
                        <Text style={styles.handoffTimestamp}>
                          Handed off at{' '}
                          {new Date(shift.handoff_completed_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      ) : null}
                    </View>
                  ) : (isAssignedToUser || isAdmin) ? (
                    <Button
                      title="📋 End Shift & Write Handoff Note"
                      variant="primary"
                      onPress={() => handleOpenHandoffModal(shift)}
                      style={styles.handoffButton}
                    />
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Modal 1: Shift Handoff Flow */}
      <Modal
        visible={handoffModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setHandoffModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalPretitle}>SHIFT HANDOFF</Text>
            <Text style={styles.modalTitle}>End Shift & Notify Next Caregiver</Text>

            {selectedShiftForHandoff ? (
              <View style={styles.modalShiftSummary}>
                <Text style={styles.modalSummaryCaregiver}>
                  Caregiver: {selectedShiftForHandoff.caregiver?.full_name || 'Caregiver'}
                </Text>
                <Text style={styles.modalSummaryHours}>
                  Shift: {selectedShiftForHandoff.start_time} – {selectedShiftForHandoff.end_time}
                </Text>
                {coverage?.nextShift ? (
                  <Text style={styles.modalNextAlert}>
                    👉 Next caregiver: {coverage.nextShift.caregiver?.full_name} ({coverage.nextShift.start_time})
                  </Text>
                ) : (
                  <Text style={styles.modalNextAlertMuted}>
                    👉 No immediate next shift scheduled today.
                  </Text>
                )}
              </View>
            ) : null}

            {/* Quick Option: Nothing to report */}
            <TouchableOpacity
              style={[
                styles.nothingToReportRow,
                nothingToReport ? styles.nothingToReportActive : null,
              ]}
              onPress={() => setNothingToReport(!nothingToReport)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.checkbox,
                  nothingToReport ? styles.checkboxChecked : null,
                ]}
              >
                {nothingToReport ? <Text style={styles.checkmarkText}>✓</Text> : null}
              </View>
              <Text style={styles.nothingToReportLabel}>
                Mark: "Nothing to report" (All stable & meds given)
              </Text>
            </TouchableOpacity>

            {!nothingToReport ? (
              <View style={styles.noteInputContainer}>
                <Text style={styles.inputLabel}>
                  Handoff Note for Next Caregiver:
                </Text>
                <TextInput
                  style={styles.textInput}
                  multiline
                  numberOfLines={4}
                  placeholder="e.g. Eleanor ate lunch well, bandage dressing replaced, evening walk completed. Metoprolol given at 12pm."
                  value={handoffNoteText}
                  onChangeText={setHandoffNoteText}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setHandoffModalVisible(false)}
                style={styles.modalCancelButton}
              />
              <Button
                title={handoffSubmitting ? 'Submitting...' : '✓ Complete Handoff'}
                variant="primary"
                onPress={handleSubmitHandoff}
                loading={handoffSubmitting}
                style={styles.modalSubmitButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal 2: Admin Assign Shift Modal */}
      <Modal
        visible={newShiftModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setNewShiftModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalPretitle}>ADMIN SHIFT ASSIGNMENT</Text>
            <Text style={styles.modalTitle}>Schedule Caregiver Shift</Text>

            <Text style={styles.inputLabel}>Assign Caregiver:</Text>
            <View style={styles.caregiverPickerRow}>
              <TouchableOpacity
                style={[
                  styles.caregiverPickerOption,
                  newCaregiverId === '11111111-1111-1111-1111-111111111111'
                    ? styles.caregiverPickerSelected
                    : null,
                ]}
                onPress={() => setNewCaregiverId('11111111-1111-1111-1111-111111111111')}
              >
                <Text
                  style={[
                    styles.caregiverPickerText,
                    newCaregiverId === '11111111-1111-1111-1111-111111111111'
                      ? styles.caregiverPickerTextSelected
                      : null,
                  ]}
                >
                  Sarah Vance
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.caregiverPickerOption,
                  newCaregiverId === '22222222-2222-2222-2222-222222222222'
                    ? styles.caregiverPickerSelected
                    : null,
                ]}
                onPress={() => setNewCaregiverId('22222222-2222-2222-2222-222222222222')}
              >
                <Text
                  style={[
                    styles.caregiverPickerText,
                    newCaregiverId === '22222222-2222-2222-2222-222222222222'
                      ? styles.caregiverPickerTextSelected
                      : null,
                  ]}
                >
                  Dr. Marcus Chen
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.timeInputsRow}>
              <View style={styles.timeInputCol}>
                <Text style={styles.inputLabel}>Start Time (HH:MM):</Text>
                <TextInput
                  style={styles.timeTextInput}
                  value={newStartTime}
                  onChangeText={setNewStartTime}
                  placeholder="08:00"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={styles.timeInputCol}>
                <Text style={styles.inputLabel}>End Time (HH:MM):</Text>
                <TextInput
                  style={styles.timeTextInput}
                  value={newEndTime}
                  onChangeText={setNewEndTime}
                  placeholder="14:00"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Checklist Item 1:</Text>
            <TextInput
              style={styles.singleLineInput}
              value={newTask1}
              onChangeText={setNewTask1}
              placeholder="e.g. Change knee dressing"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Checklist Item 2:</Text>
            <TextInput
              style={styles.singleLineInput}
              value={newTask2}
              onChangeText={setNewTask2}
              placeholder="e.g. Refill weekly pillbox"
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setNewShiftModalVisible(false)}
                style={styles.modalCancelButton}
              />
              <Button
                title={creatingShift ? 'Saving...' : 'Assign Shift'}
                variant="primary"
                onPress={handleCreateShift}
                loading={creatingShift}
                style={styles.modalSubmitButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
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
    fontWeight: '600',
    color: '#475569',
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabTextActive: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0E7490',
  },
  tabTextInactive: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  screenPretitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0E7490',
    letterSpacing: 0.5,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  assignShiftButton: {
    backgroundColor: '#0E7490',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  assignShiftButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  banner: {
    marginTop: 12,
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  bannerText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  gapWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  gapWarningIcon: {
    fontSize: 26,
    marginRight: 12,
  },
  gapWarningTextContainer: {
    flex: 1,
  },
  gapWarningTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#991B1B',
  },
  gapWarningDescription: {
    fontSize: 13,
    color: '#B91C1C',
    marginTop: 2,
    lineHeight: 18,
  },
  coverageCardsRow: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 20,
  },
  dutyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  currentDutyCard: {
    borderLeftWidth: 5,
    borderLeftColor: '#10B981',
  },
  nextDutyCard: {
    borderLeftWidth: 5,
    borderLeftColor: '#3B82F6',
  },
  cardBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  activePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  upcomingPill: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  upcomingPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  dutyCardContent: {
    marginTop: 2,
  },
  caregiverName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  shiftTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0E7490',
    marginTop: 4,
  },
  dutySubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 18,
  },
  dutyCardEmpty: {
    paddingVertical: 8,
  },
  emptyDutyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#94A3B8',
  },
  emptyDutySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  shiftCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shiftCardCompleted: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  shiftHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0284C7',
  },
  shiftCaregiverName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  shiftHours: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  shiftHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shiftStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  shiftStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusScheduled: {
    backgroundColor: '#F1F5F9',
  },
  statusScheduledText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  statusInProgress: {
    backgroundColor: '#DCFCE7',
  },
  statusInProgressText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  statusCompleted: {
    backgroundColor: '#E2E8F0',
  },
  statusCompletedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  deleteShiftButton: {
    padding: 6,
  },
  deleteShiftText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '700',
  },
  checklistSection: {
    marginTop: 12,
  },
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  checklistTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  readOnlyNotice: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  noTasksText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 6,
  },
  taskRowCompleted: {
    backgroundColor: '#F0FDF4',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  taskTitle: {
    fontSize: 14,
    color: '#1E293B',
    flex: 1,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  handoffButton: {
    marginTop: 12,
  },
  handoffCompletedBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0E7490',
  },
  handoffCompletedHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0E7490',
    marginBottom: 4,
  },
  handoffCompletedText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#334155',
    lineHeight: 20,
  },
  handoffTimestamp: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  modalPretitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0E7490',
    letterSpacing: 0.5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
    marginBottom: 14,
  },
  modalShiftSummary: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#0E7490',
  },
  modalSummaryCaregiver: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSummaryHours: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  modalNextAlert: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '700',
    marginTop: 6,
  },
  modalNextAlertMuted: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
  },
  nothingToReportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  nothingToReportActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  nothingToReportLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  noteInputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
    textAlignVertical: 'top',
    minHeight: 90,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
  },
  modalSubmitButton: {
    flex: 1.5,
  },
  caregiverPickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  caregiverPickerOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  caregiverPickerSelected: {
    borderColor: '#0E7490',
    backgroundColor: '#E0F2FE',
  },
  caregiverPickerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  caregiverPickerTextSelected: {
    color: '#0E7490',
    fontWeight: '800',
  },
  timeInputsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  timeInputCol: {
    flex: 1,
  },
  timeTextInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  singleLineInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 14,
  },
});
