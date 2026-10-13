import AsyncStorage from '@react-native-async-storage/async-storage';
import { SETTINGS_KEY } from '../constants/storageKeys';
import { getFreshAccessToken } from '../services/googleAuth';
import { appendRowToSheet } from '../services/googleSheets';

// Which day of the cycle you're on lives with the plans (storage/plans.js);
// this file only tracks per-exercise history and the Sheets export queue.
const KEYS = {
  EXERCISE_PREFIX: 'workout:exercise:', // + exerciseId
  PENDING_EXPORTS: 'workout:pendingExports',
};

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
// history is already length 2, the oldest entry (index 0) is dropped and
// moved to the export queue, then the new session is appended. The new
// session is saved before any network call, so a failed or offline export
// can't lose it, and the dropped one stays queued until Sheets confirms it.
export async function logSession(exercise, payload) {
  if (exercise.logType === 'checkbox') {
    return logCheckboxComplete(exercise);
  }

  const current = await getExerciseState(exercise);
  const { sets } = payload;
  const topWeight = Math.max(...sets.map((s) => s.weight));
  const newEntry = { date: new Date().toISOString().slice(0, 10), sets };

  let history = [...(current.history || [])];
  let dropped = null;

  if (history.length === 2) {
    dropped = history[0];
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

  if (dropped) {
    const droppedSets = dropped.sets || [];
    await queueExport({
      id: `${exercise.exerciseId}:${dropped.date}:${Date.now()}`,
      routineName: exercise.routineName,
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.name,
      date: dropped.date,
      weight: droppedSets.length ? Math.max(...droppedSets.map((s) => s.weight)) : 0,
      sets: droppedSets,
    });
    flushPendingExports(); // fire-and-forget; anything unsent retries on next launch
  }

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
  return { ok: res.ok };
}

// ---------- Export queue ----------
// Sessions that rolled out of local history wait here until a destination
// confirms them, so going offline at the gym (or not having set up Sheets
// yet) never loses data. Every read-modify-write of the queue goes through
// withQueueLock so a flush finishing can't overwrite an item queued mid-flush.

let queueLock = Promise.resolve();

function withQueueLock(fn) {
  const run = queueLock.then(fn, fn);
  queueLock = run.catch(() => {});
  return run;
}

async function readPendingExports() {
  const raw = await AsyncStorage.getItem(KEYS.PENDING_EXPORTS);
  return raw ? JSON.parse(raw) : [];
}

function queueExport(payload) {
  return withQueueLock(async () => {
    const queue = await readPendingExports();
    queue.push(payload);
    await AsyncStorage.setItem(KEYS.PENDING_EXPORTS, JSON.stringify(queue));
  });
}

export function getPendingExports() {
  return withQueueLock(readPendingExports);
}

let flushing = null;

// Sends queued sessions oldest-first and stops at the first one that doesn't
// go through, so rows land in the sheet in order. Safe to call often:
// overlapping calls share the flush already in progress.
export function flushPendingExports() {
  if (!flushing) {
    flushing = doFlush()
      .catch(() => {})
      .finally(() => {
        flushing = null;
      });
  }
  return flushing;
}

async function doFlush() {
  const queue = await withQueueLock(readPendingExports);
  const sent = new Set();
  for (const payload of queue) {
    try {
      const res = await exportSessionToSheets(payload);
      if (!res.ok || res.stub) break; // rejected, or nowhere to send it yet
      sent.add(payload.id);
    } catch (e) {
      break; // offline -- try again later
    }
  }
  if (sent.size === 0) return;
  await withQueueLock(async () => {
    const latest = await readPendingExports();
    await AsyncStorage.setItem(
      KEYS.PENDING_EXPORTS,
      JSON.stringify(latest.filter((p) => !sent.has(p.id)))
    );
  });
}
