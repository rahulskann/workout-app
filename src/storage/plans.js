import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeDefaultPlan } from '../data/defaultPlan';

// Plan shape:
//   { id, name, days: [{ id, name, exercises: [exercise] }] }
// exercise:
//   { exerciseId, name, targetGroup, targetSets, logType: 'weights' | 'checkbox', videoUri }
// exerciseId is the storage key for logged history (see storage.js), so it
// must be unique across every plan, not just within one.
export const PLAN_KEYS = {
  PLANS: 'workout:plans',
  ACTIVE_PLAN_ID: 'workout:activePlanId',
  PROGRESS: 'workout:planProgress', // { [planId]: { activeDayIndex } }
};

// Written by versions from before plans existed.
const LEGACY_ROUTINE_INDEX_KEY = 'workout:routineIndex';

export function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Loads plans, which one is active, and where each plan is in its cycle.
// First run creates the built-in 5-Day Cycle; an install from before plans
// existed keeps its current day.
export async function loadPlanState() {
  const entries = await AsyncStorage.multiGet([
    PLAN_KEYS.PLANS,
    PLAN_KEYS.ACTIVE_PLAN_ID,
    PLAN_KEYS.PROGRESS,
  ]);
  const [rawPlans, activePlanId, rawProgress] = entries.map(([, value]) => value);

  if (rawPlans) {
    return {
      plans: JSON.parse(rawPlans),
      activePlanId,
      progress: rawProgress ? JSON.parse(rawProgress) : {},
    };
  }

  const plan = makeDefaultPlan();
  const legacyIndex = parseInt(await AsyncStorage.getItem(LEGACY_ROUTINE_INDEX_KEY), 10);
  const activeDayIndex =
    Number.isInteger(legacyIndex) && legacyIndex >= 0 && legacyIndex < plan.days.length
      ? legacyIndex
      : 0;
  const state = {
    plans: [plan],
    activePlanId: plan.id,
    progress: { [plan.id]: { activeDayIndex } },
  };
  await savePlanState(state);
  await AsyncStorage.removeItem(LEGACY_ROUTINE_INDEX_KEY);
  return state;
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
