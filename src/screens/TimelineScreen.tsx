import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { FilterBar, FilterOption } from '../components/FilterBar';
import { TimelineCard } from '../components/TimelineCard';
import { isSupabaseConfigured } from '../lib/supabase';
import { careCircleService } from '../services/careCircleService';
import {
  CareCircle,
  CareCircleMember,
  TimelineEvent,
  UserProfile,
} from '../types/database';
import { AddNoteScreen } from './AddNoteScreen';

interface TimelineScreenProps {
  circle: CareCircle;
  currentUser: UserProfile;
  onBackToCircles: () => void;
}

export const TimelineScreen: React.FC<TimelineScreenProps> = ({
  circle,
  currentUser,
  onBackToCircles,
}) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [members, setMembers] = useState<CareCircleMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [copiedCodeBanner, setCopiedCodeBanner] = useState(false);

  // Load events & members
  const loadData = useCallback(async () => {
    try {
      const [eventsData, membersData] = await Promise.all([
        careCircleService.fetchTimelineEvents(circle.id),
        careCircleService.fetchCircleMembers(circle.id),
      ]);
      setEvents(eventsData);
      setMembers(membersData);
    } catch (err) {
      console.warn('Failed to fetch circle data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [circle.id]);

  useEffect(() => {
    loadData();

    // Subscribe to realtime updates
    const unsubscribe = careCircleService.subscribeToTimelineEvents(
      circle.id,
      (newEvent) => {
        setEvents((prev) => {
          // Avoid duplicate inserts
          if (prev.some((e) => e.id === newEvent.id)) {
            return prev;
          }
          return [newEvent, ...prev];
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [circle.id, loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCopyCode = () => {
    setCopiedCodeBanner(true);
    setTimeout(() => {
      setCopiedCodeBanner(false);
    }, 2500);
  };

  // Filter events
  const filteredEvents = events.filter((ev) => {
    if (selectedFilter === 'all') return true;
    return ev.type === selectedFilter;
  });

  const counts = {
    all: events.length,
    note: events.filter((e) => e.type === 'note').length,
    med: events.filter((e) => e.type === 'med').length,
    appointment: events.filter((e) => e.type === 'appointment').length,
  };

  const currentMember = members.find((m) => m.user_id === currentUser.id);
  const userRole = currentMember?.role || 'member';

  return (
    <View style={styles.container}>
      {/* Top Header Card */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={onBackToCircles}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Switch Circle"
          >
            <Text style={styles.backButtonText}>← Circles</Text>
          </TouchableOpacity>

          <View style={styles.realtimeIndicator}>
            <View style={styles.pulseDot} />
            <Text style={styles.realtimeText}>
              {isSupabaseConfigured() ? 'Supabase Live' : 'Demo Realtime'}
            </Text>
          </View>
        </View>

        <View style={styles.circleInfoRow}>
          <View style={styles.circleInfoTextCol}>
            <Text style={styles.circleTitle}>{circle.name}</Text>
            <Text style={styles.circleSub}>
              {members.length} {members.length === 1 ? 'Caregiver' : 'Caregivers'} • You ({userRole})
            </Text>
          </View>

          {/* Invite Code Badge with tap to copy */}
          <TouchableOpacity
            onPress={handleCopyCode}
            style={styles.codeBadge}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Invite Code ${circle.invite_code}. Tap to copy.`}
          >
            <Text style={styles.codeLabel}>INVITE CODE</Text>
            <Text style={styles.codeValue}>{circle.invite_code}</Text>
          </TouchableOpacity>
        </View>

        {copiedCodeBanner ? (
          <View style={styles.copiedBanner}>
            <Text style={styles.copiedBannerText}>
              ✓ Share code "{circle.invite_code}" with caregivers to join this circle!
            </Text>
          </View>
        ) : null}
      </View>

      {/* Filter Bar */}
      <FilterBar
        selectedFilter={selectedFilter}
        onSelectFilter={setSelectedFilter}
        counts={counts}
      />

      {/* Timeline List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0E7490" />
          <Text style={styles.loadingText}>Loading care timeline...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TimelineCard event={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#0E7490']}
              tintColor="#0E7490"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyTitle}>No updates found</Text>
              <Text style={styles.emptySub}>
                {selectedFilter === 'all'
                  ? 'Be the first to add a note or medication record to Eleanor’s timeline.'
                  : `No ${selectedFilter} items found in this circle yet.`}
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Add Note Action Button */}
      <View style={styles.floatingButtonContainer}>
        <Button
          title="✍️ + Add Care Update"
          variant="primary"
          size="large"
          onPress={() => setShowAddModal(true)}
          style={styles.fab}
        />
      </View>

      {/* Add Note Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <AddNoteScreen
          circle={circle}
          currentUser={currentUser}
          onClose={() => setShowAddModal(false)}
          onEventCreated={(newEvent) => {
            setEvents((prev) => [newEvent, ...prev]);
          }}
        />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0E7490',
  },
  realtimeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  realtimeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  circleInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  circleInfoTextCol: {
    flex: 1,
    paddingRight: 10,
  },
  circleTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  circleSub: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  codeBadge: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369A1',
    letterSpacing: 0.5,
  },
  codeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0C4A6E',
  },
  copiedBanner: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  copiedBannerText: {
    fontSize: 13,
    color: '#15803D',
    fontWeight: '600',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100, // Space for FAB
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  fab: {
    width: '100%',
    maxWidth: 420,
    shadowColor: '#0E7490',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
});
