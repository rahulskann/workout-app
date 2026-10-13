import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeDefaultPlan, defaultVideoLinks, DEFAULT_PLAN_ID } from '../data/defaultPlan';

// Plan shape:
//   { id, name, days: [{ id, name, exercises: [exercise] }] }
// exercise:
//   { exerciseId, name, targetGroup, targetSets, logType: 'weights' | 'checkbox',
//     videoUri, photoUri, videoUrl }
// exerciseId is the storage key for logged history (see storage.js), so it
// must be unique across every plan, not just within one.
export const PLAN_KEYS = {
  PLANS: 'workout:plans',
  ACTIVE_PLAN_ID: 'workout:activePlanId',
  PROGRESS: 'workout:planProgress', // { [planId]: { activeDayIndex, visitId } }
};

// Written by versions from before plans existed.
const LEGACY_ROUTINE_INDEX_KEY = 'workout:routineIndex';
const LEGACY_EXERCISE_PREFIX = 'workout:exercise:';

export function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Loads plans, which one is active, and where each plan is in its cycle.
// A brand-new install gets no plans, so the app shows the welcome screen and
// lets you pick how to start. An install from before plans existed gets the
// built-in 5-Day Cycle straight away and keeps its current day.
export async function loadPlanState() {
  const entries = await AsyncStorage.multiGet([
    PLAN_KEYS.PLANS,
    PLAN_KEYS.ACTIVE_PLAN_ID,
    PLAN_KEYS.PROGRESS,
  ]);
  const [rawPlans, activePlanId, rawProgress] = entries.map(([, value]) => value);

  if (rawPlans) {
    const saved = {
      plans: JSON.parse(rawPlans),
      activePlanId: activePlanId || null,
      progress: rawProgress ? JSON.parse(rawProgress) : {},
    };
    const withLinks = withDefaultVideoLinks(saved);
    const plan = getActivePlan(withLinks);
    const state = plan ? withActivePlan(withLinks, plan.id) : withLinks;
    if (state !== saved) await savePlanState(state);
    return state;
  }

  const keys = await AsyncStorage.getAllKeys();
  const hasLegacyData = keys.some(
    (k) => k === LEGACY_ROUTINE_INDEX_KEY || k.startsWith(LEGACY_EXERCISE_PREFIX)
  );
  if (!hasLegacyData) {
    return { plans: [], activePlanId: null, progress: {} };
  }

  const plan = makeDefaultPlan();
  const legacyIndex = parseInt(await AsyncStorage.getItem(LEGACY_ROUTINE_INDEX_KEY), 10);
  const activeDayIndex =
    Number.isInteger(legacyIndex) && legacyIndex >= 0 && legacyIndex < plan.days.length
      ? legacyIndex
      : 0;
  const state = withActiveDay({ plans: [plan], activePlanId: plan.id, progress: {} }, plan.id, activeDayIndex);
  await savePlanState(state);
  await AsyncStorage.removeItem(LEGACY_ROUTINE_INDEX_KEY);
  return state;
}

// Every time a day becomes active (Finish Day, or Set as Active Day) it gets
// a new visitId. Ticks are saved against the visit they were made in, so
// leaving a day clears its checklist while its logged history stays put.
export function withActiveDay(state, planId, activeDayIndex) {
  return {
    ...state,
    progress: {
      ...state.progress,
      [planId]: { activeDayIndex, visitId: newId('visit') },
    },
  };
}

// Gives the built-in 5-Day Cycle's exercises their default YouTube links on
// phones that saved the plan before the links existed. Only exercises that
// have never had a videoUrl at all are filled in: a link you removed is
// saved as null and stays removed, and one you changed is left alone.
// Returns the same object when nothing needed changing.
export function withDefaultVideoLinks(state) {
  const links = defaultVideoLinks();
  let changed = false;
  const plans = state.plans.map((plan) => {
    if (plan.id !== DEFAULT_PLAN_ID) return plan;
    return {
      ...plan,
      days: plan.days.map((day) => ({
        ...day,
        exercises: day.exercises.map((ex) => {
          if ('videoUrl' in ex) return ex;
          changed = true;
          return { ...ex, videoUrl: links.get(ex.exerciseId) || null };
        }),
      })),
    };
  });
  return changed ? { ...state, plans } : state;
}

// Makes planId the active plan, starting a visit for it if it doesn't have
// one yet (new plans, and progress saved before visits existed). Returns the
// same object when nothing needed changing.
export function withActivePlan(state, planId) {
  if (state.activePlanId === planId && state.progress[planId]?.visitId) return state;
  const next = { ...state, activePlanId: planId };
  if (next.progress[planId]?.visitId) return next;
  return withActiveDay(next, planId, next.progress[planId]?.activeDayIndex ?? 0);
}

