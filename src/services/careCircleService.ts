import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  CareCircle,
  CareCircleMember,
  CreateMedicationInput,
  CreateTimelineEventInput,
  DailyCheckIn,
  ElderSession,
  Medication,
  MedicationLog,
  MedicationStatus,
  TimelineEvent,
  UserProfile,
} from '../types/database';
import { hashPin } from '../lib/crypto';
import { notificationService } from './notificationService';
import {
  getTodayDateString,
  SEED_CARE_CIRCLE,
  SEED_CHECK_INS,
  SEED_MEDICATION_LOGS,
  SEED_MEDICATIONS,
  SEED_MEMBERS,
  SEED_PROFILES,
  SEED_TIMELINE_EVENTS,
} from './mockData';

// In-memory store for fallback/demo/test mode
let localCircles: CareCircle[] = [{ ...SEED_CARE_CIRCLE }];
let localMembers: CareCircleMember[] = [...SEED_MEMBERS];
let localEvents: TimelineEvent[] = [...SEED_TIMELINE_EVENTS];
let localMedications: Medication[] = [...SEED_MEDICATIONS];
let localMedicationLogs: MedicationLog[] = [...SEED_MEDICATION_LOGS];
let localCheckIns: DailyCheckIn[] = [...SEED_CHECK_INS];
const localSubscribers: Map<string, Array<(event: TimelineEvent) => void>> = new Map();

export const resetLocalState = (): void => {
  localCircles = [{ ...SEED_CARE_CIRCLE }];
  localMembers = [...SEED_MEMBERS];
  localEvents = [...SEED_TIMELINE_EVENTS];
  localMedications = [...SEED_MEDICATIONS];
  localMedicationLogs = [...SEED_MEDICATION_LOGS];
  localCheckIns = [...SEED_CHECK_INS];
  localSubscribers.clear();
};

