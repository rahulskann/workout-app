import AsyncStorage from '@react-native-async-storage/async-storage';
import { ROUTINES } from '../data/routines';
import { SETTINGS_KEY } from '../constants/storageKeys';
import { getFreshAccessToken } from '../services/googleAuth';
import { appendRowToSheet } from '../services/googleSheets';

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

// A session's "sets" field is an array of { weight, reps } -- one entry
// per set, independently editable. Returns the exercise merged with any
// locally-saved state (falls back to the defaults in routines.js on first
// run), migrating any older history shapes along the way.
export async function getExerciseState(exercise) {
  const raw = await AsyncStorage.getItem(KEYS.EXERCISE_PREFIX + exercise.exerciseId);
  if (!raw) {
    return { ...exercise };
  }
  const saved = JSON.parse(raw);
  const migratedHistory = (saved.history || []).map((h) => migrateHistoryEntry(h));
  return { ...exercise, ...saved, history: migratedHistory };
}

// Handles all three history shapes this app has used over time:
//  1. newest:  { date, sets: [{ weight, reps }, ...] }
//  2. middle:  { date, reps, sets: [weightNumber, ...] }
//  3. oldest:  { date, weight, reps }
function migrateHistoryEntry(h) {
  if (Array.isArray(h.sets) && h.sets.length > 0 && typeof h.sets[0] === 'object') {
    return h; // already current shape
  }
  if (Array.isArray(h.sets)) {
    return { date: h.date, sets: h.sets.map((w) => ({ weight: w || 0, reps: h.reps || 12 })) };
  }
  return { date: h.date, sets: [{ weight: h.weight || 0, reps: h.reps || 12 }] };
}

export async function getExercisesForRoutine(routine) {
  return Promise.all(routine.exercises.map((ex) => getExerciseState(ex)));
}

// Logs a new session for a weighted (non-checkbox) exercise.
// payload: { sets: [{ weight, reps }, ...] } -- one entry per set, in
// whatever order/count the user ended up with (extra sets allowed).
// Implements the 2-entry rolling FIFO queue described in the spec: when
// history is already length 2, the oldest entry (index 0) is exported
// before being dropped, then the new session is appended.
export async function logSession(exercise, payload) {
  if (exercise.logType === 'checkbox') {
    return logCheckboxComplete(exercise);
  }

  const current = await getExerciseState(exercise);
  const { sets } = payload;
  const topWeight = Math.max(...sets.map((s) => s.weight));
  const newEntry = { date: new Date().toISOString().slice(0, 10), sets };

  let history = [...(current.history || [])];

  if (history.length === 2) {
    const dropped = history[0];
    const droppedSets = dropped.sets || [];
    await exportSessionToSheets({
      routineName: exercise.routineName,
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.name,
      date: dropped.date,
      weight: droppedSets.length ? Math.max(...droppedSets.map((s) => s.weight)) : 0,
      sets: droppedSets,
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
// Two paths, tried in order:
//  1. Signed-in Google account (Settings > Google Sheets) -- writes directly
//     via the Sheets API using the stored OAuth token.
//  2. Manual webhook URL (Settings > advanced) -- unchanged from before,
//     useful as a fallback or if you'd rather not set up OAuth at all.
export async function exportSessionToSheets(payload) {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  const settings = raw ? JSON.parse(raw) : {};

  if (settings.googleSheetsSpreadsheetId) {
    try {
      const accessToken = await getFreshAccessToken();
      if (accessToken) {
        const range = settings.googleSheetsRange || 'Sheet1!A1';
        const row = [
          payload.date,
          payload.routineName || '',
          payload.exerciseName || '',
          payload.weight,
          (payload.sets || []).map((s) => `${s.weight}x${s.reps}`).join(', '),
        ];
        await appendRowToSheet({
          accessToken,
          spreadsheetId: settings.googleSheetsSpreadsheetId,
          range,
          values: row,
        });
        return { ok: true };
      }
    } catch (e) {
      console.log('[Sheets export] Google Sheets API failed, falling back to webhook:', e.message);
    }
  }

  const url = settings.sheetsWebhookUrl;
  if (!url) {
    console.log('[export stub] no Sheets connection set up yet, would send:', payload);
    return { ok: true, stub: true };
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { ok: res.status === 200 };
}
