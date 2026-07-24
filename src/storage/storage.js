import AsyncStorage from '@react-native-async-storage/async-storage';
import { ROUTINES } from '../data/routines';
import { SETTINGS_KEY } from '../constants/storageKeys';

const KEYS = {
  ROUTINE_INDEX: 'workout:routineIndex',
  EXERCISE_PREFIX: 'workout:exercise:', // + exerciseId
};

// ---------- Routine cycling ----------

export async function getRoutineIndex() {
  const raw = await AsyncStorage.getItem(KEYS.ROUTINE_INDEX);
  return raw ? parseInt(raw, 10) : 0;
}

export async function advanceRoutine() {
  const current = await getRoutineIndex();
  const next = (current + 1) % ROUTINES.length;
  await AsyncStorage.setItem(KEYS.ROUTINE_INDEX, String(next));
  return next;
}

// Jumps directly to a chosen day (used by the day picker). Unlike
// advanceRoutine, this doesn't reset completion state on other days --
// each day's checklist tracks its own "completedToday" independently.
export async function setRoutineIndex(index) {
  await AsyncStorage.setItem(KEYS.ROUTINE_INDEX, String(index));
  return index;
}

// ---------- Exercise state (PR + rolling 2-session history) ----------

// Returns the exercise merged with any locally-saved state (falls back to
// the defaults defined in routines.js on first run).
export async function getExerciseState(exercise) {
  const raw = await AsyncStorage.getItem(KEYS.EXERCISE_PREFIX + exercise.exerciseId);
  if (!raw) {
    return { ...exercise };
  }
  const saved = JSON.parse(raw);
  // Migrate any history entries logged before the per-set schema existed
  // (old shape was {date, weight, reps} instead of {date, reps, sets: []}).
  const migratedHistory = (saved.history || []).map((h) =>
    h.sets ? h : { ...h, sets: [h.weight || 0] }
  );
  return { ...exercise, ...saved, history: migratedHistory };
}

export async function getExercisesForRoutine(routine) {
  return Promise.all(routine.exercises.map((ex) => getExerciseState(ex)));
}

// Logs a new session for a weighted (non-checkbox) exercise.
// payload: { reps: number, sets: number[] }  -- one weight entry per set.
// Implements the 2-entry rolling FIFO queue described in the spec: when
// history is already length 2, the oldest entry (index 0) is exported
// before being dropped, then the new session is appended.
export async function logSession(exercise, payload) {
  if (exercise.logType === 'checkbox') {
    return logCheckboxComplete(exercise);
  }

  const current = await getExerciseState(exercise);
  const { reps, sets } = payload;
  const topWeight = Math.max(...sets);
  const newEntry = { date: new Date().toISOString().slice(0, 10), reps, sets };

  let history = [...(current.history || [])];

  if (history.length === 2) {
    const dropped = history[0];
    await exportSessionToSheets({
      routineName: exercise.routineName,
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.name,
      date: dropped.date,
      reps: dropped.reps,
      weight: Math.max(...(dropped.sets || [dropped.weight || 0])),
      sets: dropped.sets || [dropped.weight || 0],
    });
    history = [history[1], newEntry];
  } else {
    history.push(newEntry);
  }

  const maxWeight = Math.max(current.maxWeight || 0, topWeight);

  const updated = {
    ...current,
    history,
    maxWeight,
    completedToday: true,
  };

  await AsyncStorage.setItem(
    KEYS.EXERCISE_PREFIX + exercise.exerciseId,
    JSON.stringify({ history, maxWeight, completedToday: true })
  );

  return updated;
}

// Checkbox-type exercises (warm-ups, cooldowns, mobility routines) just
// need a "done today" toggle -- no weight/rep tracking.
export async function logCheckboxComplete(exercise) {
  const current = await getExerciseState(exercise);
  const updated = { ...current, completedToday: true };
  await AsyncStorage.setItem(
    KEYS.EXERCISE_PREFIX + exercise.exerciseId,
    JSON.stringify({
      history: current.history || [],
      maxWeight: current.maxWeight || 0,
      completedToday: true,
    })
  );
  return updated;
}

// Clears the "completed today" checkmark on all exercises in a routine.
// Call this after advancing to the next day so the checklist resets.
export async function resetCompletionForRoutine(routine) {
  await Promise.all(
    routine.exercises.map(async (ex) => {
      const raw = await AsyncStorage.getItem(KEYS.EXERCISE_PREFIX + ex.exerciseId);
      const saved = raw ? JSON.parse(raw) : {};
      await AsyncStorage.setItem(
        KEYS.EXERCISE_PREFIX + ex.exerciseId,
        JSON.stringify({ ...saved, completedToday: false })
      );
    })
  );
}

// ---------- Export pipeline ----------
// The webhook URL is set from the Settings screen (Google Sheets section)
// and stored alongside other preferences. The spec calls for: POST the
// dropped week's {date, routineName, exerciseName, sets, reps, weight} to
// Sheets, then wait for HTTP 200 before shifting locally. Until a URL is
// set, this just logs the payload so nothing is silently lost.
export async function exportSessionToSheets(payload) {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  const settings = raw ? JSON.parse(raw) : {};
  const url = settings.sheetsWebhookUrl;

  if (!url) {
    console.log('[export stub] no Sheets URL set in Settings yet, would POST:', payload);
    return { ok: true, stub: true };
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { ok: res.status === 200 };
}
