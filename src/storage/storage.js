import AsyncStorage from '@react-native-async-storage/async-storage';
import { ROUTINES } from '../data/routines';

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

// ---------- Exercise state (PR + rolling 2-session history) ----------

// Returns the exercise merged with any locally-saved state (falls back to
// the defaults defined in routines.js on first run).
export async function getExerciseState(exercise) {
  const raw = await AsyncStorage.getItem(KEYS.EXERCISE_PREFIX + exercise.exerciseId);
  if (!raw) {
    return { ...exercise };
  }
  const saved = JSON.parse(raw);
  return { ...exercise, ...saved };
}

export async function getExercisesForRoutine(routine) {
  return Promise.all(routine.exercises.map((ex) => getExerciseState(ex)));
}

// Logs a new session for an exercise. Implements the 2-entry rolling FIFO
// queue described in the spec: when history is already length 2, the
// oldest entry (index 0) is exported before being dropped, then the new
// session is appended.
export async function logSession(exercise, { weight, reps }) {
  const current = await getExerciseState(exercise);
  const newEntry = { date: new Date().toISOString().slice(0, 10), weight, reps };

  let history = [...(current.history || [])];

  if (history.length === 2) {
    const dropped = history[0];
    await exportSessionToSheets({
      routineName: exercise.routineName,
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.name,
      ...dropped,
    });
    history = [history[1], newEntry];
  } else {
    history.push(newEntry);
  }

  const maxWeight = Math.max(current.maxWeight || 0, weight);

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

// ---------- Export pipeline (stub) ----------
// TODO: replace with a real Google Apps Script Web App URL or REST endpoint.
// The spec calls for: POST the dropped week's {date, routineName, exerciseName,
// sets, reps, weight} to Sheets, then wait for HTTP 200 before shifting locally.
// For now this just logs the payload so nothing is silently lost while you
// wire up the real endpoint.
const SHEETS_WEBHOOK_URL = null; // e.g. 'https://script.google.com/macros/s/XXX/exec'

export async function exportSessionToSheets(payload) {
  if (!SHEETS_WEBHOOK_URL) {
    console.log('[export stub] would POST to Google Sheets:', payload);
    return { ok: true, stub: true };
  }
  const res = await fetch(SHEETS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { ok: res.status === 200 };
}
