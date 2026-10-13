import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadPlanState,
  getActivePlan,
  getActiveDayIndex,
  getActiveVisitId,
  withActiveDay,
  PLAN_KEYS,
} from '../plans';
import { DEFAULT_PLAN_ID, makeDefaultPlan } from '../../data/defaultPlan';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('loadPlanState', () => {
  it('creates the built-in 5-Day Cycle on a fresh install and saves it', async () => {
    const state = await loadPlanState();

    expect(state.plans).toHaveLength(1);
    expect(state.activePlanId).toBe(DEFAULT_PLAN_ID);
    expect(state.progress[DEFAULT_PLAN_ID].activeDayIndex).toBe(0);
    expect(JSON.parse(await AsyncStorage.getItem(PLAN_KEYS.PLANS))).toEqual(state.plans);
  });

  it('keeps the current day from installs that predate plans', async () => {
    await AsyncStorage.setItem('workout:routineIndex', '3');

    const state = await loadPlanState();

    expect(state.progress[DEFAULT_PLAN_ID].activeDayIndex).toBe(3);
    expect(await AsyncStorage.getItem('workout:routineIndex')).toBeNull();
  });

  it('ignores an out-of-range legacy day index', async () => {
    await AsyncStorage.setItem('workout:routineIndex', '9');

    const state = await loadPlanState();

    expect(state.progress[DEFAULT_PLAN_ID].activeDayIndex).toBe(0);
  });

  it('starts a visit for the active day and keeps it across launches', async () => {
    const first = await loadPlanState();
    const second = await loadPlanState();

    expect(getActiveVisitId(first, getActivePlan(first))).toBeTruthy();
    expect(getActiveVisitId(second, getActivePlan(second))).toBe(
      getActiveVisitId(first, getActivePlan(first))
    );
  });

  it('adds a visit to progress saved before visits existed', async () => {
    const plan = makeDefaultPlan();
    await AsyncStorage.multiSet([
      [PLAN_KEYS.PLANS, JSON.stringify([plan])],
      [PLAN_KEYS.ACTIVE_PLAN_ID, plan.id],
      [PLAN_KEYS.PROGRESS, JSON.stringify({ [plan.id]: { activeDayIndex: 2 } })],
    ]);

    const state = await loadPlanState();

    expect(state.progress[plan.id].activeDayIndex).toBe(2);
    expect(state.progress[plan.id].visitId).toBeTruthy();
    expect(JSON.parse(await AsyncStorage.getItem(PLAN_KEYS.PROGRESS))).toEqual(state.progress);
  });

  it('returns saved plans as-is instead of re-seeding', async () => {
    const custom = { id: 'p1', name: 'Home', days: [] };
    await AsyncStorage.multiSet([
      [PLAN_KEYS.PLANS, JSON.stringify([custom])],
      [PLAN_KEYS.ACTIVE_PLAN_ID, 'p1'],
      [PLAN_KEYS.PROGRESS, JSON.stringify({ p1: { activeDayIndex: 0 } })],
    ]);

    const state = await loadPlanState();

    expect(state.plans).toEqual([custom]);
    expect(state.activePlanId).toBe('p1');
  });
});

describe('default plan', () => {
  it('reuses the original exercise IDs so logged history carries over', () => {
    const plan = makeDefaultPlan();
    const ids = plan.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));

    expect(plan.days).toHaveLength(5);
    expect(ids).toHaveLength(62);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('barbell_squat');
  });

  it('marks every exercise as either weights or checkbox', () => {
    const types = new Set(
      makeDefaultPlan().days.flatMap((d) => d.exercises.map((e) => e.logType))
    );

    expect([...types].sort()).toEqual(['checkbox', 'weights']);
  });
});

describe('active plan helpers', () => {
  const plan = { id: 'p1', name: 'A', days: [{ id: 'd1' }, { id: 'd2' }] };

  it('falls back to the first plan when the active one was deleted', () => {
    expect(getActivePlan({ plans: [plan], activePlanId: 'gone' })).toBe(plan);
  });

  it('starts a new visit whenever the active day changes', () => {
    const state = withActiveDay({ plans: [plan], activePlanId: 'p1', progress: {} }, 'p1', 0);
    const finished = withActiveDay(state, 'p1', 1);
    const sameDayAgain = withActiveDay(finished, 'p1', 1);

    expect(finished.progress.p1.activeDayIndex).toBe(1);
    expect(finished.progress.p1.visitId).not.toBe(state.progress.p1.visitId);
    expect(sameDayAgain.progress.p1.visitId).not.toBe(finished.progress.p1.visitId);
  });

  it('clamps a saved day index to the plan length', () => {
    const state = { plans: [plan], activePlanId: 'p1', progress: { p1: { activeDayIndex: 7 } } };

    expect(getActiveDayIndex(state, plan)).toBe(1);
  });
});
