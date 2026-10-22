import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { billingAnalyticsService } from '../services/billingAnalyticsService';
import { BusinessMetricsSummary, MetricTimeSeriesPoint } from '../types/database';

interface AnalyticsDashboardScreenProps {
  onClose: () => void;
}

export const AnalyticsDashboardScreen: React.FC<AnalyticsDashboardScreenProps> = ({
  onClose,
}) => {
  const [metrics, setMetrics] = useState<BusinessMetricsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    try {
      const summary = await billingAnalyticsService.getBusinessMetricsSummary(undefined, true);
      setMetrics(summary);
    } catch (err) {
      console.warn('Failed to calculate metrics summary:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 3000);
  };

  const handleSimulateConversion = async () => {
    setSimulating(true);
    try {
      const circleId = `sim-circle-${Date.now().toString(36)}`;
      const userId = `sim-user-${Date.now().toString(36)}`;
      await billingAnalyticsService.recordSubscriptionStarted(
        circleId,
        userId,
        'family_monthly',
        19.99,
        'monthly'
      );
      await billingAnalyticsService.recordPaymentSucceeded(
        circleId,
        userId,
        'family_monthly',
        19.99,
        'monthly'
      );
      showFeedback('Simulated Free → Paid conversion ($19.99/mo). Metrics updated.');
      await loadMetrics();
    } catch (err) {
      console.warn(err);
    } finally {
      setSimulating(false);
    }
  };

  const handleSimulateVoluntaryChurn = async () => {
    setSimulating(true);
    try {
      const circleId = `sim-circle-vol-${Date.now().toString(36)}`;
      const userId = `sim-user-${Date.now().toString(36)}`;
      await billingAnalyticsService.recordSubscriptionStarted(
        circleId,
        userId,
        'family_monthly',
        19.99
      );
      await billingAnalyticsService.recordSubscriptionCancelled(
        circleId,
        userId,
        'family_monthly',
        'loved_one_recovered',
        19.99
      );
      showFeedback('Simulated Voluntary Cancellation. Voluntary churn updated.');
      await loadMetrics();
    } catch (err) {
      console.warn(err);
    } finally {
      setSimulating(false);
    }
  };

  const handleSimulateInvoluntaryChurn = async () => {
    setSimulating(true);
    try {
      const circleId = `sim-circle-invol-${Date.now().toString(36)}`;
      const userId = `sim-user-${Date.now().toString(36)}`;
      await billingAnalyticsService.recordSubscriptionStarted(
        circleId,
        userId,
        'family_monthly',
        19.99
      );
      await billingAnalyticsService.recordPaymentFailed(
        circleId,
        userId,
        'family_monthly',
        3,
        true,
        19.99
      );
      showFeedback('Simulated Involuntary Churn (3 terminal payment retries).');
      await loadMetrics();
    } catch (err) {
      console.warn(err);
    } finally {
      setSimulating(false);
    }
  };

  const handleSimulateSms = async () => {
    setSimulating(true);
    try {
      await billingAnalyticsService.recordSmsDispatched('circle-demo', 0.0079, 2);
      showFeedback('Simulated Twilio SMS Carrier dispatch ($0.0079 spend).');
      await loadMetrics();
    } catch (err) {
      console.warn(err);
    } finally {
      setSimulating(false);
    }
  };

  const handleSimulateInviteFlow = async () => {
    setSimulating(true);
    try {
      const circleId = 'circle-demo-invite';
      await billingAnalyticsService.recordCaregiverInviteSent(circleId, 'share_link');
      await billingAnalyticsService.recordCaregiverInviteAccepted(circleId, 'viewer');
      showFeedback('Simulated Caregiver invite sent & accepted.');
      await loadMetrics();
    } catch (err) {
      console.warn(err);
    } finally {
      setSimulating(false);
    }
  };

  const handleReset = async () => {
    billingAnalyticsService.reset(true);
    showFeedback('Telemetry buffer reset to initial baseline.');
    await loadMetrics();
  };

  // Render Time Series Trend Table/Bar
  const renderTimeSeries = (points: MetricTimeSeriesPoint[], unit: string = '%') => {
    if (!points || points.length === 0) return null;
    return (
      <View style={styles.timeSeriesContainer}>
        <Text style={styles.timeSeriesHeading}>Time Series (Cohort Trajectory):</Text>
        <View style={styles.timeSeriesRow}>
          {points.map((pt) => (
            <View key={pt.period} style={styles.timeSeriesPoint}>
              <Text style={styles.timeSeriesPeriod}>{pt.period}</Text>
              <View style={styles.timeSeriesBarTrack}>
                <View
                  style={[
                    styles.timeSeriesBarFill,
                    {
                      height: Math.min(Math.max((pt.metricValue / 100) * 36, 6), 36),
                    },
                  ]}
                />
              </View>
              <Text style={styles.timeSeriesValue}>
                {pt.label || `${pt.metricValue}${unit}`}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Render Empty State when no events exist
  const renderEmptyState = (metricName: string) => (
    <View style={styles.emptyStateBox}>
      <Text style={styles.emptyStateTitle}>⚠️ No Events Recorded ({metricName})</Text>
      <Text style={styles.emptyStateSub}>
        Empty state displayed — fake numbers are strictly prohibited. The metric will populate once the first valid event is ingested.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header with 2-line architecture justification */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>🔒 Internal Business Metrics Console</Text>
          <Text style={styles.headerSubtitle}>
            Architecture: Server-backed operational console querying Supabase service-role views directly.
            Keeps zero-PII security role isolation intact without standing up separate infrastructure.
          </Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕ Close</Text>
        </TouchableOpacity>
      </View>

      {feedbackMessage && (
        <View style={styles.feedbackBanner}>
          <Text style={styles.feedbackText}>✓ {feedbackMessage}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Computing server truth views...</Text>
        </View>
      ) : !metrics ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No metrics available.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
          {/* ========================================================= */}
          {/* DATA QUALITY PANEL                                        */}
          {/* ========================================================= */}
          <View
            style={[
              styles.dataQualityCard,
              {
                borderColor: metrics.dataQuality.is_healthy ? '#86EFAC' : '#FCA5A5',
                backgroundColor: metrics.dataQuality.is_healthy ? '#F0FDF4' : '#FEF2F2',
              },
            ]}
          >
            <View style={styles.dqHeader}>
              <Text style={styles.dqTitle}>
                {metrics.dataQuality.is_healthy ? '🛡️ Data Quality: Healthy' : '🚨 Data Quality: Degraded'}
              </Text>
              <View
                style={[
                  styles.dqBadge,
                  { backgroundColor: metrics.dataQuality.is_healthy ? '#DCFCE7' : '#FEE2E2' },
                ]}
              >
                <Text
                  style={[
                    styles.dqBadgeText,
                    { color: metrics.dataQuality.is_healthy ? '#166534' : '#991B1B' },
                  ]}
                >
                  {metrics.dataQuality.is_healthy ? 'TRUSTED METRICS' : 'UNTRUSTED METRICS'}
                </Text>
              </View>
            </View>

            <Text
              style={[
                styles.dqStatusMessage,
                { color: metrics.dataQuality.is_healthy ? '#15803D' : '#DC2626' },
              ]}
            >
              {metrics.dataQuality.status_message}
            </Text>

            <View style={styles.dqGrid}>
              <View style={styles.dqItem}>
                <Text style={styles.dqItemLabel}>Events (Last 24h)</Text>
                <Text style={styles.dqItemValue}>{metrics.dataQuality.events_last_24h}</Text>
              </View>
              <View style={styles.dqItem}>
                <Text style={styles.dqItemLabel}>Events Rejected (RLS)</Text>
                <Text
                  style={[
                    styles.dqItemValue,
                    { color: metrics.dataQuality.events_rejected_rls > 0 ? '#DC2626' : '#0F172A' },
                  ]}
                >
                  {metrics.dataQuality.events_rejected_rls}
                </Text>
              </View>
              <View style={styles.dqItem}>
                <Text style={styles.dqItemLabel}>Twilio Sends vs Usage</Text>
                <Text style={styles.dqItemValue}>
                  {metrics.dataQuality.twilio_sends_count} / {metrics.dataQuality.twilio_usage_rows_count}
                </Text>
                <Text style={styles.dqItemSub}>
                  Delta: {metrics.dataQuality.twilio_discrepancy_delta}
                </Text>
              </View>
              <View style={styles.dqItem}>
                <Text style={styles.dqItemLabel}>Invalid Subscriptions</Text>
                <Text
                  style={[
                    styles.dqItemValue,
                    {
                      color:
                        metrics.dataQuality.subscriptions_invalid_plan_count > 0
                          ? '#DC2626'
                          : '#0F172A',
                    },
                  ]}
                >
                  {metrics.dataQuality.subscriptions_invalid_plan_count}
                </Text>
              </View>
            </View>
          </View>

          {/* ========================================================= */}
          {/* THE 6 CORE BUSINESS METRICS                               */}
          {/* ========================================================= */}
          <Text style={styles.sectionHeading}>The 6 Core Business Metrics</Text>

          {/* Metric 1: Free -> Paid Conversion */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardNumber}>1</Text>
              <Text style={styles.cardTitle}>Free → Paid Conversion</Text>
              <View style={styles.badgeCohort}>
                <Text style={styles.badgeCohortText}>{metrics.conversion.cohortMonth}</Text>
              </View>
            </View>

            {metrics.conversion.hasData ? (
              <>
                <Text style={styles.cardHeadlineValue}>
                  {metrics.conversion.conversionRatePct}% Conversion
                </Text>
                <Text style={styles.cardDetail}>
                  <Text style={styles.boldText}>{metrics.conversion.paidConversions}</Text> paid
                  Family circles out of{' '}
                  <Text style={styles.boldText}>{metrics.conversion.totalCirclesOrUsers}</Text>{' '}
                  circles created in cohort {metrics.conversion.cohortMonth}.
                </Text>
                {renderTimeSeries(metrics.conversion.timeSeries)}
              </>
            ) : (
              renderEmptyState('Free → Paid Conversion')
            )}

            <View style={styles.caveatBox}>
              <Text style={styles.caveatLabel}>Phase 0 Failure-Mode Caveat:</Text>
              <Text style={styles.caveatText}>
                User drop-offs before payment gateway return will cause client events to be lost.
                Metrics are reconciled server-side against public.subscriptions. Offline circle
                creations may cause slight cohort month boundary skews.
              </Text>
            </View>
          </View>

          {/* Metric 2: Churn */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardNumber}>2</Text>
              <Text style={styles.cardTitle}>Churn (Voluntary vs Involuntary)</Text>
            </View>

            {metrics.churn.hasData ? (
              <>
                <Text style={[styles.cardHeadlineValue, { color: '#DC2626' }]}>
                  {metrics.churn.totalChurnRatePct}% Total Churn
                </Text>
                <View style={styles.splitRow}>
                  <View style={styles.splitCol}>
                    <Text style={styles.splitLabel}>Voluntary Churn</Text>
                    <Text style={styles.splitValue}>
                      {metrics.churn.voluntaryChurnRatePct}%
                    </Text>
                    <Text style={styles.splitSub}>
                      {metrics.churn.voluntaryCancellations} cancellations
                    </Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.splitCol}>
                    <Text style={styles.splitLabel}>Involuntary Churn</Text>
                    <Text style={[styles.splitValue, { color: '#DC2626' }]}>
                      {metrics.churn.involuntaryChurnRatePct}%
                    </Text>
                    <Text style={styles.splitSub}>
                      {metrics.churn.involuntaryPaymentFailures} card failures
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardDetail}>
                  Active Paying Base:{' '}
                  <Text style={styles.boldText}>{metrics.churn.activeSubscribers}</Text> circles
                </Text>
                {renderTimeSeries(metrics.churn.timeSeries)}
              </>
            ) : (
              renderEmptyState('Churn')
            )}

            <View style={styles.caveatBox}>
              <Text style={styles.caveatLabel}>Phase 0 Failure-Mode Caveat:</Text>
              <Text style={styles.caveatText}>
                Involuntary churn dunning retries that span across month boundaries shift terminal
                failure attribution to the subsequent calendar month. Net churn is deduplicated on
                care_circle_id.
              </Text>
            </View>
          </View>

          {/* Metric 3: ARPU */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardNumber}>3</Text>
              <Text style={styles.cardTitle}>ARPU (Average Revenue Per User)</Text>
            </View>

            {metrics.arpu.hasData ? (
              <>
                <Text style={[styles.cardHeadlineValue, { color: '#059669' }]}>
                  ${metrics.arpu.arpuUsd} <Text style={styles.perUnit}>/ paying user / mo</Text>
                </Text>
                <Text style={styles.cardDetail}>
                  Total Monthly Revenue:{' '}
                  <Text style={styles.boldText}>${metrics.arpu.totalRevenueUsd}</Text> across{' '}
                  <Text style={styles.boldText}>{metrics.arpu.payingUsersCount}</Text> active
                  paying accounts.
                </Text>
                {renderTimeSeries(metrics.arpu.timeSeries, '$')}
              </>
            ) : (
              renderEmptyState('ARPU')
            )}

            <View style={styles.caveatBox}>
              <Text style={styles.caveatLabel}>Phase 0 Failure-Mode Caveat:</Text>
              <Text style={styles.caveatText}>
                Annual subscriptions ($199.99) are normalized to amortized monthly MRR ($16.67/mo)
                rather than recognized as a single lump-sum in Month 1 to prevent false ARPU spikes.
              </Text>
            </View>
          </View>

          {/* Metric 4: SMS Cost Per User */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardNumber}>4</Text>
              <Text style={styles.cardTitle}>SMS Cost Per User Per Month</Text>
            </View>

            {metrics.smsCostPerUser.hasData ? (
              <>
                <Text style={[styles.cardHeadlineValue, { color: '#4F46E5' }]}>
                  ${metrics.smsCostPerUser.costPerUserUsd}{' '}
                  <Text style={styles.perUnit}>/ subscriber / mo</Text>
                </Text>
                <Text style={styles.cardDetail}>
                  Twilio Spend:{' '}
                  <Text style={styles.boldText}>${metrics.smsCostPerUser.totalTwilioSpendUsd}</Text>{' '}
                  across{' '}
                  <Text style={styles.boldText}>
                    {metrics.smsCostPerUser.activeFamilyUsersCount}
                  </Text>{' '}
                  Family subscribers (carrier estimate constant: $0.0079 / SMS).
                </Text>
                {renderTimeSeries(metrics.smsCostPerUser.timeSeries, '$')}
              </>
            ) : (
              renderEmptyState('SMS Cost Per User')
            )}

            <View style={styles.caveatBox}>
              <Text style={styles.caveatLabel}>Phase 0 Failure-Mode Caveat:</Text>
              <Text style={styles.caveatText}>
                SMS carrier expenditure assumes standard US GSM-7 segment cost ($0.0079). Any
                notification exceeding 160 characters splits into 2 billed segments.
                Landline/unallocated carrier delivery attempts are billed by Twilio regardless of
                delivery success.
              </Text>
            </View>
          </View>

          {/* Metric 5: Activation Rate & Time to Activate */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardNumber}>5</Text>
              <Text style={styles.cardTitle}>Activation (First Check-In Completed)</Text>
            </View>

            {metrics.activation.hasData ? (
              <>
                <Text style={[styles.cardHeadlineValue, { color: '#2563EB' }]}>
                  {metrics.activation.activationRatePct}% Activated
                </Text>
                <View style={styles.splitRow}>
                  <View style={styles.splitCol}>
                    <Text style={styles.splitLabel}>Activated Circles</Text>
                    <Text style={styles.splitValue}>
                      {metrics.activation.activatedCircles} / {metrics.activation.totalCircles}
                    </Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.splitCol}>
                    <Text style={styles.splitLabel}>Avg Time-to-Activate</Text>
                    <Text style={[styles.splitValue, { color: '#D97706' }]}>
                      {metrics.activation.averageTimeToActivateHours}h
                    </Text>
                  </View>
                </View>
                {renderTimeSeries(metrics.activation.timeSeries)}
              </>
            ) : (
              renderEmptyState('Activation')
            )}

            <View style={styles.caveatBox}>
              <Text style={styles.caveatLabel}>Phase 0 Failure-Mode Caveat:</Text>
              <Text style={styles.caveatText}>
                Elder check-ins queued offline record initial tap timestamps to prevent artificially
                inflated TTA upon reconnection. Care circles created late at night will naturally
                record a higher TTA (up to 12h) due to overnight sleep schedules.
              </Text>
            </View>
          </View>

          {/* Metric 6: Caregiver Invites Sent */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardNumber}>6</Text>
              <Text style={styles.cardTitle}>Caregiver Invites & Virality</Text>
            </View>

            {metrics.caregiverInvites.hasData ? (
              <>
                <Text style={[styles.cardHeadlineValue, { color: '#0D9488' }]}>
                  {metrics.caregiverInvites.invitesPerCircle} Invites / Circle
                </Text>
                <View style={styles.splitRow}>
                  <View style={styles.splitCol}>
                    <Text style={styles.splitLabel}>Total Invites Sent</Text>
                    <Text style={styles.splitValue}>
                      {metrics.caregiverInvites.totalInvitesSent}
                    </Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.splitCol}>
                    <Text style={styles.splitLabel}>Invite Accept Rate</Text>
                    <Text style={[styles.splitValue, { color: '#059669' }]}>
                      {metrics.caregiverInvites.inviteAcceptanceRatePct}%
                    </Text>
                    <Text style={styles.splitSub}>
                      {metrics.caregiverInvites.totalInvitesAccepted} accepted
                    </Text>
                  </View>
                </View>
                {renderTimeSeries(metrics.caregiverInvites.timeSeries, '')}
              </>
            ) : (
              renderEmptyState('Caregiver Invites')
            )}

            <View style={styles.caveatBox}>
              <Text style={styles.caveatLabel}>Phase 0 Failure-Mode Caveat:</Text>
              <Text style={styles.caveatText}>
                Rapid successive taps on 'Copy Code' are debounced to prevent artificial inflation of
                total invites sent. Verbal code sharing via external unmonitored channels can lead to
                invite acceptance rates exceeding 100%.
              </Text>
            </View>
          </View>

          {/* Interactive Simulation Controls */}
          <View style={styles.simulationCard}>
            <Text style={styles.simulationTitle}>🧪 Internal Telemetry & Event Ingestion Simulator</Text>
            <Text style={styles.simulationSubtitle}>
              Simulate live non-PII operational events to verify time series recalculation and data quality checks:
            </Text>

            <View style={styles.buttonGrid}>
              <TouchableOpacity
                style={[styles.simButton, { backgroundColor: '#2563EB' }]}
                disabled={simulating}
                onPress={handleSimulateConversion}
              >
                <Text style={styles.simButtonText}>+ Conversion ($19.99)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simButton, { backgroundColor: '#EA580C' }]}
                disabled={simulating}
                onPress={handleSimulateVoluntaryChurn}
              >
                <Text style={styles.simButtonText}>+ Vol. Churn</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simButton, { backgroundColor: '#DC2626' }]}
                disabled={simulating}
                onPress={handleSimulateInvoluntaryChurn}
              >
                <Text style={styles.simButtonText}>+ Invol. Churn</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simButton, { backgroundColor: '#7C3AED' }]}
                disabled={simulating}
                onPress={handleSimulateSms}
              >
                <Text style={styles.simButtonText}>+ Twilio SMS ($0.0079)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simButton, { backgroundColor: '#0D9488' }]}
                disabled={simulating}
                onPress={handleSimulateInviteFlow}
              >
                <Text style={styles.simButtonText}>+ Invite Flow</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simButton, { backgroundColor: '#475569' }]}
                disabled={simulating}
                onPress={handleReset}
              >
                <Text style={styles.simButtonText}>↺ Reset Baseline</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    flex: 1,
    paddingRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 16,
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  closeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  feedbackBanner: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#BBF7D0',
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  emptyText: {
    fontSize: 15,
    color: '#64748B',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 20,
    paddingBottom: 40,
  },
  dataQualityCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
  },
  dqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dqTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  dqBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dqBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dqStatusMessage: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  dqGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dqItem: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dqItemLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  dqItemValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  dqItemSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '700',
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  cardHeadlineValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  perUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  cardDetail: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 12,
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  badgeCohort: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  badgeCohortText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  splitCol: {
    flex: 1,
  },
  divider: {
    width: 1,
    height: 48,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 14,
  },
  splitLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  splitValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  splitSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  timeSeriesContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  timeSeriesHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  timeSeriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 60,
  },
  timeSeriesPoint: {
    alignItems: 'center',
    flex: 1,
  },
  timeSeriesPeriod: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 4,
  },
  timeSeriesBarTrack: {
    width: 24,
    height: 36,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  timeSeriesBarFill: {
    width: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 4,
  },
  timeSeriesValue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },
  caveatBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  caveatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  caveatText: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 16,
  },
  emptyStateBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyStateTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  simulationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  simulationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  simulationSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  simButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
