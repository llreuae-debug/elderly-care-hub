import React, { useState } from 'react';
import {
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
import {
  CareCircle,
  TimelineEvent,
  TimelineEventType,
  UserProfile,
} from '../types/database';

interface AddNoteScreenProps {
  circle: CareCircle;
  currentUser: UserProfile;
  onClose: () => void;
  onEventCreated: (event: TimelineEvent) => void;
}

export const AddNoteScreen: React.FC<AddNoteScreenProps> = ({
  circle,
  currentUser,
  onClose,
  onEventCreated,
}) => {
  const [type, setType] = useState<TimelineEventType>('note');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const typeOptions: Array<{
    id: TimelineEventType;
    label: string;
    icon: string;
    desc: string;
  }> = [
    { id: 'note', label: 'Care Note', icon: '📝', desc: 'Meals, mood, walk, rest' },
    { id: 'med', label: 'Medication', icon: '💊', desc: 'Dose given, vitals, reactions' },
    { id: 'appointment', label: 'Appointment', icon: '🩺', desc: 'Clinic visit, doctor check' },
  ];

  const handleSubmit = async () => {
    if (!title.trim()) {
      setErrorMsg('Please enter an update title.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const newEvent = await careCircleService.createTimelineEvent(
        {
          care_circle_id: circle.id,
          type,
          title: title.trim(),
          description: description.trim() || undefined,
          occurred_at: new Date().toISOString(),
        },
        currentUser.id,
        currentUser
      );

      onEventCreated(newEvent);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to post update');
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
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.circleName}>{circle.name}</Text>
            <Text style={styles.heading}>Add Care Update</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close add note form"
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Select Update Type</Text>
        <View style={styles.typeSelectorRow}>
          {typeOptions.map((opt) => {
            const isSelected = type === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.typeCard,
                  isSelected ? styles.typeCardSelected : styles.typeCardUnselected,
                ]}
                onPress={() => setType(opt.id)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={styles.typeIcon}>{opt.icon}</Text>
                <Text
                  style={[
                    styles.typeLabel,
                    isSelected ? styles.typeLabelSelected : styles.typeLabelUnselected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Input
          label="Title"
          placeholder={
            type === 'med'
              ? 'e.g. Afternoon Blood Pressure Meds taken'
              : type === 'appointment'
              ? 'e.g. Dental Checkup Scheduled'
              : 'e.g. Had lunch and enjoyed afternoon sun'
          }
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            if (errorMsg) setErrorMsg(null);
          }}
          autoFocus
        />

        <Input
          label="Details / Notes (Optional)"
          placeholder="Add any helpful observations, readings, or notes for the family..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={styles.multilineInput}
        />

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        <View style={styles.buttonRow}>
          <Button
            title="Post to Care Circle"
            variant="primary"
            onPress={handleSubmit}
            loading={loading}
            style={styles.submitBtn}
          />

          <Button
            title="Cancel"
            variant="outline"
            onPress={onClose}
            style={styles.cancelBtn}
          />
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
    padding: 20,
    paddingTop: 40,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  circleName: {
    fontSize: 14,
    color: '#0E7490',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    color: '#475569',
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 10,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  typeCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    minHeight: 80,
  },
  typeCardSelected: {
    backgroundColor: '#0E7490',
    borderColor: '#0E7490',
  },
  typeCardUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  typeIcon: {
    fontSize: 26,
    marginBottom: 6,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  typeLabelSelected: {
    color: '#FFFFFF',
  },
  typeLabelUnselected: {
    color: '#334155',
  },
  multilineInput: {
    minHeight: 100,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  buttonRow: {
    marginTop: 20,
    gap: 10,
  },
  submitBtn: {},
  cancelBtn: {},
  errorText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '600',
    marginVertical: 8,
  },
});
