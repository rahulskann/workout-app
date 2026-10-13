import { ROUTINES } from './routines';

// The built-in plan everyone can start from (and reset back to). It reuses
// the exercise IDs from routines.js, so history and PRs logged before plans
// existed attach to it automatically.
export const DEFAULT_PLAN_ID = 'default-5-day-cycle';

export function makeDefaultPlan() {
  return {
    id: DEFAULT_PLAN_ID,
    name: '5-Day Cycle',
    days: ROUTINES.map((routine, i) => ({
      id: `day${i + 1}`,
      name: routine.name,
      exercises: routine.exercises.map((ex) => ({
        exerciseId: ex.exerciseId,
        name: ex.name,
        targetGroup: ex.targetGroup,
        targetSets: ex.targetSets,
        logType: ex.logType === 'checkbox' ? 'checkbox' : 'weights',
        videoUri: ex.videoUri || null,
      })),
    })),
  };
}
