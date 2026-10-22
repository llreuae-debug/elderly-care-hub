import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { isSupabaseConfigured } from '../lib/supabase';
import { careCircleService } from '../services/careCircleService';
import { SEED_PROFILES } from '../services/mockData';
import { UserProfile } from '../types/database';

interface AuthScreenProps {
  onAuthenticated: (user: UserProfile) => void;
  onSwitchToElderMode?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
  onSwitchToElderMode,
}) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  const handleSendMagicLink = async () => {
    if (!email.trim() || !email.includes('@')) {
      setFeedback({ message: 'Please enter a valid email address.', isError: true });
      return;
    }

    setLoading(true);
    setFeedback(null);

    const result = await careCircleService.sendMagicLink(email);
    setLoading(false);

    if (result.success) {
      setFeedback({ message: result.message, isError: false });
      // In demo mode or if Supabase is pending configuration, sign in directly with caregiver profile
      if (!isSupabaseConfigured()) {
        const dummyUser: UserProfile = {
          id: 'user-' + Date.now(),
          email: email.trim().toLowerCase(),
          full_name: email.split('@')[0],
          avatar_url: null,
          created_at: new Date().toISOString(),
        };
        setTimeout(() => {
          onAuthenticated(dummyUser);
        }, 800);
      }
    } else {
      setFeedback({ message: result.message, isError: true });
    }
  };

  const handleSelectSeedUser = (userId: string) => {
    const user = SEED_PROFILES[userId];
    if (user) {
      onAuthenticated(user);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={styles.badge}>Caregiver Coordination Hub</Text>
          <Text style={styles.title}>Elderly Care Hub</Text>
          <Text style={styles.subtitle}>
            A dignified, shared space for families and care teams to coordinate daily care.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Sign In with Magic Link</Text>
          <Text style={styles.bodyText}>
            No passwords needed. Enter your email and we'll send a secure sign-in link.
          </Text>

          <Input
            label="Email Address"
            placeholder="e.g. sarah@example.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (feedback) setFeedback(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {feedback ? (
            <View
              style={[
                styles.feedbackBox,
                feedback.isError ? styles.feedbackError : styles.feedbackSuccess,
              ]}
            >
              <Text
                style={[
                  styles.feedbackText,
                  feedback.isError ? styles.feedbackTextError : styles.feedbackTextSuccess,
                ]}
              >
                {feedback.message}
              </Text>
            </View>
          ) : null}

          <Button
            title="Send Magic Link"
            onPress={handleSendMagicLink}
            loading={loading}
            style={styles.submitButton}
          />
        </View>

        {/* Quick Testing Personas */}
        <View style={styles.demoSection}>
          <Text style={styles.demoHeader}>Quick Demo Logins (Seed Data)</Text>
          <Text style={styles.demoSub}>
            Tap to test instantly as one of the seed caregivers:
          </Text>

          <Button
            title="👤 Log in as Sarah (Daughter / Admin)"
            variant="secondary"
            onPress={() => handleSelectSeedUser('11111111-1111-1111-1111-111111111111')}
            style={styles.demoButton}
          />

          <Button
            title="🩺 Log in as Dr. Marcus (Home Nurse / Viewer)"
            variant="secondary"
            onPress={() => handleSelectSeedUser('22222222-2222-2222-2222-222222222222')}
            style={styles.demoButton}
          />

          {onSwitchToElderMode ? (
            <Button
              title="👵 Switch to Elder Mode (4-Digit PIN)"
              variant="outline"
              onPress={onSwitchToElderMode}
              style={styles.elderSwitchBtn}
            />
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 50,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    maxWidth: 360,
  },
  brandLogo: {
    width: 84,
    height: 84,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 14,
  },
  badge: {
    backgroundColor: '#E0F2FE',
    color: '#0369A1',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 10,
    overflow: 'hidden',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 440,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  bodyText: {
    fontSize: 15,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 16,
  },
  submitButton: {
    marginTop: 12,
  },
  feedbackBox: {
    padding: 12,
    borderRadius: 10,
    marginVertical: 10,
  },
  feedbackSuccess: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  feedbackError: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackTextSuccess: {
    color: '#047857',
  },
  feedbackTextError: {
    color: '#B91C1C',
  },
  demoSection: {
    marginTop: 32,
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  demoHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  demoSub: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 14,
  },
  demoButton: {
    marginBottom: 10,
  },
  elderSwitchBtn: {
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#0E7490',
  },
});
