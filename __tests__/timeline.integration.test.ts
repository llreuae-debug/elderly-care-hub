import { careCircleService, resetLocalState } from '../src/services/careCircleService';
import { SEED_CARE_CIRCLE, SEED_PROFILES } from '../src/services/mockData';
import { TimelineEvent } from '../src/types/database';

describe('Timeline Feed & Events Integration Tests', () => {
  beforeEach(() => {
    resetLocalState();
  });

  it('fetches seed timeline events with exactly three events of types note, med, and appointment', async () => {
    const events = await careCircleService.fetchTimelineEvents(SEED_CARE_CIRCLE.id);

    expect(events.length).toBe(3);

    const types = events.map((e) => e.type);
    expect(types).toContain('note');
    expect(types).toContain('med');
    expect(types).toContain('appointment');
  });

  it('verifies timeline events are strictly ordered newest first (descending by occurred_at)', async () => {
    const events = await careCircleService.fetchTimelineEvents(SEED_CARE_CIRCLE.id);

    for (let i = 0; i < events.length - 1; i++) {
      const current = new Date(events[i].occurred_at).getTime();
      const next = new Date(events[i + 1].occurred_at).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });

  it('adds a new care note to the timeline and reflects immediately', async () => {
    const sarah = SEED_PROFILES['11111111-1111-1111-1111-111111111111'];
    const newNote = await careCircleService.createTimelineEvent(
      {
        care_circle_id: SEED_CARE_CIRCLE.id,
        type: 'note',
        title: 'Bedtime Tea & Evening Reading',
        description: 'Eleanor finished chamomile tea and read two chapters of her historical novel before sleep.',
      },
      sarah.id,
      sarah
    );

    expect(newNote.id).toBeDefined();
    expect(newNote.title).toBe('Bedtime Tea & Evening Reading');
    expect(newNote.type).toBe('note');
    expect(newNote.author?.full_name).toBe('Sarah Vance (Daughter)');

    const updatedEvents = await careCircleService.fetchTimelineEvents(SEED_CARE_CIRCLE.id);
    expect(updatedEvents.length).toBe(4);
    expect(updatedEvents[0].id).toBe(newNote.id);
  });

  it('triggers realtime subscription callback when a new event is added', async () => {
    const marcus = SEED_PROFILES['22222222-2222-2222-2222-222222222222'];
    const receivedEvents: TimelineEvent[] = [];

    const unsubscribe = careCircleService.subscribeToTimelineEvents(
      SEED_CARE_CIRCLE.id,
      (event) => {
        receivedEvents.push(event);
      }
    );

    const medEvent = await careCircleService.createTimelineEvent(
      {
        care_circle_id: SEED_CARE_CIRCLE.id,
        type: 'med',
        title: 'Evening Melatonin 3mg Given',
        description: 'Taken at 8:45 PM.',
      },
      marcus.id,
      marcus
    );

    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0].id).toBe(medEvent.id);
    expect(receivedEvents[0].title).toBe('Evening Melatonin 3mg Given');

    unsubscribe();
  });
});
