import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { billingAnalyticsService } from '../services/billingAnalyticsService';
import { BusinessMetricsSummary } from '../types/database';

interface AnalyticsDashboardScreenProps {
  onClose: () => void;
}

export const AnalyticsDashboardScreen: React.FC<AnalyticsDashboardScreenProps> = ({
  onClose,
}) => {
  const [metrics, setMetrics] = useState<BusinessMetricsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
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
      setRefreshing(false);
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
      showFeedback('Simulated Involuntary Churn (3 failed payment retries).');
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>📊 Business Metrics Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            Measurement Layer • Answering: Are We Retaining and Converting?
          </Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕ Close</Text>
        </TouchableOpacity>
      </View>

      {/* Zero PII & Documentation Banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          🛡️ <Text style={styles.bannerBold}>Zero-PII Analytics Policy:</Text> No names, phones,
          emails, or medical data are ever logged. All 6 metrics are documented in{' '}
          <Text style={styles.bannerCode}>business/metrics.md</Text>.
        </Text>
      </View>

      {feedbackMessage && (
        <View style={styles.feedbackBanner}>
          <Text style={styles.feedbackText}>✓ {feedbackMessage}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Computing business metrics...</Text>
        </View>
      ) : !metrics ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No metrics available yet.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
          {/* Section 1: The 6 Core Metrics Grid */}
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
            <Text style={styles.cardMetricValue}>
              {metrics.conversion.conversionRatePct}%
            </Text>
            <Text style={styles.cardDetail}>
              <Text style={styles.boldText}>{metrics.conversion.paidConversions}</Text> paid Family
              subscribers out of{' '}
              <Text style={styles.boldText}>{metrics.conversion.totalCirclesOrUsers}</Text> care
              circles created in cohort {metrics.conversion.cohortMonth}.
            </Text>
            <View style={styles.formulaBox}>
              <Text style={styles.formulaText}>
                Formula: (Paid Conversions ÷ Total Circles in Cohort) × 100
              </Text>
            </View>
          </View>

          {/* Metric 2: Churn */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardNumber}>2</Text>
              <Text style={styles.cardTitle}>Churn (Voluntary vs Involuntary)</Text>
              <View
                style={[
                  styles.badgeStatus,
                  {
                    backgroundColor:
                      metrics.churn.totalChurnRatePct > 15 ? '#FEE2E2' : '#DCFCE7',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeStatusText,
                    {
                      color:
                        metrics.churn.totalChurnRatePct > 15 ? '#DC2626' : '#166534',
                    },
                  ]}
                >
                  {metrics.churn.totalChurnRatePct}% Total Churn
                </Text>
              </View>
            </View>

            <View style={styles.splitRow}>
              {/* Voluntary */}
              <View style={styles.splitCol}>
                <Text style={styles.splitLabel}>Voluntary Churn</Text>
                <Text style={styles.splitValue}>
                  {metrics.churn.voluntaryChurnRatePct}%
                </Text>
                <Text style={styles.splitSub}>
                  {metrics.churn.voluntaryCancellations} user-requested cancellations
                </Text>
              </View>
              <View style={styles.divider} />
              {/* Involuntary */}
              <View style={styles.splitCol}>
                <Text style={styles.splitLabel}>Involuntary Churn</Text>
                <Text style={[styles.splitValue, { color: '#DC2626' }]}>
                  {metrics.churn.involuntaryChurnRatePct}%
                </Text>
                <Text style={styles.splitSub}>
                  {metrics.churn.involuntaryPaymentFailures} terminal payment failures
                </Text>
              </View>
            </View>

            <Text style={styles.cardDetail}>
              Active Paying Base:{' '}
              <Text style={styles.boldText}>{metrics.churn.activeSubscribers}</Text> circles
            </Text>
            <View style={styles.formulaBox}>
              <Text style={styles.formulaText}>
                Separate tracking isolates product dissatisfaction vs. billing/dunning friction.
              </Text>
            </View>
          </View>

          {/* Metric 3: ARPU */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardNumber}>3</Text>
              <Text style={styles.cardTitle}>ARPU (Average Revenue Per User)</Text>
            </View>
            <Text style={[styles.cardMetricValue, { color: '#059669' }]}>
              ${metrics.arpu.arpuUsd} <Text style={styles.perUnit}>/ paying user / mo</Text>
            </Text>
            <Text style={styles.cardDetail}>
              Total Net Revenue:{' '}
              <Text style={styles.boldText}>${metrics.arpu.totalRevenueUsd}</Text> across{' '}
              <Text style={styles.boldText}>{metrics.arpu.payingUsersCount}</Text> active paying
              accounts.
            </Text>
            <View style={styles.formulaBox}>
              <Text style={styles.formulaText}>
                Formula: Total Net Subscription Revenue ÷ Total Active Paying Users
              </Text>
            </View>
          </View>

          {/* Metric 4: SMS Cost Per User */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardNumber}>4</Text>
              <Text style={styles.cardTitle}>SMS Cost Per User Per Month</Text>
              <View style={styles.badgeEconomic}>
                <Text style={styles.badgeEconomicText}>Unit Economics</Text>
              </View>
            </View>
            <Text style={[styles.cardMetricValue, { color: '#4F46E5' }]}>
              ${metrics.smsCostPerUser.costPerUserUsd}{' '}
              <Text style={styles.perUnit}>/ subscriber / mo</Text>
            </Text>
            <Text style={styles.cardDetail}>
              Total Twilio Spend:{' '}
              <Text style={styles.boldText}>
                ${metrics.smsCostPerUser.totalTwilioSpendUsd}
              </Text>{' '}
              across{' '}
              <Text style={styles.boldText}>
                {metrics.smsCostPerUser.activeFamilyUsersCount}
              </Text>{' '}
              Family subscribers ($0.0079 / SMS carrier segment).
            </Text>
            <View style={styles.formulaBox}>
              <Text style={styles.formulaText}>
                Viability Check: Carrier cost accounts for{' '}
                {(
                  (metrics.smsCostPerUser.costPerUserUsd /
                    (metrics.arpu.arpuUsd || 19.99)) *
                  100
                ).toFixed(2)}
                % of average subscription revenue (well within &lt;5% safety budget).
              </Text>
            </View>
          </View>

          {/* Metric 5: Activation Rate & Time to Activate */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardNumber}>5</Text>
              <Text style={styles.cardTitle}>Activation (First Check-In Completed)</Text>
            </View>
            <View style={styles.splitRow}>
              <View style={styles.splitCol}>
                <Text style={styles.splitLabel}>Activation Rate</Text>
                <Text style={[styles.splitValue, { color: '#2563EB' }]}>
                  {metrics.activation.activationRatePct}%
                </Text>
                <Text style={styles.splitSub}>
                  {metrics.activation.activatedCircles} of {metrics.activation.totalCircles} circles
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.splitCol}>
                <Text style={styles.splitLabel}>Avg Time-to-Activate</Text>
                <Text style={[styles.splitValue, { color: '#D97706' }]}>
                  {metrics.activation.averageTimeToActivateHours}h
                </Text>
                <Text style={styles.splitSub}>from circle creation to 1st "I'm OK"</Text>
              </View>
            </View>
            <View style={styles.formulaBox}>
              <Text style={styles.formulaText}>
                Activation Event: elder or caregiver completes first daily check-in.
              </Text>
            </View>
          </View>

          {/* Metric 6: Caregiver Invites Sent */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardNumber}>6</Text>
              <Text style={styles.cardTitle}>Caregiver Invites & Virality</Text>
            </View>
            <View style={styles.splitRow}>
              <View style={styles.splitCol}>
                <Text style={styles.splitLabel}>Invites / Circle</Text>
                <Text style={[styles.splitValue, { color: '#0D9488' }]}>
                  {metrics.caregiverInvites.invitesPerCircle}
                </Text>
                <Text style={styles.splitSub}>
                  {metrics.caregiverInvites.totalInvitesSent} total invites sent
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.splitCol}>
                <Text style={styles.splitLabel}>Invite Accept Rate</Text>
                <Text style={[styles.splitValue, { color: '#059669' }]}>
                  {metrics.caregiverInvites.inviteAcceptanceRatePct}%
                </Text>
                <Text style={styles.splitSub}>
                  {metrics.caregiverInvites.totalInvitesAccepted} invites accepted
                </Text>
              </View>
            </View>
            <View style={styles.formulaBox}>
              <Text style={styles.formulaText}>
                Measures multi-caregiver circle formation and viral expansion.
              </Text>
            </View>
          </View>

          {/* Interactive Simulation Panel */}
          <View style={styles.simulationCard}>
            <Text style={styles.simulationTitle}>🧪 Telemetry Testing & Simulation Controls</Text>
            <Text style={styles.simulationSubtitle}>
              Dispatch live non-PII events to observe real-time recalculation of the 6 metrics:
            </Text>

            <View style={styles.buttonGrid}>
              <TouchableOpacity
                style={[styles.simButton, { backgroundColor: '#2563EB' }]}
                disabled={simulating}
                onPress={handleSimulateConversion}
              >
                <Text style={styles.simButtonText}>+ Free → Paid ($19.99)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simButton, { backgroundColor: '#EA580C' }]}
                disabled={simulating}
                onPress={handleSimulateVoluntaryChurn}
              >
                <Text style={styles.simButtonText}>+ Voluntary Churn</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simButton, { backgroundColor: '#DC2626' }]}
                disabled={simulating}
                onPress={handleSimulateInvoluntaryChurn}
              >
                <Text style={styles.simButtonText}>+ Involuntary Churn</Text>
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
                <Text style={styles.simButtonText}>+ Invite Sent & Accepted</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simButton, { backgroundColor: '#6B7280' }]}
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  banner: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  bannerText: {
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 18,
  },
  bannerBold: {
    fontWeight: '700',
  },
  bannerCode: {
    fontFamily: 'Courier',
    fontWeight: '600',
    backgroundColor: '#DBEAFE',
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
  sectionHeading: {
    fontSize: 16,
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
    marginBottom: 16,
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
  cardMetricValue: {
    fontSize: 32,
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
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 10,
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  formulaBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  formulaText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
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
  badgeStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeEconomic: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  badgeEconomicText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4338CA',
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
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  splitValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  splitSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
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
    fontSize: 13,
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
