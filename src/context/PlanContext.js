import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  loadPlanState,
  savePlanState,
  getActivePlan,
  getActiveDayIndex,
  getActiveVisitId,
  withActiveDay,
} from '../storage/plans';
import { commitDrafts } from '../storage/storage';

const EMPTY_STATE = { plans: [], activePlanId: null, progress: {} };

// Commits today's logged sets from every visit except the one in progress
// (see commitDrafts), so they land in history, PRs and the Sheets queue.
function finishEndedVisits(state) {
  const exercises = state.plans.flatMap((p) => p.days.flatMap((d) => d.exercises));
  return commitDrafts(exercises, getActiveVisitId(state, getActivePlan(state))).catch(() => {});
}

const PlanContext = createContext({
  loaded: false,
  plans: [],
  activePlan: null,
  activeDayIndex: 0,
  activeVisitId: null,
  setActiveDayIndex: () => {},
  advanceDay: () => {},
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

  const commit = useCallback((next) => {
    stateRef.current = next;
    setState(next);
    return savePlanState(next);
  }, []);

  // Starts a fresh visit of the given day, which clears the checklist of the
  // day being left (see withActiveDay) and commits what was logged there.
  const setActiveDayIndex = useCallback(
    async (index) => {
      const current = stateRef.current;
      const plan = getActivePlan(current);
      if (!plan) return;
      const next = withActiveDay(current, plan.id, index);
      await commit(next);
      await finishEndedVisits(next);
    },
    [commit]
  );

  const advanceDay = useCallback(() => {
    const current = stateRef.current;
    const plan = getActivePlan(current);
    if (!plan || plan.days.length === 0) return Promise.resolve();
    const next = (getActiveDayIndex(current, plan) + 1) % plan.days.length;
    return setActiveDayIndex(next);
  }, [setActiveDayIndex]);

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
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export function usePlans() {
  return useContext(PlanContext);
}
