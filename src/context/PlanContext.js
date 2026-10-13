import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  loadPlanState,
  savePlanState,
  getActivePlan,
  getActiveDayIndex,
} from '../storage/plans';

const EMPTY_STATE = { plans: [], activePlanId: null, progress: {} };

const PlanContext = createContext({
  loaded: false,
  plans: [],
  activePlan: null,
  activeDayIndex: 0,
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
      .then((loadedState) => {
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

  const setActiveDayIndex = useCallback(
    (index) => {
      const current = stateRef.current;
      const plan = getActivePlan(current);
      if (!plan) return Promise.resolve();
      return commit({
        ...current,
        progress: { ...current.progress, [plan.id]: { activeDayIndex: index } },
      });
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
