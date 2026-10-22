import React, { useState } from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button } from '../components/Button';

export const ONBOARDING_KEY = '@elderlycare_has_onboarded_v1';

interface OnboardingModalProps {
  visible: boolean;
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  visible,
  onComplete,
}) => {
  const [step, setStep] = useState<number>(0);

  const steps = [
    {
      title: 'Welcome to Elderly Care Hub',
      subtitle: 'Dignity-First Family Coordination',
      description:
        'A shared, respectful space designed to keep families, nurses, and elders perfectly coordinated without surveillance-style tracking.',
      icon: '🏡',
      showLogo: true,
      badge: 'PRODUCT PRINCIPLE',
      highlight: 'Elder dignity first. Check-ins are opt-in and coordination is effortless.',
    },
    {
      title: 'Caregiver Coordination',
      subtitle: 'Timelines, Meds & Shift Handoffs',
      description:
        'Keep everyone in the loop with realtime wellness notes, automated medication reminders, and shift coverage tracking with task checklists.',
      icon: '👥',
      showLogo: false,
      badge: 'FOR CAREGIVERS & NURSES',
      highlight: 'End-of-shift handoff notes immediately alert incoming caregivers.',
    },
    {
      title: 'Simplified Elder Mode',
      subtitle: '3 Large Buttons, 4-Digit PIN',
      description:
        'Elders log in with a simple 4-digit PIN (no email or password). A clean screen features ONLY three large buttons: "I\'m OK", "Call for help", and "My meds today".',
      icon: '👵',
      showLogo: false,
      badge: 'FOR AGING LOVED ONES',
      highlight: '24pt minimum high-contrast text and oversized touch targets.',
    },
  ];

  const handleFinish = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {
      // ignore
    }
    onComplete();
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const currentStepData = steps[step];

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Top Skip Button */}
          <View style={styles.topRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{currentStepData.badge}</Text>
            </View>
            <TouchableOpacity
              onPress={handleFinish}
              style={styles.skipButton}
              accessibilityRole="button"
              accessibilityLabel="Skip Tutorial"
            >
              <Text style={styles.skipButtonText}>Skip Tutorial</Text>
            </TouchableOpacity>
          </View>

          {/* Icon or Brand Logo */}
          <View style={styles.mediaContainer}>
            {currentStepData.showLogo ? (
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.iconCircle}>
                <Text style={styles.stepIcon}>{currentStepData.icon}</Text>
              </View>
            )}
          </View>

          {/* Texts */}
          <Text style={styles.title}>{currentStepData.title}</Text>
          <Text style={styles.subtitle}>{currentStepData.subtitle}</Text>
          <Text style={styles.description}>{currentStepData.description}</Text>

          <View style={styles.highlightBox}>
            <Text style={styles.highlightText}>💡 {currentStepData.highlight}</Text>
          </View>

          {/* Dots Indicator */}
          <View style={styles.dotsRow}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === step ? styles.dotActive : null]}
              />
            ))}
          </View>

          {/* Next / Finish Button */}
          <Button
            title={step === steps.length - 1 ? "Get Started →" : "Next →"}
            variant="primary"
            size="large"
            onPress={handleNext}
            style={styles.actionButton}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 440,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  badge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: 0.5,
  },
  skipButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  skipButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  mediaContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  logoImage: {
    width: 90,
    height: 90,
    borderRadius: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0FDFA',
    borderWidth: 2,
    borderColor: '#99F6E4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepIcon: {
    fontSize: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 6,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0E7490',
    textAlign: 'center',
    marginTop: 4,
  },
  description: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 10,
  },
  highlightBox: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  highlightText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    fontWeight: '500',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginVertical: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#0E7490',
  },
  actionButton: {
    width: '100%',
  },
});
