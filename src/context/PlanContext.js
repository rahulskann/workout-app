import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  loadPlanState,
  savePlanState,
  getActivePlan,
  getActiveDayIndex,
  getActiveVisitId,
  withActiveDay,
  withActivePlan,
  withPlanAdded,
  withPlanRemoved,
  withDefaultPlanRestored,
  withPlanEdited,
  blankPlan,
  copyPlan,
} from '../storage/plans';
import { makeDefaultPlan } from '../data/defaultPlan';
import { commitDrafts } from '../storage/storage';

const EMPTY_STATE = { plans: [], activePlanId: null, progress: {} };

// Commits today's logged sets from every visit except the one in progress
// (see commitDrafts), so they land in history, PRs and the Sheets queue.
// previous covers plans that were just deleted, so their drafts still count.
function finishEndedVisits(state, previous = EMPTY_STATE) {
  const byId = new Map();
  for (const plan of [...previous.plans, ...state.plans]) {
    for (const day of plan.days) {
      for (const ex of day.exercises) byId.set(ex.exerciseId, ex);
    }
  }
  const keepVisitId = getActiveVisitId(state, getActivePlan(state));
  return commitDrafts([...byId.values()], keepVisitId).catch(() => {});
}

const PlanContext = createContext({
  loaded: false,
  plans: [],
  activePlan: null,
  activeDayIndex: 0,
  activeVisitId: null,
  setActiveDayIndex: () => {},
  advanceDay: () => {},
  setActivePlan: () => {},
  startWithDefaultPlan: () => {},
  createBlankPlan: () => {},
  createCopyOfDefaultPlan: () => {},
  duplicatePlan: () => {},
  deletePlan: () => {},
  editPlan: () => {},
});

export function PlanProvider({ children }) {
  const [state, setState] = useState(EMPTY_STATE);
  const [loaded, setLoaded] = useState(false);
  // Latest state for actions, so they never compute from a stale render.
  const stateRef = useRef(EMPTY_STATE);

  useEffect(() => {
    loadPlanState()
      .catch(() => EMPTY_STATE)
      .then(async (loadedState) => {
        await finishEndedVisits(loadedState);
        stateRef.current = loadedState;
        setState(loadedState);
        setLoaded(true);
      });
  }, []);

  // Applies a change to the plan state, saves it, then commits whatever was
  // logged during visits the change ended (switching day or plan, deleting).
  // Plain edits like renames don't end a visit, so they skip that step.
  const apply = useCallback(async (change) => {
    const previous = stateRef.current;
    const next = change(previous);
    if (next === previous) return;
    stateRef.current = next;
    setState(next);
    await savePlanState(next);
    const visitEnded =
      getActiveVisitId(previous, getActivePlan(previous)) !==
      getActiveVisitId(next, getActivePlan(next));
    if (visitEnded || next.plans.length < previous.plans.length) {
      await finishEndedVisits(next, previous);
    }
  }, []);

  // Starts a fresh visit of the given day, which clears the checklist of the
  // day being left (see withActiveDay) and commits what was logged there.
  const setActiveDayIndex = useCallback(
    (index) =>
      apply((current) => {
        const plan = getActivePlan(current);
        return plan ? withActiveDay(current, plan.id, index) : current;
      }),
    [apply]
  );

  const advanceDay = useCallback(
    () =>
      apply((current) => {
        const plan = getActivePlan(current);
        if (!plan || plan.days.length === 0) return current;
        const next = (getActiveDayIndex(current, plan) + 1) % plan.days.length;
        return withActiveDay(current, plan.id, next);
      }),
    [apply]
  );

  const setActivePlan = useCallback((planId) => apply((s) => withActivePlan(s, planId)), [apply]);

  // Adds the built-in 5-Day Cycle (or restores it to the original) and
  // switches to it. Used by the welcome screen and "Reset 5-Day Cycle".
  const startWithDefaultPlan = useCallback(() => apply(withDefaultPlanRestored), [apply]);

  const createBlankPlan = useCallback(
    () => apply((s) => withPlanAdded(s, blankPlan())),
    [apply]
  );

  const createCopyOfDefaultPlan = useCallback(
    () => apply((s) => withPlanAdded(s, copyPlan(makeDefaultPlan()))),
    [apply]
  );

  const duplicatePlan = useCallback(
    (planId) =>
      apply((s) => {
        const plan = s.plans.find((p) => p.id === planId);
        return plan ? withPlanAdded(s, copyPlan(plan)) : s;
      }),
    [apply]
  );

  const deletePlan = useCallback((planId) => apply((s) => withPlanRemoved(s, planId)), [apply]);

  // edit is one of the plan transforms in storage/planEdits.js.
  const editPlan = useCallback(
    (planId, edit) => apply((s) => withPlanEdited(s, planId, edit)),
    [apply]
  );

  const activePlan = getActivePlan(state);

  return (
    <PlanContext.Provider
      value={{
        loaded,
        plans: state.plans,
        activePlan,
        activeDayIndex: getActiveDayIndex(state, activePlan),
        activeVisitId: getActiveVisitId(state, activePlan),
        setActiveDayIndex,
        advanceDay,
        setActivePlan,
        startWithDefaultPlan,
        createBlankPlan,
        createCopyOfDefaultPlan,
        duplicatePlan,
        deletePlan,
        editPlan,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export function usePlans() {
  return useContext(PlanContext);
}