// Adds a plan and switches to it.
export function withPlanAdded(state, plan) {
  return withActivePlan({ ...state, plans: [...state.plans, plan] }, plan.id);
}

// Removes a plan. If it was the active one, the first remaining plan takes
// over; with none left the app goes back to the welcome screen. Logged
// history stays in storage, so restoring the 5-Day Cycle brings it back.
export function withPlanRemoved(state, planId) {
  const plans = state.plans.filter((p) => p.id !== planId);
  const { [planId]: _removed, ...progress } = state.progress;
  const activePlanId =
    state.activePlanId === planId || !plans.some((p) => p.id === state.activePlanId)
      ? plans[0]?.id ?? null
      : state.activePlanId;
  const next = { plans, progress, activePlanId };
  return activePlanId ? withActivePlan(next, activePlanId) : next;
}

// Puts the original 5-Day Cycle back -- replacing any edits made to it, or
// re-adding it if it was deleted -- and switches to it. Photos and videos
// you'd added to its exercises are carried over, since they're yours rather
// than part of the program.
export function withDefaultPlanRestored(state) {
  const current = state.plans.find((p) => p.id === DEFAULT_PLAN_ID);
  const fresh = withMediaFrom(makeDefaultPlan(), current);
  const plans = current
    ? state.plans.map((p) => (p.id === fresh.id ? fresh : p))
    : [...state.plans, fresh];
  return withActivePlan({ ...state, plans }, fresh.id);
}

const MEDIA_FIELDS = ['photoUri', 'videoUri', 'videoUrl'];

function withMediaFrom(plan, source) {
  if (!source) return plan;
  const media = new Map();
  for (const day of source.days) {
    for (const ex of day.exercises) {
      const kept = Object.fromEntries(MEDIA_FIELDS.filter((f) => ex[f]).map((f) => [f, ex[f]]));
      if (Object.keys(kept).length) media.set(ex.exerciseId, kept);
    }
  }
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((ex) => ({ ...ex, ...media.get(ex.exerciseId) })),
    })),
  };
}

// Applies an edit to one plan (see planEdits.js). The plan's active day
// stays the same day when days are reordered; if it was deleted, the day now
// in its spot becomes active with a fresh visit.
export function withPlanEdited(state, planId, edit) {
  const plan = state.plans.find((p) => p.id === planId);
  if (!plan) return state;
  const edited = edit(plan);
  if (edited === plan) return state;

  const next = { ...state, plans: state.plans.map((p) => (p.id === planId ? edited : p)) };
  const progress = state.progress[planId];
  if (!progress) return next;

  const activeDayId = plan.days[getActiveDayIndex(state, plan)]?.id;
  if (!activeDayId && edited.days.length === 0) return next; // still no days
  const newIndex = edited.days.findIndex((d) => d.id === activeDayId);
  if (newIndex >= 0) {
    if (newIndex === progress.activeDayIndex) return next;
    return { ...next, progress: { ...next.progress, [planId]: { ...progress, activeDayIndex: newIndex } } };
  }
  const clamped = Math.min(progress.activeDayIndex, Math.max(edited.days.length - 1, 0));
  return withActiveDay(next, planId, clamped);
}

export function blankPlan(name = 'My Plan') {
  return { id: newId('plan'), name, days: [] };
}

// Copies a plan with new IDs throughout, so the copy builds its own history
// and PRs instead of sharing the original's.
export function copyPlan(plan, name = `Copy of ${plan.name}`) {
  return {
    id: newId('plan'),
    name,
    days: plan.days.map((day) => ({
      ...day,
      id: newId('day'),
      exercises: day.exercises.map((ex) => ({ ...ex, exerciseId: newId('ex') })),
    })),
  };
}

export async function savePlanState({ plans, activePlanId, progress }) {
  await AsyncStorage.multiSet([
    [PLAN_KEYS.PLANS, JSON.stringify(plans)],
    [PLAN_KEYS.ACTIVE_PLAN_ID, activePlanId || ''],
    [PLAN_KEYS.PROGRESS, JSON.stringify(progress)],
  ]);
}

// Falls back to the first plan if the saved active one was deleted.
export function getActivePlan({ plans, activePlanId }) {
  return plans.find((p) => p.id === activePlanId) || plans[0] || null;
}

export function getActiveDayIndex(state, plan) {
  if (!plan || plan.days.length === 0) return 0;
  const saved = state.progress[plan.id]?.activeDayIndex ?? 0;
  return Math.min(Math.max(saved, 0), plan.days.length - 1);
}

export function getActiveVisitId(state, plan) {
  return (plan && state.progress[plan.id]?.visitId) || null;
}
