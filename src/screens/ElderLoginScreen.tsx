import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { careCircleService } from '../services/careCircleService';
import { ElderSession } from '../types/database';

interface ElderLoginScreenProps {
  onElderAuthenticated: (session: ElderSession) => void;
  onSwitchToCaregiverLogin: () => void;
}

export const ElderLoginScreen: React.FC<ElderLoginScreenProps> = ({
  onElderAuthenticated,
  onSwitchToCaregiverLogin,
}) => {
  const [inviteCode, setInviteCode] = useState('CARE01');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleKeyPress = (digit: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
      if (errorMsg) setErrorMsg(null);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    if (errorMsg) setErrorMsg(null);
  };

  const handleElderLogin = async () => {
    if (!inviteCode.trim()) {
      setErrorMsg('Please enter your Care Circle code (e.g. CARE01).');
      return;
    }

    if (pin.length !== 4) {
      setErrorMsg('Please enter all 4 digits of your PIN.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const session = await careCircleService.loginElderWithPin(inviteCode, pin);
      onElderAuthenticated(session);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid 4-digit PIN');
    } finally {
      setLoading(false);
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
          <Text style={styles.badge}>DIGNIFIED ELDER MODE</Text>
          <Text style={styles.title}>Elder Sign In</Text>
          <Text style={styles.subtitle}>
            Enter your 4-digit PIN to access your simplified daily buttons. No password needed.
          </Text>
        </View>

        <View style={styles.card}>
          <Input
            label="Circle Code"
            placeholder="CARE01"
            value={inviteCode}
            onChangeText={(t) => setInviteCode(t.toUpperCase())}
            autoCapitalize="characters"
          />

          <Text style={styles.pinLabel}>4-Digit PIN</Text>
          <View style={styles.pinDisplayRow}>
            {[0, 1, 2, 3].map((index) => {
              const hasDigit = index < pin.length;
              return (
                <View
                  key={index}
                  style={[
                    styles.pinSlot,
                    hasDigit ? styles.pinSlotFilled : styles.pinSlotEmpty,
                  ]}
                >
                  <Text style={styles.pinSlotText}>{hasDigit ? '●' : ''}</Text>
                </View>
              );
            })}
          </View>

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          {/* Large Accessible Number Keypad */}
          <View style={styles.keypad}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['C', '0', '⌫'],
            ].map((row, rIdx) => (
              <View key={rIdx} style={styles.keypadRow}>
                {row.map((k) => (
                  <TouchableOpacity
                    key={k}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (k === 'C') setPin('');
                      else if (k === '⌫') handleBackspace();
                      else handleKeyPress(k);
                    }}
                    style={[
                      styles.keypadButton,
                      k === 'C' || k === '⌫' ? styles.keypadUtilityButton : null,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={k === 'C' ? 'Clear PIN' : k === '⌫' ? 'Backspace' : `Digit ${k}`}
                  >
                    <Text
                      style={[
                        styles.keypadButtonText,
                        k === 'C' || k === '⌫' ? styles.keypadUtilityText : null,
                      ]}
                    >
                      {k}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          <Button
            title="Enter Elder Mode"
            variant="primary"
            size="large"
            onPress={handleElderLogin}
            loading={loading}
            style={styles.loginButton}
          />

          <View style={styles.hintBox}>
            <Text style={styles.hintText}>💡 Default Seed PIN is 1234 (Circle: CARE01)</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onSwitchToCaregiverLogin}
          style={styles.switchButton}
          accessibilityRole="button"
          accessibilityLabel="Switch to Caregiver Magic Link Sign In"
        >
          <Text style={styles.switchButtonText}>← Caregiver Sign In (Email Magic Link)</Text>
        </TouchableOpacity>
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
    padding: 20,
    paddingTop: 40,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    maxWidth: 400,
  },
  brandLogo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#DCFCE7',
    color: '#15803D',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.8,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 10,
    overflow: 'hidden',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
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
    maxWidth: 420,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  pinLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 10,
    marginBottom: 8,
  },
  pinDisplayRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 18,
  },
  pinSlot: {
    width: 58,
    height: 58,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinSlotEmpty: {
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  pinSlotFilled: {
    borderColor: '#0E7490',
    backgroundColor: '#E0F2FE',
  },
  pinSlotText: {
    fontSize: 28,
    color: '#0E7490',
  },
  keypad: {
    marginTop: 8,
    marginBottom: 14,
    gap: 10,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  keypadButton: {
    flex: 1,
    minHeight: 60,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  keypadUtilityButton: {
    backgroundColor: '#E2E8F0',
  },
  keypadButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  keypadUtilityText: {
    fontSize: 20,
    color: '#475569',
  },
  loginButton: {
    marginTop: 8,
    minHeight: 58,
  },
  hintBox: {
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  switchButton: {
    marginTop: 24,
    padding: 12,
  },
  switchButtonText: {
    color: '#0E7490',
    fontSize: 15,
    fontWeight: '700',
  },
});
