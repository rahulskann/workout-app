import {
  renamePlan,
  addDay,
  renameDay,
  moveDay,
  removeDay,
  addExercise,
  updateExercise,
  moveExercise,
  removeExercise,
} from '../planEdits';
import { withPlanEdited, withActiveDay, getActiveDayIndex, getActiveVisitId } from '../plans';

const plan = {
  id: 'p1',
  name: 'Plan',
  days: [
    { id: 'a', name: 'A', exercises: [{ exerciseId: 'a1', name: 'Squat', targetSets: 3 }] },
    { id: 'b', name: 'B', exercises: [] },
    { id: 'c', name: 'C', exercises: [] },
  ],
};

describe('plan edits', () => {
  it('renames plans and days', () => {
    expect(renamePlan(plan, 'New').name).toBe('New');
    expect(renameDay(plan, 'b', 'Pull').days[1].name).toBe('Pull');
  });

  it('adds a day at the end with no exercises', () => {
    const next = addDay(plan, { id: 'd', name: 'D' });

    expect(next.days.map((d) => d.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(next.days[3].exercises).toEqual([]);
  });

  it('moves days up and down, ignoring moves past either end', () => {
    expect(moveDay(plan, 'c', -1).days.map((d) => d.id)).toEqual(['a', 'c', 'b']);
    expect(moveDay(plan, 'a', 1).days.map((d) => d.id)).toEqual(['b', 'a', 'c']);
    expect(moveDay(plan, 'a', -1)).toEqual(plan);
    expect(moveDay(plan, 'c', 1)).toEqual(plan);
  });

  it('removes a day', () => {
    expect(removeDay(plan, 'b').days.map((d) => d.id)).toEqual(['a', 'c']);
  });

  it('adds an exercise with defaults filled in', () => {
    const next = addExercise(plan, 'b', { exerciseId: 'b1', name: 'Plank', logType: 'checkbox' });

    expect(next.days[1].exercises).toEqual([
      {
        exerciseId: 'b1',
        name: 'Plank',
        targetGroup: '',
        targetSets: 3,
        logType: 'checkbox',
        videoUri: null,
        photoUri: null,
        videoUrl: null,
      },
    ]);
  });

  it('updates an exercise but never its id, so history stays attached', () => {
    const next = updateExercise(plan, 'a', 'a1', { name: 'Back Squat', targetSets: 5, exerciseId: 'x' });

    expect(next.days[0].exercises[0]).toEqual({ exerciseId: 'a1', name: 'Back Squat', targetSets: 5 });
  });

  it('moves and removes exercises', () => {
    const withTwo = addExercise(plan, 'a', { exerciseId: 'a2', name: 'Lunge' });

    expect(moveExercise(withTwo, 'a', 'a2', -1).days[0].exercises.map((e) => e.exerciseId)).toEqual([
      'a2',
      'a1',
    ]);
    expect(removeExercise(withTwo, 'a', 'a1').days[0].exercises.map((e) => e.exerciseId)).toEqual([
      'a2',
    ]);
  });
});

describe('withPlanEdited', () => {
  // Day "b" is active.
  const state = withActiveDay({ plans: [plan], activePlanId: 'p1', progress: {} }, 'p1', 1);
  const visit = state.progress.p1.visitId;

  it('keeps the same day active when days are reordered', () => {
    const next = withPlanEdited(state, 'p1', (p) => moveDay(p, 'b', -1));

    expect(getActiveDayIndex(next, next.plans[0])).toBe(0);
    expect(next.plans[0].days[0].id).toBe('b');
    expect(getActiveVisitId(next, next.plans[0])).toBe(visit);
  });

  it('keeps the visit going for edits that leave the active day alone', () => {
    const next = withPlanEdited(state, 'p1', (p) => renameDay(p, 'b', 'Pull'));

    expect(next.progress).toBe(state.progress);
  });

  it('starts a new visit on the day that takes its spot when the active day is deleted', () => {
    const next = withPlanEdited(state, 'p1', (p) => removeDay(p, 'b'));

    expect(next.plans[0].days[getActiveDayIndex(next, next.plans[0])].id).toBe('c');
    expect(getActiveVisitId(next, next.plans[0])).not.toBe(visit);
  });

  it('returns the same state when nothing changed', () => {
    expect(withPlanEdited(state, 'p1', (p) => p)).toBe(state);
    expect(withPlanEdited(state, 'missing', (p) => renamePlan(p, 'X'))).toBe(state);
  });
});
