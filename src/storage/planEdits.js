// Pure edits to a single plan, used by the plan editor screens through
// PlanContext.editPlan. Each takes a plan and returns a new one; IDs for new
// days and exercises are passed in so the screen can navigate to them.
//
// Editing an exercise keeps its exerciseId, so its logged history and PR
// stay attached through renames and set changes.

export const DEFAULT_EXERCISE = {
  name: '',
  targetGroup: '',
  targetSets: 3,
  logType: 'weights',
  videoUri: null, // a video file saved on the phone (see services/media.js)
  photoUri: null, // a photo of the machine, also saved on the phone
  videoUrl: null, // a YouTube link (see services/youtube.js)
};

export function renamePlan(plan, name) {
  return { ...plan, name };
}

export function addDay(plan, day) {
  return { ...plan, days: [...plan.days, { exercises: [], ...day }] };
}

export function renameDay(plan, dayId, name) {
  return mapDay(plan, dayId, (day) => ({ ...day, name }));
}

export function moveDay(plan, dayId, delta) {
  return { ...plan, days: move(plan.days, (d) => d.id === dayId, delta) };
}

export function removeDay(plan, dayId) {
  return { ...plan, days: plan.days.filter((d) => d.id !== dayId) };
}

export function addExercise(plan, dayId, exercise) {
  return mapDay(plan, dayId, (day) => ({
    ...day,
    exercises: [...day.exercises, { ...DEFAULT_EXERCISE, ...exercise }],
  }));
}

export function updateExercise(plan, dayId, exerciseId, changes) {
  return mapDay(plan, dayId, (day) => ({
    ...day,
    exercises: day.exercises.map((ex) =>
      ex.exerciseId === exerciseId ? { ...ex, ...changes, exerciseId } : ex
    ),
  }));
}

export function moveExercise(plan, dayId, exerciseId, delta) {
  return mapDay(plan, dayId, (day) => ({
    ...day,
    exercises: move(day.exercises, (ex) => ex.exerciseId === exerciseId, delta),
  }));
}

export function removeExercise(plan, dayId, exerciseId) {
  return mapDay(plan, dayId, (day) => ({
    ...day,
    exercises: day.exercises.filter((ex) => ex.exerciseId !== exerciseId),
  }));
}

function mapDay(plan, dayId, fn) {
  return { ...plan, days: plan.days.map((d) => (d.id === dayId ? fn(d) : d)) };
}

// Moves the matching item delta places (-1 = up, 1 = down); a move past
// either end leaves the list as it was.
function move(list, matches, delta) {
  const from = list.findIndex(matches);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
