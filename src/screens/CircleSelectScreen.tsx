import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { CareCircle, UserProfile } from '../types/database';

interface CircleSelectScreenProps {
  currentUser: UserProfile;
  onSelectCircle: (circle: CareCircle) => void;
  onSignOut: () => void;
}

export const CircleSelectScreen: React.FC<CircleSelectScreenProps> = ({
  currentUser,
  onSelectCircle,
  onSignOut,
}) => {
  const [circles, setCircles] = useState<CareCircle[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list' | 'create' | 'join'>('list');

  // Form states
  const [circleName, setCircleName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadCircles = async () => {
    try {
      setLoading(true);
      const data = await careCircleService.fetchUserCircles(currentUser.id);
      setCircles(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load care circles';
      Alert.alert('Notice', msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCircles();
  }, [currentUser.id]);

  const handleCreateCircle = async () => {
    if (!circleName.trim()) {
      setErrorMsg('Please enter a name for the Care Circle (e.g. Grandma Eleanor).');
      return;
    }

    try {
      setActionLoading(true);
      setErrorMsg(null);
      const newCircle = await careCircleService.createCareCircle(
        circleName,
        currentUser.id,
        currentUser
      );
      setCircleName('');
      setMode('list');
      await loadCircles();
      onSelectCircle(newCircle);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create care circle');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinCircle = async () => {
    if (!inviteCode.trim()) {
      setErrorMsg('Please enter a valid 6-character invite code.');
      return;
    }

    try {
      setActionLoading(true);
      setErrorMsg(null);
      const circle = await careCircleService.joinCareCircleByCode(
        inviteCode,
        currentUser.id,
        currentUser
      );
      setInviteCode('');
      setMode('list');
      await loadCircles();
      onSelectCircle(circle);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to join care circle');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User bar */}
        <View style={styles.userBar}>
          <View>
            <Text style={styles.welcomeText}>Logged in as</Text>
            <Text style={styles.userName}>{currentUser.full_name || currentUser.email}</Text>
          </View>
          <Button
            title="Sign Out"
            variant="ghost"
            size="normal"
            onPress={onSignOut}
            style={styles.signOutBtn}
          />
        </View>

        {mode === 'list' && (
          <View style={styles.card}>
            <Text style={styles.heading}>Your Care Circles</Text>
            <Text style={styles.subheading}>
              Select a circle to view updates or coordinate with family and nurses.
            </Text>

            {loading ? (
              <ActivityIndicator size="large" color="#0E7490" style={styles.loader} />
            ) : circles.length > 0 ? (
              <View style={styles.circleList}>
                {circles.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.circleCard}
                    activeOpacity={0.7}
                    onPress={() => onSelectCircle(c)}
                    accessibilityRole="button"
                    accessibilityLabel={`Enter ${c.name}`}
                  >
                    <View style={styles.circleCardContent}>
                      <View style={styles.circleAvatar}>
                        <Text style={styles.circleAvatarText}>
                          {c.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.circleTextCol}>
                        <Text style={styles.circleTitle}>{c.name}</Text>
                        <Text style={styles.circleCode}>
                          Invite Code: <Text style={styles.codeHighlight}>{c.invite_code}</Text>
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.chevron}>→</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>You are not in any Care Circle yet.</Text>
              </View>
            )}

            <View style={styles.actionsDivider} />

            <Button
              title="+ Create a Care Circle"
              variant="primary"
              onPress={() => {
                setErrorMsg(null);
                setMode('create');
              }}
              style={styles.actionBtn}
            />

            <Button
              title="🔑 Join with Invite Code"
              variant="secondary"
              onPress={() => {
                setErrorMsg(null);
                setMode('join');
              }}
              style={styles.actionBtn}
            />
          </View>
        )}

        {mode === 'create' && (
          <View style={styles.card}>
            <Text style={styles.heading}>Create Care Circle</Text>
            <Text style={styles.subheading}>
              Set up a shared circle for your elder loved one. You can invite family and care staff right after.
            </Text>

            <Input
              label="Care Circle Name"
              placeholder="e.g. Eleanor Vance Care Circle"
              value={circleName}
              onChangeText={(text) => {
                setCircleName(text);
                if (errorMsg) setErrorMsg(null);
              }}
              autoFocus
            />

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <Button
              title="Create Circle"
              variant="primary"
              onPress={handleCreateCircle}
              loading={actionLoading}
              style={styles.actionBtn}
            />

            <Button
              title="Cancel"
              variant="outline"
              onPress={() => {
                setErrorMsg(null);
                setMode('list');
              }}
              style={styles.actionBtn}
            />
          </View>
        )}

        {mode === 'join' && (
          <View style={styles.card}>
            <Text style={styles.heading}>Join a Care Circle</Text>
            <Text style={styles.subheading}>
              Enter the 6-character code shared with you by the circle admin. (Try: CARE01)
            </Text>

            <Input
              label="Invite Code"
              placeholder="e.g. CARE01"
              value={inviteCode}
              onChangeText={(text) => {
                setInviteCode(text.toUpperCase());
                if (errorMsg) setErrorMsg(null);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={10}
              autoFocus
            />

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <Button
              title="Join Circle"
              variant="primary"
              onPress={handleJoinCircle}
              loading={actionLoading}
              style={styles.actionBtn}
            />

            <Button
              title="Cancel"
              variant="outline"
              onPress={() => {
                setErrorMsg(null);
                setMode('list');
              }}
              style={styles.actionBtn}
            />
          </View>
        )}
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
  userBar: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  signOutBtn: {
    paddingHorizontal: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 480,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  subheading: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 20,
  },
  loader: {
    marginVertical: 30,
  },
  circleList: {
    marginBottom: 16,
  },
  circleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    minHeight: 64, // Big touch target
  },
  circleCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  circleAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0E7490',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  circleAvatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  circleTextCol: {
    flex: 1,
  },
  circleTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 3,
  },
  circleCode: {
    fontSize: 13,
    color: '#64748B',
  },
  codeHighlight: {
    fontWeight: '700',
    color: '#0E7490',
  },
  chevron: {
    fontSize: 22,
    color: '#0E7490',
    fontWeight: '700',
    marginLeft: 10,
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748B',
  },
  actionsDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 14,
  },
  actionBtn: {
    marginVertical: 6,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
    marginVertical: 8,
  },
});
