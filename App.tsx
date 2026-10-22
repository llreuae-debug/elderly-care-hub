import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from './src/lib/supabase';
import { AuthScreen } from './src/screens/AuthScreen';
import { CircleSelectScreen } from './src/screens/CircleSelectScreen';
import { ElderHomeScreen } from './src/screens/ElderHomeScreen';
import { ElderLoginScreen } from './src/screens/ElderLoginScreen';
import { CoverageScreen } from './src/screens/CoverageScreen';
import { TimelineScreen } from './src/screens/TimelineScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { OnboardingModal, ONBOARDING_KEY } from './src/screens/OnboardingModal';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { SEED_CARE_CIRCLE } from './src/services/mockData';
import { CareCircle, ElderSession, UserProfile } from './src/types/database';
import { offlineService } from './src/services/offlineService';
import { careCircleService } from './src/services/careCircleService';

export default function App() {
  const [appMode, setAppMode] = useState<'caregiver' | 'elder'>('caregiver');
  const [elderSession, setElderSession] = useState<ElderSession | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeCircle, setActiveCircle] = useState<CareCircle | null>(null);
  const [activeTab, setActiveTab] = useState<'today' | 'coverage' | 'timeline'>('today');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isOffline, setIsOffline] = useState(offlineService.isOffline());
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  useEffect(() => {
    // Check first-run onboarding status
    AsyncStorage.getItem(ONBOARDING_KEY).then((value) => {
      if (!value) {
        setShowOnboarding(true);
      }
    });

    // Listen to offline connectivity changes
    const unsub = offlineService.addConnectivityListener((offline) => {
      setIsOffline(offline);
    });

    if (!isSupabaseConfigured()) {
      return unsub;
    }

    // Supabase auth listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (profile) {
              setCurrentUser(profile as UserProfile);
            } else {
              setCurrentUser({
                id: session.user.id,
                email: session.user.email || '',
                full_name:
                  session.user.user_metadata?.full_name ||
                  session.user.email?.split('@')[0] ||
                  'Caregiver',
                avatar_url: null,
                created_at: session.user.created_at,
              });
            }
          } catch {
            // Profile fetch optional fallback
          }
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setActiveCircle(null);
        }
      }
    );

    return () => {
      unsub();
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleToggleAirplaneMode = async () => {
    const nextOffline = !isOffline;
    offlineService.setOffline(nextOffline);
    setIsOffline(nextOffline);

    if (!nextOffline) {
      // Reconnected! Automatically sync offline queued check-ins
      const { syncedCount } = await offlineService.syncOfflineQueue(
        async (circleId, userId, notes) => {
          return careCircleService.recordDailyCheckIn(circleId, userId, undefined, notes);
        }
      );

      if (syncedCount > 0) {
        setSyncNotice(`✓ Reconnected! Synced ${syncedCount} queued check-in(s) to timeline.`);
        setTimeout(() => setSyncNotice(null), 5000);
      }
    }
  };

  const handleAuthenticated = (user: UserProfile) => {
    setCurrentUser(user);
    if (user.id === '11111111-1111-1111-1111-111111111111' || user.id === '22222222-2222-2222-2222-222222222222') {
      setActiveCircle(SEED_CARE_CIRCLE);
      setActiveTab('today');
    }
  };

  const handleSelectCircle = (circle: CareCircle) => {
    setActiveCircle(circle);
    setActiveTab('today');
  };

  const handleSignOut = async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    setCurrentUser(null);
    setActiveCircle(null);
  };

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
          <StatusBar style="dark" />

          {/* Top Airplane / Offline Mode Toolbar */}
          <View style={styles.networkToolbar}>
            <View style={styles.networkStatusLeft}>
              <View
                style={[
                  styles.networkStatusDot,
                  isOffline ? styles.dotOffline : styles.dotOnline,
                ]}
              />
              <Text style={styles.networkStatusText}>
                {isOffline ? '✈️ Airplane Mode (Offline)' : '🟢 Online'}
              </Text>
            </View>

            <View style={styles.networkToolbarRight}>
              <TouchableOpacity
                onPress={() => setShowOnboarding(true)}
                style={styles.tutorialButton}
                accessibilityRole="button"
                accessibilityLabel="Tutorial"
              >
                <Text style={styles.tutorialButtonText}>ℹ️ Tutorial</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleToggleAirplaneMode}
                style={[
                  styles.airplaneToggleButton,
                  isOffline ? styles.airplaneToggleActive : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Toggle Airplane Mode"
              >
                <Text
                  style={[
                    styles.airplaneToggleText,
                    isOffline ? styles.airplaneToggleTextActive : null,
                  ]}
                >
                  {isOffline ? 'Turn Off Airplane' : '✈️ Airplane Mode'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Offline Warning Banner */}
          {isOffline ? (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineBannerText}>
                ⚠️ Device is Offline. "I'm OK" check-ins will queue locally and sync automatically when reconnected.
              </Text>
            </View>
          ) : null}

          {/* Sync Success Notice */}
          {syncNotice ? (
            <View style={styles.syncBanner}>
              <Text style={styles.syncBannerText}>{syncNotice}</Text>
            </View>
          ) : null}

          <View style={styles.container}>
            {appMode === 'elder' ? (
              !elderSession ? (
                <ElderLoginScreen
                  onElderAuthenticated={(session) => setElderSession(session)}
                  onSwitchToCaregiverLogin={() => setAppMode('caregiver')}
                />
              ) : (
                <ElderHomeScreen
                  session={elderSession}
                  onExitElderMode={() => {
                    setElderSession(null);
                    setAppMode('caregiver');
                  }}
                />
              )
            ) : !currentUser ? (
              <AuthScreen
                onAuthenticated={handleAuthenticated}
                onSwitchToElderMode={() => setAppMode('elder')}
              />
            ) : !activeCircle ? (
              <CircleSelectScreen
                currentUser={currentUser}
                onSelectCircle={handleSelectCircle}
                onSignOut={handleSignOut}
              />
            ) : activeTab === 'today' ? (
              <TodayScreen
                circle={activeCircle}
                currentUser={currentUser}
                onNavigateToCoverage={() => setActiveTab('coverage')}
                onNavigateToTimeline={() => setActiveTab('timeline')}
                onBackToCircles={() => setActiveCircle(null)}
              />
            ) : activeTab === 'coverage' ? (
              <CoverageScreen
                circle={activeCircle}
                currentUser={currentUser}
                onNavigateToToday={() => setActiveTab('today')}
                onNavigateToTimeline={() => setActiveTab('timeline')}
                onBackToCircles={() => setActiveCircle(null)}
              />
            ) : (
              <TimelineScreen
                circle={activeCircle}
                currentUser={currentUser}
                onNavigateToToday={() => setActiveTab('today')}
                onNavigateToCoverage={() => setActiveTab('coverage')}
                onBackToCircles={() => setActiveCircle(null)}
              />
            )}
          </View>

          {/* Onboarding Modal Overlay */}
          <OnboardingModal
            visible={showOnboarding}
            onComplete={() => setShowOnboarding(false)}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  networkToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  networkStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  networkStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotOnline: {
    backgroundColor: '#10B981',
  },
  dotOffline: {
    backgroundColor: '#F59E0B',
  },
  networkStatusText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  networkToolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tutorialButton: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
  },
  tutorialButtonText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  airplaneToggleButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 6,
  },
  airplaneToggleActive: {
    backgroundColor: '#F59E0B',
  },
  airplaneToggleText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  airplaneToggleTextActive: {
    color: '#0F172A',
  },
  offlineBanner: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  offlineBannerText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  syncBanner: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  syncBannerText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
