import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadPlanState,
  getActivePlan,
  getActiveDayIndex,
  getActiveVisitId,
  withActiveDay,
  withActivePlan,
  withPlanAdded,
  withPlanRemoved,
  withDefaultPlanRestored,
  blankPlan,
  copyPlan,
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
  it('gives a brand-new install no plans, so the welcome screen shows', async () => {
    const state = await loadPlanState();

    expect(state.plans).toEqual([]);
    expect(await AsyncStorage.getItem(PLAN_KEYS.PLANS)).toBeNull();
  });

  it('gives an install with logged history from before plans the 5-Day Cycle', async () => {
    await AsyncStorage.setItem('workout:exercise:barbell_squat', JSON.stringify({ history: [] }));

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
    await AsyncStorage.setItem('workout:routineIndex', '0');
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

describe('managing plans', () => {
  const empty = { plans: [], activePlanId: null, progress: {} };

  it('starting with the 5-Day Cycle adds the built-in plan and makes it active', () => {
    const state = withDefaultPlanRestored(empty);

    expect(state.plans.map((p) => p.id)).toEqual([DEFAULT_PLAN_ID]);
    expect(state.activePlanId).toBe(DEFAULT_PLAN_ID);
    expect(getActiveVisitId(state, state.plans[0])).toBeTruthy();
  });

  it('a new plan becomes active with its own visit', () => {
    const start = withDefaultPlanRestored(empty);
    const blank = blankPlan();

    const state = withPlanAdded(start, blank);

    expect(state.activePlanId).toBe(blank.id);
    expect(state.progress[blank.id].visitId).toBeTruthy();
    expect(state.progress[DEFAULT_PLAN_ID]).toEqual(start.progress[DEFAULT_PLAN_ID]);
  });

  it('switching back to a plan keeps its place in the cycle', () => {
    let state = withDefaultPlanRestored(empty);
    state = withActiveDay(state, DEFAULT_PLAN_ID, 3);
    state = withPlanAdded(state, blankPlan());

    state = withActivePlan(state, DEFAULT_PLAN_ID);

    expect(getActiveDayIndex(state, getActivePlan(state))).toBe(3);
  });

  it('copies get new IDs everywhere so they keep separate history', () => {
    const original = makeDefaultPlan();
    const copy = copyPlan(original);

    const ids = (p) => p.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    expect(copy.name).toBe('Copy of 5-Day Cycle');
    expect(copy.id).not.toBe(original.id);
    expect(ids(copy)).toHaveLength(ids(original).length);
    expect(ids(copy).some((id) => ids(original).includes(id))).toBe(false);
    expect(copy.days.map((d) => d.name)).toEqual(original.days.map((d) => d.name));
  });

  it('deleting the active plan switches to the next one', () => {
    const start = withDefaultPlanRestored(empty);
    const blank = blankPlan();
    const state = withPlanRemoved(withPlanAdded(start, blank), blank.id);

    expect(state.plans.map((p) => p.id)).toEqual([DEFAULT_PLAN_ID]);
    expect(state.activePlanId).toBe(DEFAULT_PLAN_ID);
    expect(state.progress[blank.id]).toBeUndefined();
  });

  it('deleting the last plan leaves no active plan (welcome screen)', () => {
    const state = withPlanRemoved(withDefaultPlanRestored(empty), DEFAULT_PLAN_ID);

    expect(state).toEqual(empty);
  });

  it('reset replaces edits to the 5-Day Cycle but keeps its place in the cycle', () => {
    let state = withActiveDay(withDefaultPlanRestored(empty), DEFAULT_PLAN_ID, 2);
    state = {
      ...state,
      plans: state.plans.map((p) => ({ ...p, name: 'Edited', days: p.days.slice(0, 3) })),
    };
    state = withPlanAdded(state, blankPlan());

    state = withDefaultPlanRestored(state);

    const restored = getActivePlan(state);
    expect(restored.id).toBe(DEFAULT_PLAN_ID);
    expect(restored).toEqual(makeDefaultPlan());
    expect(state.plans).toHaveLength(2);
    expect(getActiveDayIndex(state, restored)).toBe(2);
  });
});
