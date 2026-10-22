import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  CareCircle,
  CareCircleMember,
  CreateTimelineEventInput,
  TimelineEvent,
  UserProfile,
} from '../types/database';
import {
  SEED_CARE_CIRCLE,
  SEED_MEMBERS,
  SEED_PROFILES,
  SEED_TIMELINE_EVENTS,
} from './mockData';

// In-memory store for fallback/demo/test mode
let localCircles: CareCircle[] = [{ ...SEED_CARE_CIRCLE }];
let localMembers: CareCircleMember[] = [...SEED_MEMBERS];
let localEvents: TimelineEvent[] = [...SEED_TIMELINE_EVENTS];
const localSubscribers: Map<string, Array<(event: TimelineEvent) => void>> = new Map();

export const resetLocalState = (): void => {
  localCircles = [{ ...SEED_CARE_CIRCLE }];
  localMembers = [...SEED_MEMBERS];
  localEvents = [...SEED_TIMELINE_EVENTS];
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
};
