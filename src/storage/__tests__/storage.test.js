import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  logSession,
  clearToday,
  commitDrafts,
  getExerciseState,
  getPendingExports,
  flushPendingExports,
  getAllExerciseStates,
  replaceAllExerciseStates,
  replacePendingExports,
} from '../storage';
import { SETTINGS_KEY } from '../../constants/storageKeys';

jest.mock('../../services/googleAuth', () => ({ getFreshAccessToken: jest.fn() }));

const squat = { exerciseId: 'barbell_squat', name: 'Barbell Squat', targetSets: 3, routineName: 'Day 1' };
const press = { exerciseId: 'leg_press', name: 'Leg Press', targetSets: 3, routineName: 'Day 1' };
const warmup = { exerciseId: 'warmup', name: 'Warm Up', logType: 'checkbox' };
const sets = (weight) => [{ weight, reps: 10 }];

let visitCounter = 0;

// Logs one session during a fresh visit, then ends that visit.
async function logAndFinish(exercise, weight) {
  visitCounter += 1;
  const visit = `visit-${visitCounter}`;
  await logSession(exercise, { sets: sets(weight) }, visit);
  await commitDrafts([exercise], `${visit}-next`);
}

// Three finished sessions, so the first one rolls out of history into the queue.
async function logThree(exercise) {
  await logAndFinish(exercise, 100);
  await logAndFinish(exercise, 110);
  await logAndFinish(exercise, 120);
}

async function useWebhook() {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ sheetsWebhookUrl: 'https://hook.test' }));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  global.fetch = jest.fn();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  await flushPendingExports(); // let any fire-and-forget flush settle
  jest.restoreAllMocks();
});

describe("today's log", () => {
  it('stays a draft until the visit ends, then joins history', async () => {
    await logSession(squat, { sets: sets(135) }, 'v1');

    const during = await getExerciseState(squat, 'v1');
    expect(during.completedToday).toBe(true);
    expect(during.today.sets).toEqual(sets(135));
    expect(during.history).toEqual([]);
    expect(during.maxWeight).toBe(0);

    await commitDrafts([squat], 'v2');

    const after = await getExerciseState(squat, 'v2');
    expect(after.completedToday).toBe(false);
    expect(after.today).toBeNull();
    expect(after.history.map((h) => h.sets)).toEqual([sets(135)]);
    expect(after.maxWeight).toBe(135);
  });

  it('keeps only the latest numbers when logged again in the same visit', async () => {
    await logSession(squat, { sets: sets(135) }, 'v1');
    await logSession(squat, { sets: sets(145) }, 'v1');
    await commitDrafts([squat], 'v2');

    const state = await getExerciseState(squat, 'v2');
    expect(state.history.map((h) => h.sets)).toEqual([sets(145)]);
  });

  it('undo removes the draft so nothing reaches history', async () => {
    await logSession(squat, { sets: sets(135) }, 'v1');
    await clearToday(squat, 'v1');

    expect((await getExerciseState(squat, 'v1')).completedToday).toBe(false);
    await commitDrafts([squat], 'v2');
    expect((await getExerciseState(squat, 'v2')).history).toEqual([]);
  });

  it('can untick a checkbox exercise', async () => {
    await logSession(warmup, {}, 'v1');
    await clearToday(warmup, 'v1');

    expect((await getExerciseState(warmup, 'v1')).completedToday).toBe(false);
  });

  it('leaves the visit in progress alone when committing', async () => {
    await logSession(squat, { sets: sets(135) }, 'v1');
    await commitDrafts([squat], 'v1');

    const state = await getExerciseState(squat, 'v1');
    expect(state.completedToday).toBe(true);
    expect(state.history).toEqual([]);
  });

  it("finishes a draft left from an earlier visit before logging over it", async () => {
    await logSession(squat, { sets: sets(135) }, 'v1'); // app closed before the visit ended
    await logSession(squat, { sets: sets(140) }, 'v2');

    const state = await getExerciseState(squat, 'v2');
    expect(state.history.map((h) => h.sets)).toEqual([sets(135)]);
    expect(state.today.sets).toEqual(sets(140));
  });

  it('dates sessions in local time', async () => {
    await logSession(squat, { sets: sets(135) }, 'v1');

    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect((await getExerciseState(squat, 'v1')).today.date).toBe(expected);
  });
});

