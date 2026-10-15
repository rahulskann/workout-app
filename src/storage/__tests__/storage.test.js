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
  formatSetForSheet,
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

// Three finished sessions, one more than history keeps.
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

  it('sends each session as soon as its day ends', async () => {
    global.fetch.mockResolvedValue({ ok: true });
    await useWebhook();

    await logAndFinish(squat, 100);
    await flushPendingExports();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.sets).toEqual(sets(100));
    expect(body.routineName).toBe('Day 1');
    expect(await getPendingExports()).toEqual([]);
  });

  it('sends every session in order, including ones history no longer shows', async () => {
    global.fetch.mockResolvedValue({ ok: true });
    await useWebhook();

    await logThree(squat);
    await flushPendingExports();

    const sent = global.fetch.mock.calls.map(([, req]) => JSON.parse(req.body).sets[0].weight);
    expect(sent).toEqual([100, 110, 120]);
    expect(await getPendingExports()).toEqual([]);
  });

  it('sends sessions saved before every session was exported, once, with the next one', async () => {
    global.fetch.mockResolvedValue({ ok: true });
    await useWebhook();
    // History from before this change: both sessions were never sent.
    await AsyncStorage.setItem(
      'workout:exercise:barbell_squat',
      JSON.stringify({
        history: [
          { date: '2026-10-01', sets: sets(90) },
          { date: '2026-10-01', sets: sets(95) },
        ],
        maxWeight: 95,
        today: null,
      })
    );

    await logAndFinish(squat, 100);
    await flushPendingExports();
    await logAndFinish(squat, 105);
    await flushPendingExports();

    const bodies = global.fetch.mock.calls.map(([, req]) => JSON.parse(req.body));
    expect(bodies.map((b) => b.sets[0].weight)).toEqual([90, 95, 100, 105]);
    expect(new Set(bodies.map((b) => b.id)).size).toBe(4);
    expect(await getPendingExports()).toEqual([]);
  });

  it('keeps sessions queued when offline', async () => {
    global.fetch.mockRejectedValue(new TypeError('Network request failed'));
    await useWebhook();

    await logThree(squat);
    await flushPendingExports();

    const state = await getExerciseState(squat);
    expect(state.history.map((h) => h.sets[0].weight)).toEqual([110, 120]);
    expect(await getPendingExports()).toHaveLength(3);
  });

  it('keeps sessions queued while no Sheets destination is set up', async () => {
    await logThree(squat);
    await flushPendingExports();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(await getPendingExports()).toHaveLength(3);
  });

  it('does not drop a session queued while a flush is in progress', async () => {
    await useWebhook();
    let finishFirstSend;
    global.fetch
      .mockImplementationOnce(() => new Promise((resolve) => (finishFirstSend = resolve)))
      .mockResolvedValue({ ok: true });

    await logAndFinish(squat, 100); // queues squat and starts a flush that hangs on fetch
    while (!finishFirstSend) await new Promise((r) => setImmediate(r));
    await logAndFinish(press, 90); // queues press while that flush is still sending
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

describe('timed exercises', () => {
  const plank = { exerciseId: 'plank', name: 'Plank', logType: 'timed', targetSets: 2, routineName: 'Day 2' };
  const holds = (...secs) => secs.map((seconds) => ({ seconds }));

  it('logs times as a draft and tracks the longest hold as the PR', async () => {
    await logSession(plank, { sets: holds(45, 60) }, 'v1');
    expect((await getExerciseState(plank, 'v1')).completedToday).toBe(true);

    await commitDrafts([plank], 'v2');

    const state = await getExerciseState(plank);
    expect(state.history.map((h) => h.sets)).toEqual([holds(45, 60)]);
    expect(state.maxSeconds).toBe(60);
    expect(state.maxWeight).toBe(0);
  });

  it('keeps the best time when a later session is shorter', async () => {
    await logSession(plank, { sets: holds(90) }, 'v1');
    await commitDrafts([plank], 'v2');
    await logSession(plank, { sets: holds(30) }, 'v2');
    await commitDrafts([plank], 'v3');

    expect((await getExerciseState(plank)).maxSeconds).toBe(90);
  });

  it('sends times to the sheet as m:ss', async () => {
    global.fetch.mockResolvedValue({ ok: true });
    await useWebhook();
    for (const [i, secs] of [[1, 45], [2, 60], [3, 75]]) {
      await logSession(plank, { sets: holds(secs, secs + 5) }, `t${i}`);
      await commitDrafts([plank], `t${i}-next`);
    }
    await flushPendingExports();

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.weight).toBe('0:50');
    expect(body.sets.map(formatSetForSheet)).toEqual(['0:45', '0:50']);
  });

  it('formats weighted sets for the sheet as before', () => {
    expect(formatSetForSheet({ weight: 135, reps: 8 })).toBe('135x8');
    expect(formatSetForSheet({ seconds: 95 })).toBe('1:35');
  });
});