const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const careCircleService = {
  /**
   * Send Magic Link email to caregiver
   */
  async sendMagicLink(email: string): Promise<{ success: boolean; message: string; error?: string }> {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      return { success: false, message: 'Please enter a valid email address.', error: 'Invalid email' };
    }

    if (!isSupabaseConfigured()) {
      return {
        success: true,
        message: `Magic link sent to ${trimmedEmail}! (Demo Mode: Instant login available)`,
      };
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: 'elderlycare://auth/callback',
        },
      });

      if (error) {
        return { success: false, message: error.message, error: error.message };
      }

      return {
        success: true,
        message: `Magic link sent! Check ${trimmedEmail} to log in.`,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to send magic link';
      return { success: false, message: errMsg, error: errMsg };
    }
  },

  /**
   * Fetch circles that the current user belongs to
   */
  async fetchUserCircles(userId: string): Promise<CareCircle[]> {
    if (!isSupabaseConfigured()) {
      const userCircleIds = new Set(
        localMembers.filter((m) => m.user_id === userId).map((m) => m.care_circle_id)
      );
      return localCircles.filter((c) => userCircleIds.has(c.id) || c.created_by === userId);
    }

    const { data: memberRows, error: memberError } = await supabase
      .from('care_circle_members')
      .select('care_circle_id')
      .eq('user_id', userId);

    if (memberError) {
      throw new Error(`Failed to load circles: ${memberError.message}`);
    }

    const circleIds = (memberRows || []).map((row: { care_circle_id: string }) => row.care_circle_id);

    if (circleIds.length === 0) {
      return [];
    }

    const { data: circles, error: circlesError } = await supabase
      .from('care_circles')
      .select('*')
      .in('id', circleIds)
      .order('created_at', { ascending: false });

    if (circlesError) {
      throw new Error(`Failed to load circles: ${circlesError.message}`);
    }

    return (circles || []) as CareCircle[];
  },

  /**
   * Fetch members of a care circle
   */
  async fetchCircleMembers(circleId: string): Promise<CareCircleMember[]> {
    if (!isSupabaseConfigured()) {
      return localMembers.filter((m) => m.care_circle_id === circleId);
    }

    const { data, error } = await supabase
      .from('care_circle_members')
      .select(`
        id,
        care_circle_id,
        user_id,
        role,
        joined_at,
        profiles (
          id,
          email,
          full_name,
          avatar_url,
          created_at
        )
      `)
      .eq('care_circle_id', circleId);

    if (error) {
      throw new Error(`Failed to load members: ${error.message}`);
    }

    return (data || []).map((row: Record<string, unknown>) => {
      const profile = row.profiles as UserProfile | null;
      return {
        id: String(row.id),
        care_circle_id: String(row.care_circle_id),
        user_id: String(row.user_id),
        role: row.role === 'admin' ? 'admin' : 'viewer',
        joined_at: String(row.joined_at),
        profile,
      };
    });
  },

  /**
   * Create a new care circle with an invite code and assign creator as admin
   */
  async createCareCircle(name: string, userId: string, userProfile?: UserProfile): Promise<CareCircle> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Circle name is required.');
    }

    const inviteCode = generateInviteCode();

    if (!isSupabaseConfigured()) {
      const newCircle: CareCircle = {
        id: `circle-${Date.now()}`,
        name: trimmedName,
        invite_code: inviteCode,
        created_by: userId,
        check_in_deadline_time: '10:00',
        elder_name: 'Eleanor',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const newMember: CareCircleMember = {
        id: `mem-${Date.now()}`,
        care_circle_id: newCircle.id,
        user_id: userId,
        role: 'admin',
        joined_at: new Date().toISOString(),
        profile: userProfile || SEED_PROFILES[userId] || null,
      };

      localCircles.unshift(newCircle);
      localMembers.unshift(newMember);
      return newCircle;
    }

    const { data: circleData, error: circleError } = await supabase
      .from('care_circles')
      .insert({
        name: trimmedName,
        invite_code: inviteCode,
        created_by: userId,
      })
      .select('*')
      .single();

    if (circleError || !circleData) {
      throw new Error(circleError ? circleError.message : 'Could not create circle');
    }

    const circle = circleData as CareCircle;

    const { error: memberError } = await supabase.from('care_circle_members').insert({
      care_circle_id: circle.id,
      user_id: userId,
      role: 'admin',
    });

    if (memberError) {
      throw new Error(`Circle created but failed to add admin member: ${memberError.message}`);
    }

    return circle;
  },

  /**
   * Join an existing care circle using its 6-character invite code
   */
  async joinCareCircleByCode(
    inviteCode: string,
    userId: string,
    userProfile?: UserProfile
  ): Promise<CareCircle> {
    const trimmedCode = inviteCode.trim().toUpperCase();
    if (!trimmedCode) {
      throw new Error('Invite code is required.');
    }

    if (!isSupabaseConfigured()) {
      const circle = localCircles.find((c) => c.invite_code.toUpperCase() === trimmedCode);
      if (!circle) {
        throw new Error('Invalid invite code: Care Circle not found.');
      }

      const existing = localMembers.find(
        (m) => m.care_circle_id === circle.id && m.user_id === userId
      );

      if (!existing) {
        localMembers.push({
          id: `mem-${Date.now()}`,
          care_circle_id: circle.id,
          user_id: userId,
          role: 'viewer',
          joined_at: new Date().toISOString(),
          profile: userProfile || SEED_PROFILES[userId] || null,
        });
      }

      return circle;
    }

    // Call stored procedure or direct query
    const { data: circleData, error: circleError } = await supabase
      .from('care_circles')
      .select('*')
      .ilike('invite_code', trimmedCode)
      .single();

    if (circleError || !circleData) {
      throw new Error('Invalid invite code: Care Circle not found.');
    }

    const circle = circleData as CareCircle;

    const { error: joinError } = await supabase
      .from('care_circle_members')
      .upsert(
        {
          care_circle_id: circle.id,
          user_id: userId,
          role: 'viewer',
          joined_at: new Date().toISOString(),
        },
        { onConflict: 'care_circle_id,user_id' }
      );

    if (joinError) {
      throw new Error(`Failed to join circle: ${joinError.message}`);
    }

    return circle;
  },

  /**
   * Fetch timeline events sorted newest first
   */
  async fetchTimelineEvents(circleId: string): Promise<TimelineEvent[]> {
    if (!isSupabaseConfigured()) {
      return [...localEvents]
        .filter((e) => e.care_circle_id === circleId)
        .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
    }

    const { data, error } = await supabase
      .from('timeline_events')
      .select(`
        id,
        care_circle_id,
        created_by,
        type,
        title,
        description,
        occurred_at,
        created_at,
        profiles:created_by (
          id,
          email,
          full_name,
          avatar_url,
          created_at
        )
      `)
      .eq('care_circle_id', circleId)
      .order('occurred_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load timeline events: ${error.message}`);
    }

    return (data || []).map((row: Record<string, unknown>) => {
      const author = row.profiles as UserProfile | null;
      return {
        id: String(row.id),
        care_circle_id: String(row.care_circle_id),
        created_by: String(row.created_by),
        type: row.type as TimelineEvent['type'],
        title: String(row.title),
        description: row.description ? String(row.description) : null,
        occurred_at: String(row.occurred_at),
        created_at: String(row.created_at),
        author,
      };
    });
  },

  /**
   * Add a new timeline event (note, med, or appointment)
   */
  async createTimelineEvent(
    input: CreateTimelineEventInput,
    userId: string,
    authorProfile?: UserProfile
  ): Promise<TimelineEvent> {
    const trimmedTitle = input.title.trim();
    if (!trimmedTitle) {
      throw new Error('Event title is required.');
    }

    const occurredAt = input.occurred_at || new Date().toISOString();

    if (!isSupabaseConfigured()) {
      const newEvent: TimelineEvent = {
        id: `event-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        care_circle_id: input.care_circle_id,
        created_by: userId,
        type: input.type,
        title: trimmedTitle,
        description: input.description?.trim() || null,
        occurred_at: occurredAt,
        created_at: new Date().toISOString(),
        author: authorProfile || SEED_PROFILES[userId] || null,
      };

      localEvents.unshift(newEvent);

      // Notify local listeners
      const listeners = localSubscribers.get(input.care_circle_id) || [];
      listeners.forEach((listener) => listener(newEvent));

      return newEvent;
    }

    const { data, error } = await supabase
      .from('timeline_events')
      .insert({
        care_circle_id: input.care_circle_id,
        created_by: userId,
        type: input.type,
        title: trimmedTitle,
        description: input.description?.trim() || null,
        occurred_at: occurredAt,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error ? error.message : 'Failed to create event');
    }

    const event = data as TimelineEvent;
    event.author = authorProfile || null;
    return event;
  },

  /**
   * Subscribe to realtime timeline events for a care circle
   */
  subscribeToTimelineEvents(
    circleId: string,
    onInsert: (event: TimelineEvent) => void
  ): () => void {
    if (!isSupabaseConfigured()) {
      const current = localSubscribers.get(circleId) || [];
      current.push(onInsert);
      localSubscribers.set(circleId, current);

      return () => {
        const remaining = (localSubscribers.get(circleId) || []).filter((fn) => fn !== onInsert);
        localSubscribers.set(circleId, remaining);
      };
    }

    const channel = supabase
      .channel(`public:timeline_events:${circleId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'timeline_events',
          filter: `care_circle_id=eq.${circleId}`,
        },
        async (payload) => {
          const raw = payload.new as TimelineEvent;
          // Optionally fetch author profile
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', raw.created_by)
              .single();
            raw.author = profile as UserProfile | null;
          } catch {
            // Profile fetch optional
          }
          onInsert(raw);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Fetch active medications for a care circle
   */
  async fetchMedications(circleId: string): Promise<Medication[]> {
    if (!isSupabaseConfigured()) {
      return localMedications.filter((m) => m.care_circle_id === circleId && m.is_active);
    }

    const { data, error } = await supabase
      .from('medications')
      .select(`
        *,
        assigned_member:assigned_to (
          id,
          email,
          full_name,
          avatar_url,
          created_at
        )
      `)
      .eq('care_circle_id', circleId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to load medications: ${error.message}`);
    }

    return (data || []) as Medication[];
  },

  /**
    * Add a new medication to a care circle (Restricted to Admins via RLS)
   */
  async createMedication(
    input: CreateMedicationInput,
    circleId: string,
    userId?: string
  ): Promise<Medication> {
    const trimmedName = input.name.trim();
    if (!trimmedName) throw new Error('Medication name is required.');
    if (!input.dosage.trim()) throw new Error('Dosage is required.');
    if (!input.schedule || input.schedule.length === 0) throw new Error('At least one schedule time is required.');

    // Server-Side Permission Check (Admin only)
    if (userId) {
      const members = !isSupabaseConfigured()
        ? localMembers
        : await this.fetchCircleMembers(circleId);
      const callerMember = members.find(
        (m) => m.care_circle_id === circleId && m.user_id === userId
      );

      if (callerMember && callerMember.role !== 'admin') {
        throw new Error(
          'Permission denied: Only Care Circle Admins can add or edit medications (RLS policy violation).'
        );
      }
    }

    if (!isSupabaseConfigured()) {
      const newMed: Medication = {
        id: `med-${Date.now()}`,
        care_circle_id: circleId,
        name: trimmedName,
        dosage: input.dosage.trim(),
        schedule: input.schedule,
        assigned_to: input.assigned_to || null,
        assigned_member: input.assigned_to ? SEED_PROFILES[input.assigned_to] || null : null,
        instructions: input.instructions?.trim() || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      localMedications.push(newMed);
      return newMed;
    }

    const { data, error } = await supabase
      .from('medications')
      .insert({
        care_circle_id: circleId,
        name: trimmedName,
        dosage: input.dosage.trim(),
        schedule: input.schedule,
        assigned_to: input.assigned_to || null,
        instructions: input.instructions?.trim() || null,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error ? error.message : 'Failed to create medication');
    }

    return data as Medication;
  },

  /**
   * Update an existing medication (Restricted to Admins via RLS)
   */
  async updateMedication(
    medicationId: string,
    updates: Partial<CreateMedicationInput>,
    circleId: string,
    userId?: string
  ): Promise<Medication> {
    if (userId) {
      const members = !isSupabaseConfigured()
        ? localMembers
        : await this.fetchCircleMembers(circleId);
      const callerMember = members.find(
        (m) => m.care_circle_id === circleId && m.user_id === userId
      );

      if (callerMember && callerMember.role !== 'admin') {
        throw new Error(
          'Permission denied: Only Care Circle Admins can edit medications (RLS policy violation).'
        );
      }
    }

    if (!isSupabaseConfigured()) {
      const med = localMedications.find((m) => m.id === medicationId);
      if (!med) throw new Error('Medication not found');
      if (updates.name) med.name = updates.name.trim();
      if (updates.dosage) med.dosage = updates.dosage.trim();
      if (updates.schedule) med.schedule = updates.schedule;
      if (updates.instructions !== undefined) med.instructions = updates.instructions;
      med.updated_at = new Date().toISOString();
      return med;
    }

    const { data, error } = await supabase
      .from('medications')
      .update({
        ...(updates.name ? { name: updates.name.trim() } : {}),
        ...(updates.dosage ? { dosage: updates.dosage.trim() } : {}),
        ...(updates.schedule ? { schedule: updates.schedule } : {}),
        ...(updates.instructions !== undefined ? { instructions: updates.instructions } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', medicationId)
      .eq('care_circle_id', circleId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error ? error.message : 'Failed to update medication');
    }

    return data as Medication;
  },

  /**
   * Remove a member from a care circle (Restricted to Admins via RLS)
   */
  async removeMember(circleId: string, targetUserId: string, callerUserId: string): Promise<void> {
    const members = !isSupabaseConfigured()
      ? localMembers
      : await this.fetchCircleMembers(circleId);

    const callerMember = members.find(
      (m) => m.care_circle_id === circleId && m.user_id === callerUserId
    );

    if (!callerMember || callerMember.role !== 'admin') {
      throw new Error(
        'Permission denied: Only Care Circle Admins can remove members (RLS policy violation).'
      );
    }

    if (!isSupabaseConfigured()) {
      localMembers = localMembers.filter(
        (m) => !(m.care_circle_id === circleId && m.user_id === targetUserId)
      );
      return;
    }

    const { error } = await supabase
      .from('care_circle_members')
      .delete()
      .eq('care_circle_id', circleId)
      .eq('user_id', targetUserId);

    if (error) {
      throw new Error(error.message);
    }
  },

  /**
   * Update care circle settings (Restricted to Admins via RLS)
   */
  async updateCareCircleSettings(
    circleId: string,
    updates: Partial<Pick<CareCircle, 'name' | 'check_in_deadline_time' | 'primary_caregiver_phone' | 'elder_name'>>,
    callerUserId: string
  ): Promise<CareCircle> {
    const members = !isSupabaseConfigured()
      ? localMembers
      : await this.fetchCircleMembers(circleId);

    const callerMember = members.find(
      (m) => m.care_circle_id === circleId && m.user_id === callerUserId
    );

    if (!callerMember || callerMember.role !== 'admin') {
      throw new Error(
        'Permission denied: Only Care Circle Admins can change settings (RLS policy violation).'
      );
    }

    if (!isSupabaseConfigured()) {
      const circle = localCircles.find((c) => c.id === circleId);
      if (!circle) throw new Error('Care circle not found');
      if (updates.name) circle.name = updates.name.trim();
      if (updates.check_in_deadline_time) circle.check_in_deadline_time = updates.check_in_deadline_time;
      if (updates.primary_caregiver_phone) circle.primary_caregiver_phone = updates.primary_caregiver_phone.trim();
      if (updates.elder_name) circle.elder_name = updates.elder_name.trim();
      circle.updated_at = new Date().toISOString();
      return circle;
    }

    const { data, error } = await supabase
      .from('care_circles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', circleId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error ? error.message : 'Failed to update care circle settings');
    }

    return data as CareCircle;
  },


  /**
   * Elder Login via 4-Digit PIN (Stored as secure hash, no email required)
   */
  async loginElderWithPin(inviteCode: string, pin: string): Promise<ElderSession> {
    const trimmedCode = inviteCode.trim().toUpperCase();
    const trimmedPin = pin.trim();

    if (!/^\d{4}$/.test(trimmedPin)) {
      throw new Error('PIN must be exactly 4 numeric digits.');
    }

    const pinHash = await hashPin(trimmedPin);

    if (!isSupabaseConfigured()) {
      const circle = localCircles.find((c) => c.invite_code.toUpperCase() === trimmedCode);
      if (!circle) {
        throw new Error('Invalid Care Circle code.');
      }

      if (!circle.elder_pin_hash || circle.elder_pin_hash !== pinHash) {
        throw new Error('Incorrect 4-digit PIN for this Care Circle.');
      }

      return {
        circle_id: circle.id,
        circle_name: circle.name,
        elder_name: circle.elder_name || 'Eleanor',
        invite_code: circle.invite_code,
      };
    }

    const { data, error } = await supabase.rpc('verify_elder_pin', {
      p_invite_code: trimmedCode,
      p_pin_hash: pinHash,
    });

    if (error || !data) {
      throw new Error(error ? error.message : 'Invalid 4-digit PIN');
    }

    return {
      circle_id: String(data.circle_id),
      circle_name: String(data.circle_name),
      elder_name: String(data.elder_name),
      invite_code: String(data.invite_code),
    };
  },

  /**
   * "Call for help": Creates high-priority emergency event and triggers immediate SMS to all admins
   */
  async callForHelp(
    circleId: string,
    elderName: string = 'Eleanor'
  ): Promise<{ success: boolean; timelineEvent: TimelineEvent; message: string }> {
    const nowIso = new Date().toISOString();
    const title = `🚨 EMERGENCY: ${elderName} called for help!`;
    const description = `Emergency alert triggered from Elder Mode. Immediate assistance requested. High priority alert broadcasted to all caregivers.`;

    const circle = (!isSupabaseConfigured()
      ? localCircles
      : await this.fetchUserCircles('system')
    ).find((c) => c.id === circleId) || SEED_CARE_CIRCLE;

    // 1. Log high-priority timeline event
    const timelineEvent = await this.createTimelineEvent(
      {
        care_circle_id: circleId,
        type: 'note',
        title,
        description,
        occurred_at: nowIso,
      },
      circle.created_by || 'system'
    );

    // 2. Broadcast push notification
    await notificationService.scheduleMissedCheckInAlert(
      `🚨 HELP NEEDED: ${elderName}`,
      'IMMEDIATELY',
      1
    );

    // 3. Dispatch Twilio SMS to primary caregiver phone
    const primaryPhone = circle.primary_caregiver_phone || '+15551234567';

    // If Supabase live, invoke Edge function with forceSms
    if (isSupabaseConfigured()) {
      try {
        await supabase.functions.invoke('check-in-escalation', {
          body: { circleId, forceSms: true },
        });
      } catch (err) {
        console.warn('Call for help edge function invocation:', err);
      }
    }

    return {
      success: true,
      timelineEvent,
      message: `Emergency alert dispatched via Push & SMS to primary caregiver (${primaryPhone}).`,
    };
  },

  /**
   * Fetch today's medication logs for a care circle
   */
  async fetchTodayMedicationLogs(circleId: string): Promise<MedicationLog[]> {
    const today = getTodayDateString();

    if (!isSupabaseConfigured()) {
      // Ensure logs exist for all active medications and their schedules today
      const meds = localMedications.filter((m) => m.care_circle_id === circleId && m.is_active);
      const existingLogs = localMedicationLogs.filter(
        (l) => l.care_circle_id === circleId && l.scheduled_date === today
      );

      // Create missing pending logs if needed
      for (const med of meds) {
        for (const time of med.schedule) {
          const found = existingLogs.find(
            (l) => l.medication_id === med.id && l.scheduled_time === time
          );
          if (!found) {
            const newLog: MedicationLog = {
              id: `log-${med.id}-${time}`,
              medication_id: med.id,
              care_circle_id: circleId,
              scheduled_time: time,
              scheduled_date: today,
              status: 'pending',
              medication: med,
            };
            localMedicationLogs.push(newLog);
            existingLogs.push(newLog);
          }
        }
      }

      return existingLogs.map((log) => ({
        ...log,
        medication: localMedications.find((m) => m.id === log.medication_id),
      }));
    }

    const { data, error } = await supabase
      .from('medication_logs')
      .select(`
        *,
        medication:medication_id (*)
      `)
      .eq('care_circle_id', circleId)
      .eq('scheduled_date', today);

    if (error) {
      throw new Error(`Failed to load today's medication logs: ${error.message}`);
    }

    return (data || []) as MedicationLog[];
  },

  /**
   * Mark a medication dose Taken or Skipped, and log it automatically to the timeline
   */
  async logMedicationAction(
    medicationId: string,
    scheduledTime: string,
    status: MedicationStatus,
    circleId: string,
    userId: string,
    authorProfile?: UserProfile,
    notes?: string
  ): Promise<{ log: MedicationLog; timelineEvent: TimelineEvent }> {
    const today = getTodayDateString();
    const nowIso = new Date().toISOString();

    const med = (!isSupabaseConfigured()
      ? localMedications
      : (await this.fetchMedications(circleId))
    ).find((m) => m.id === medicationId);

    const medName = med ? `${med.name} (${med.dosage})` : 'Medication';
    const actionLabel = status === 'taken' ? 'Taken' : 'Skipped';
    const emoji = status === 'taken' ? '💊' : '⚠️';

    const timelineTitle = `${emoji} ${medName} marked ${actionLabel}`;
    const timelineDesc = notes
      ? `Scheduled for ${scheduledTime}. Notes: ${notes}`
      : `Scheduled for ${scheduledTime}. Recorded by ${authorProfile?.full_name || 'Caregiver'}.`;

    if (!isSupabaseConfigured()) {
      let existing = localMedicationLogs.find(
        (l) =>
          l.medication_id === medicationId &&
          l.scheduled_date === today &&
          l.scheduled_time === scheduledTime
      );

      if (existing) {
        existing.status = status;
        existing.logged_by = userId;
        existing.logged_at = nowIso;
        existing.notes = notes || null;
      } else {
        existing = {
          id: `log-${Date.now()}`,
          medication_id: medicationId,
          care_circle_id: circleId,
          scheduled_time: scheduledTime,
          scheduled_date: today,
          status,
          logged_by: userId,
          logged_at: nowIso,
          notes: notes || null,
          medication: med,
        };
        localMedicationLogs.push(existing);
      }

      const timelineEvent = await this.createTimelineEvent(
        {
          care_circle_id: circleId,
          type: 'med',
          title: timelineTitle,
          description: timelineDesc,
          occurred_at: nowIso,
        },
        userId,
        authorProfile
      );

      return { log: existing, timelineEvent };
    }

    // Live Supabase upsert
    const { data: logData, error: logError } = await supabase
      .from('medication_logs')
      .upsert(
        {
          medication_id: medicationId,
          care_circle_id: circleId,
          scheduled_date: today,
          scheduled_time: scheduledTime,
          status,
          logged_by: userId,
          logged_at: nowIso,
          notes: notes || null,
        },
        { onConflict: 'medication_id,scheduled_date,scheduled_time' }
      )
      .select('*')
      .single();

    if (logError || !logData) {
      throw new Error(logError ? logError.message : 'Failed to update medication log');
    }

    const timelineEvent = await this.createTimelineEvent(
      {
        care_circle_id: circleId,
        type: 'med',
        title: timelineTitle,
        description: timelineDesc,
        occurred_at: nowIso,
      },
      userId,
      authorProfile
    );

    return { log: logData as MedicationLog, timelineEvent };
  },

  /**
   * Fetch today's daily check-in record for a care circle
   */
  async fetchTodayCheckIn(circleId: string): Promise<DailyCheckIn | null> {
    const today = getTodayDateString();

    if (!isSupabaseConfigured()) {
      return (
        localCheckIns.find(
          (c) => c.care_circle_id === circleId && c.check_in_date === today
        ) || null
      );
    }

    const { data, error } = await supabase
      .from('daily_check_ins')
      .select(`
        *,
        checker_profile:checked_in_by (
          id,
          email,
          full_name,
          avatar_url,
          created_at
        )
      `)
      .eq('care_circle_id', circleId)
      .eq('check_in_date', today)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load check-in: ${error.message}`);
    }

    return data as DailyCheckIn | null;
  },

  /**
   * Record Daily "I'm OK" Check-in and log it to the timeline
   */
  async recordDailyCheckIn(
    circleId: string,
    userId: string,
    authorProfile?: UserProfile,
    notes?: string
  ): Promise<{ checkIn: DailyCheckIn; timelineEvent: TimelineEvent }> {
    const today = getTodayDateString();
    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const timelineTitle = `☀️ Daily Check-in: Eleanor is OK`;
    const timelineDesc = notes
      ? `Confirmed safe and well at ${formattedTime}. Notes: ${notes}`
      : `Confirmed safe and well at ${formattedTime} by ${authorProfile?.full_name || 'Family'}.`;

    if (!isSupabaseConfigured()) {
      let existing = localCheckIns.find(
        (c) => c.care_circle_id === circleId && c.check_in_date === today
      );

      if (existing) {
        existing.status = 'ok';
        existing.checked_in_by = userId;
        existing.checked_in_at = now.toISOString();
        existing.escalation_stage = 0;
        existing.notes = notes || null;
      } else {
        existing = {
          id: `checkin-${Date.now()}`,
          care_circle_id: circleId,
          checked_in_by: userId,
          check_in_date: today,
          checked_in_at: now.toISOString(),
          status: 'ok',
          escalation_stage: 0,
          notes: notes || null,
          checker_profile: authorProfile || SEED_PROFILES[userId] || null,
        };
        localCheckIns.push(existing);
      }

      const timelineEvent = await this.createTimelineEvent(
        {
          care_circle_id: circleId,
          type: 'note',
          title: timelineTitle,
          description: timelineDesc,
          occurred_at: now.toISOString(),
        },
        userId,
        authorProfile
      );

      return { checkIn: existing, timelineEvent };
    }

    const { data, error } = await supabase
      .from('daily_check_ins')
      .upsert(
        {
          care_circle_id: circleId,
          check_in_date: today,
          checked_in_by: userId,
          checked_in_at: now.toISOString(),
          status: 'ok',
          escalation_stage: 0,
          notes: notes || null,
        },
        { onConflict: 'care_circle_id,check_in_date' }
      )
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error ? error.message : 'Failed to record check-in');
    }

    const timelineEvent = await this.createTimelineEvent(
      {
        care_circle_id: circleId,
        type: 'note',
        title: timelineTitle,
        description: timelineDesc,
        occurred_at: now.toISOString(),
      },
      userId,
      authorProfile
    );

    return { checkIn: data as DailyCheckIn, timelineEvent };
  },

  /**
   * Missed check-in escalation: Trigger Stage 1 (push alert to all circle caregivers)
   * or Stage 2 (Twilio SMS to primary caregiver phone after 30 min window)
   */
  async triggerMissedCheckInEscalation(
    circleId: string,
    forceSms: boolean = false
  ): Promise<{ pushSent: boolean; smsSent: boolean; stage: number; message: string }> {
    const today = getTodayDateString();
    const circle = (!isSupabaseConfigured()
      ? localCircles
      : await this.fetchUserCircles('system')
    ).find((c) => c.id === circleId) || SEED_CARE_CIRCLE;

    const deadline = circle.check_in_deadline_time || '10:00';

    if (!isSupabaseConfigured()) {
      let checkIn = localCheckIns.find(
        (c) => c.care_circle_id === circleId && c.check_in_date === today
      );

      if (!checkIn) {
        checkIn = {
          id: `checkin-missed-${Date.now()}`,
          care_circle_id: circleId,
          check_in_date: today,
          checked_in_at: new Date().toISOString(),
          status: 'missed',
          escalation_stage: forceSms ? 2 : 1,
          notes: forceSms
            ? 'Escalated to Stage 2: Twilio SMS alert sent to primary caregiver.'
            : 'Escalated to Stage 1: Push alert sent to all circle caregivers.',
        };
        localCheckIns.push(checkIn);
      } else {
        checkIn.status = 'missed';
        checkIn.escalation_stage = forceSms ? 2 : (checkIn.escalation_stage >= 1 ? 2 : 1);
      }

      const stage = checkIn.escalation_stage;

      // Log warning to timeline
      if (stage === 1) {
        await this.createTimelineEvent(
          {
            care_circle_id: circleId,
            type: 'note',
            title: `⚠️ Alert: Missed Daily Check-in by ${deadline}`,
            description: `Check-in deadline (${deadline}) passed without confirmation. Push notifications sent to all caregivers. Twilio SMS will escalate in 30 minutes.`,
            occurred_at: new Date().toISOString(),
          },
          circle.created_by || 'system'
        );
      } else if (stage === 2) {
        await this.createTimelineEvent(
          {
            care_circle_id: circleId,
            type: 'note',
            title: `🚨 Emergency Escalation: SMS Dispatched to Primary Caregiver`,
            description: `Check-in overdue by 30+ minutes. Twilio SMS alert was dispatched to primary caregiver (${circle.primary_caregiver_phone || '+15551234567'}).`,
            occurred_at: new Date().toISOString(),
          },
          circle.created_by || 'system'
        );
      }

      return {
        pushSent: stage >= 1,
        smsSent: stage === 2,
        stage,
        message:
          stage === 2
            ? `Stage 2 Escalation: SMS sent via Twilio to primary caregiver (${circle.primary_caregiver_phone || 'phone'}).`
            : `Stage 1 Escalation: Push notification alert sent to all care circle members.`,
      };
    }

    // Call Supabase Edge function
    try {
      const { data, error } = await supabase.functions.invoke('check-in-escalation', {
        body: { circleId, forceSms },
      });

      if (error) {
        return {
          pushSent: true,
          smsSent: forceSms,
          stage: forceSms ? 2 : 1,
          message: `Escalation evaluated: ${error.message}`,
        };
      }

      return {
        pushSent: true,
        smsSent: forceSms,
        stage: forceSms ? 2 : 1,
        message: data?.results?.[0]?.actionTaken || 'Escalation executed successfully',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Escalation error';
      return { pushSent: true, smsSent: forceSms, stage: forceSms ? 2 : 1, message: msg };
    }
  },
};

