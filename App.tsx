import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { isSupabaseConfigured, supabase } from './src/lib/supabase';
import { AuthScreen } from './src/screens/AuthScreen';
import { CircleSelectScreen } from './src/screens/CircleSelectScreen';
import { ElderHomeScreen } from './src/screens/ElderHomeScreen';
import { ElderLoginScreen } from './src/screens/ElderLoginScreen';
import { TimelineScreen } from './src/screens/TimelineScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { SEED_CARE_CIRCLE } from './src/services/mockData';
import { CareCircle, ElderSession, UserProfile } from './src/types/database';

export default function App() {
  const [appMode, setAppMode] = useState<'caregiver' | 'elder'>('caregiver');
  const [elderSession, setElderSession] = useState<ElderSession | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeCircle, setActiveCircle] = useState<CareCircle | null>(null);
  const [activeTab, setActiveTab] = useState<'today' | 'timeline'>('today');

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return;
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
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleAuthenticated = (user: UserProfile) => {
    setCurrentUser(user);
    // If logging in as one of the seed users, automatically connect to the seed circle
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
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar style="dark" />
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
              onNavigateToTimeline={() => setActiveTab('timeline')}
              onBackToCircles={() => setActiveCircle(null)}
            />
          ) : (
            <TimelineScreen
              circle={activeCircle}
              currentUser={currentUser}
              onNavigateToToday={() => setActiveTab('today')}
              onBackToCircles={() => setActiveCircle(null)}
            />
          )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
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
});
