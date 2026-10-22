import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { TimelineEventType } from '../types/database';

export type FilterOption = 'all' | TimelineEventType;

interface FilterBarProps {
  selectedFilter: FilterOption;
  onSelectFilter: (filter: FilterOption) => void;
  counts: {
    all: number;
    note: number;
    med: number;
    appointment: number;
  };
}

export const FilterBar: React.FC<FilterBarProps> = ({
  selectedFilter,
  onSelectFilter,
  counts,
}) => {
  const options: Array<{ id: FilterOption; label: string; icon: string; count: number }> = [
    { id: 'all', label: 'All Updates', icon: '📋', count: counts.all },
    { id: 'note', label: 'Care Notes', icon: '📝', count: counts.note },
    { id: 'med', label: 'Medications', icon: '💊', count: counts.med },
    { id: 'appointment', label: 'Appointments', icon: '🩺', count: counts.appointment },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {options.map((opt) => {
          const isSelected = selectedFilter === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              activeOpacity={0.7}
              onPress={() => onSelectFilter(opt.id)}
              style={[
                styles.chip,
                isSelected ? styles.chipSelected : styles.chipUnselected,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${opt.label}, ${opt.count} items`}
            >
              <Text style={styles.chipIcon}>{opt.icon}</Text>
              <Text
                style={[
                  styles.chipLabel,
                  isSelected ? styles.chipLabelSelected : styles.chipLabelUnselected,
                ]}
              >
                {opt.label}
              </Text>
              <View
                style={[
                  styles.countBadge,
                  isSelected ? styles.countBadgeSelected : styles.countBadgeUnselected,
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    isSelected ? styles.countTextSelected : styles.countTextUnselected,
                  ]}
                >
                  {opt.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  scrollContent: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    minHeight: 48, // 48px touch target
    borderWidth: 1.5,
  },
  chipSelected: {
    backgroundColor: '#0E7490',
    borderColor: '#0E7490',
  },
  chipUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  chipIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  chipLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginRight: 6,
  },
  chipLabelSelected: {
    color: '#FFFFFF',
  },
  chipLabelUnselected: {
    color: '#334155',
  },
  countBadge: {
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  countBadgeUnselected: {
    backgroundColor: '#F1F5F9',
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
  },
  countTextSelected: {
    color: '#FFFFFF',
  },
  countTextUnselected: {
    color: '#64748B',
  },
});
