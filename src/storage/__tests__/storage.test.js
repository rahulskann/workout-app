import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  logSession,
  getExerciseState,
  getPendingExports,
  flushPendingExports,
} from '../storage';
import { SETTINGS_KEY } from '../../constants/storageKeys';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../../services/googleAuth', () => ({ getFreshAccessToken: jest.fn() }));

const squat = { exerciseId: 'barbell_squat', name: 'Barbell Squat', targetSets: 3, routineName: 'Day 1' };
const press = { exerciseId: 'leg_press', name: 'Leg Press', targetSets: 3, routineName: 'Day 1' };
const sets = (weight) => [{ weight, reps: 10 }];

async function useWebhook() {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ sheetsWebhookUrl: 'https://hook.test' }));
}

// Logs three sessions so the first one rolls out of history into the queue.
async function logThree(exercise) {
  await logSession(exercise, { sets: sets(100) });
  await logSession(exercise, { sets: sets(110) });
  await logSession(exercise, { sets: sets(120) });
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

it('keeps the last two sessions and tracks the PR', async () => {
  global.fetch.mockResolvedValue({ ok: true });
  await useWebhook();

  await logThree(squat);

  const state = await getExerciseState(squat);
  expect(state.history.map((h) => h.sets[0].weight)).toEqual([110, 120]);
  expect(state.maxWeight).toBe(120);
});

it('allows bodyweight sets at 0 lbs', async () => {
  const state = await logSession(squat, { sets: [{ weight: 0, reps: 15 }] });

  expect(state.history).toHaveLength(1);
  expect(state.maxWeight).toBe(0);
});

it('sends the session that rolled out of history and clears it from the queue', async () => {
  global.fetch.mockResolvedValue({ ok: true });
  await useWebhook();

  await logThree(squat);
  await flushPendingExports();

  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(global.fetch.mock.calls[0][1].body).sets).toEqual(sets(100));
  expect(await getPendingExports()).toEqual([]);
});

it('saves the new session and keeps the old one queued when offline', async () => {
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
