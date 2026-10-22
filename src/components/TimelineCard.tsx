import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TimelineEvent, TimelineEventType } from '../types/database';

interface TimelineCardProps {
  event: TimelineEvent;
}

const getBadgeConfig = (type: TimelineEventType) => {
  switch (type) {
    case 'med':
      return {
        label: 'Medication',
        icon: '💊',
        bgColor: '#FEF3C7',
        textColor: '#B45309',
        borderColor: '#FDE68A',
      };
    case 'appointment':
      return {
        label: 'Appointment',
        icon: '🩺',
        bgColor: '#EEF2FF',
        textColor: '#4338CA',
        borderColor: '#C7D2FE',
      };
    case 'note':
    default:
      return {
        label: 'Care Note',
        icon: '📝',
        bgColor: '#ECFDF5',
        textColor: '#047857',
        borderColor: '#A7F3D0',
      };
  }
};

const formatRelativeTime = (isoString: string): string => {
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (isNaN(diffSec)) return 'Recently';
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const TimelineCard: React.FC<TimelineCardProps> = ({ event }) => {
  const badge = getBadgeConfig(event.type);
  const timeAgo = formatRelativeTime(event.occurred_at);
  const authorName = event.author?.full_name || 'Caregiver';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View
          style={[
            styles.badge,
            { backgroundColor: badge.bgColor, borderColor: badge.borderColor },
          ]}
        >
          <Text style={styles.badgeIcon}>{badge.icon}</Text>
          <Text style={[styles.badgeText, { color: badge.textColor }]}>
            {badge.label}
          </Text>
        </View>
        <Text style={styles.timeAgo}>{timeAgo}</Text>
      </View>

      <Text style={styles.title}>{event.title}</Text>

      {event.description ? (
        <Text style={styles.description}>{event.description}</Text>
      ) : null}

      <View style={styles.footerRow}>
        <View style={styles.authorContainer}>
          <View style={styles.authorDot} />
          <Text style={styles.authorText}>
            Logged by <Text style={styles.authorHighlight}>{authorName}</Text>
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeAgo: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 24,
    marginBottom: 6,
  },
  description: {
    fontSize: 16,
    color: '#334155',
    lineHeight: 22,
    marginBottom: 12,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0E7490',
    marginRight: 8,
  },
  authorText: {
    fontSize: 13,
    color: '#64748B',
  },
  authorHighlight: {
    color: '#0F172A',
    fontWeight: '600',
  },
});