describe('visits', () => {
  it('only shows ticks for the visit they were made in', async () => {
    await logSession(warmup, {}, 'v1');

    expect((await getExerciseState(warmup, 'v1')).completedToday).toBe(true);
    expect((await getExerciseState(warmup, 'v2')).completedToday).toBe(false);
    expect((await getExerciseState(warmup)).completedToday).toBe(false); // previewing
  });

  it('ignores ticks saved before visits existed', async () => {
    await AsyncStorage.setItem(
      'workout:exercise:barbell_squat',
      JSON.stringify({ history: [], maxWeight: 0, completedToday: true })
    );

    expect((await getExerciseState(squat, 'v1')).completedToday).toBe(false);
  });
});

describe('history and export queue', () => {
  it('keeps the last two sessions and tracks the PR', async () => {
    global.fetch.mockResolvedValue({ ok: true });
    await useWebhook();

    await logThree(squat);

    const state = await getExerciseState(squat);
    expect(state.history.map((h) => h.sets[0].weight)).toEqual([110, 120]);
    expect(state.maxWeight).toBe(120);
  });

  it('allows bodyweight sets at 0 lbs', async () => {
    await logSession(squat, { sets: [{ weight: 0, reps: 15 }] }, 'v1');
    await commitDrafts([squat], 'v2');

    const state = await getExerciseState(squat);
    expect(state.history).toHaveLength(1);
    expect(state.maxWeight).toBe(0);
  });

  it('sends the session that rolled out of history and clears it from the queue', async () => {
    global.fetch.mockResolvedValue({ ok: true });
    await useWebhook();

    await logThree(squat);
    await flushPendingExports();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.sets).toEqual(sets(100));
    expect(body.routineName).toBe('Day 1');
    expect(await getPendingExports()).toEqual([]);
  });

  it('keeps the old session queued when offline', async () => {
    global.fetch.mockRejectedValue(new TypeError('Network request failed'));
    await useWebhook();

    await logThree(squat);
    await flushPendingExports();

    const state = await getExerciseState(squat);
    expect(state.history.map((h) => h.sets[0].weight)).toEqual([110, 120]);
    expect(await getPendingExports()).toHaveLength(1);
  });

  it('keeps sessions queued while no Sheets destination is set up', async () => {
    await logThree(squat);
    await flushPendingExports();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(await getPendingExports()).toHaveLength(1);
  });

  it('does not drop a session queued while a flush is in progress', async () => {
    await useWebhook();
    let finishFirstSend;
    global.fetch
      .mockImplementationOnce(() => new Promise((resolve) => (finishFirstSend = resolve)))
      .mockResolvedValue({ ok: true });

    await logThree(squat); // queues squat and starts a flush that hangs on fetch
    while (!finishFirstSend) await new Promise((r) => setImmediate(r));
    await logThree(press); // queues press while that flush is still sending
    finishFirstSend({ ok: true });
    await flushPendingExports();

    const queue = await getPendingExports();
    expect(queue.map((p) => p.exerciseId)).toEqual(['leg_press']);

    await flushPendingExports();
    expect(await getPendingExports()).toEqual([]);
  });
});

describe('backup and restore', () => {
  it('reads every exercise state and replaces them all on restore', async () => {
    await logAndFinish(squat, 100);
    await logSession(press, { sets: sets(90) }, 'v-live');
    await AsyncStorage.setItem('workout:settings', '{}'); // not an exercise key

    const saved = await getAllExerciseStates();
    expect(Object.keys(saved).sort()).toEqual(['barbell_squat', 'leg_press']);

    await logAndFinish(warmup, 0); // logged after the backup was taken
    await replaceAllExerciseStates(saved);

    expect(Object.keys(await getAllExerciseStates()).sort()).toEqual(['barbell_squat', 'leg_press']);
    expect((await getExerciseState(squat)).history).toHaveLength(1);
    expect((await getExerciseState(press, 'v-live')).completedToday).toBe(true);
    expect(await AsyncStorage.getItem('workout:settings')).toBe('{}');
  });

  it('replaces the Sheets queue', async () => {
    await replacePendingExports([{ id: 'a' }, { id: 'b' }]);

    expect(await getPendingExports()).toEqual([{ id: 'a' }, { id: 'b' }]);
  });
});
