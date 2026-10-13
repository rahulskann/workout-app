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

// Saved per exercise: { history, maxWeight, today }.
//  - history: up to 2 finished sessions, each { date, sets: [{ weight, reps }] }
//  - today: what was ticked or logged during one visit of its day --
//      { visitId } for checkbox exercises, or
//      { visitId, date, sets, routineName } for weighted ones.
// Today's sets are a draft you can edit or undo while the day is active. They
// only move into history (and the Sheets queue) once that visit ends -- see
// commitDrafts -- so an undo never leaves a stray row in the sheet.
//
// Returns the exercise merged with its saved state. completedToday is only
// true for the visit passed in (the active day's current visit), so a day
// you've moved on from shows a clean checklist. Pass no visitId for a day
// you're only previewing.
export async function getExerciseState(exercise, visitId = null) {
  const raw = await AsyncStorage.getItem(KEYS.EXERCISE_PREFIX + exercise.exerciseId);
  return parseExerciseState(exercise, raw ? JSON.parse(raw) : {}, visitId);
}

function parseExerciseState(exercise, saved, visitId) {
  // saved.completedToday (from before visits) is ignored on purpose: those
  // ticks can't be tied to a visit, so they'd never clear.
  return {
    ...exercise,
    history: (saved.history || []).map((h) => migrateHistoryEntry(h)),
    maxWeight: saved.maxWeight || 0,
    today: saved.today || null,
    completedToday: visitId != null && saved.today?.visitId === visitId,
  };
}

async function saveExerciseState(exerciseId, { history, maxWeight, today }) {
  await AsyncStorage.setItem(
    KEYS.EXERCISE_PREFIX + exerciseId,
    JSON.stringify({ history, maxWeight, today })
  );
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

export async function getExercisesForRoutine(routine, visitId = null) {
  return Promise.all(routine.exercises.map((ex) => getExerciseState(ex, visitId)));
}

// Logs (or re-logs) today's sets for a weighted exercise during visitId, the
// active day's current visit (see storage/plans.js). payload:
// { sets: [{ weight, reps }, ...] } -- one entry per set, in whatever
// order/count the user ended up with (extra sets allowed). Logging again
// during the same visit replaces the earlier numbers.
export async function logSession(exercise, payload, visitId) {
  if (exercise.logType === 'checkbox') {
    return logCheckboxComplete(exercise, visitId);
  }

  let current = await getExerciseState(exercise, visitId);
  let queued = false;
  if (current.today && current.today.visitId !== visitId) {
    // A draft from a visit that never got committed (app closed mid-way):
    // finish it first rather than overwrite it.
    const { next, dropped } = finishDraft(current);
    if (dropped) {
      await queueExport(dropped);
      queued = true;
    }
    current = { ...current, ...next };
  }

  const today = { visitId, date: localDate(), sets: payload.sets, routineName: exercise.routineName };
  await saveExerciseState(exercise.exerciseId, { ...current, today });
  if (queued) flushPendingExports();
  return { ...current, today, completedToday: true };
}

// Checkbox-type exercises (warm-ups, cooldowns, mobility routines) just
// need a "done today" toggle -- no weight/rep tracking.
export async function logCheckboxComplete(exercise, visitId) {
  const current = await getExerciseState(exercise, visitId);
  const today = { visitId };
  await saveExerciseState(exercise.exerciseId, { ...current, today });
  return { ...current, today, completedToday: true };
}

// Undoes today's tick or logged sets, as long as the visit is still going.
export async function clearToday(exercise, visitId) {
  const current = await getExerciseState(exercise, visitId);
  if (!current.completedToday) return current;
  await saveExerciseState(exercise.exerciseId, { ...current, today: null });
  return { ...current, today: null, completedToday: false };
}

// Moves sessions logged during earlier visits into history, leaving
// keepVisitId's (the visit still in progress) alone. Call it whenever a
// visit ends, and at startup to catch anything left from a visit the app was
// closed in the middle of.
export async function commitDrafts(exercises, keepVisitId) {
  const rows = await AsyncStorage.multiGet(
    exercises.map((ex) => KEYS.EXERCISE_PREFIX + ex.exerciseId)
  );
  for (let i = 0; i < exercises.length; i++) {
    const raw = rows[i][1];
    if (!raw) continue;
    const state = parseExerciseState(exercises[i], JSON.parse(raw), keepVisitId);
    if (!state.today || state.today.visitId === keepVisitId) continue;
    const { next, dropped } = finishDraft(state);
    // Queue before saving: if the app dies in between, the worst case is a
    // duplicate row in the sheet rather than a lost session.
    if (dropped) await queueExport(dropped);
    await saveExerciseState(exercises[i].exerciseId, next);
  }
  flushPendingExports();
}

// The 2-entry rolling FIFO from the spec: today's draft is appended to
// history, and once history is full the oldest session is dropped and
// returned as an export payload (the queue keeps it until Sheets confirms).
function finishDraft(state) {
  const { today } = state;
  if (!today?.sets?.length) {
    return { next: { history: state.history, maxWeight: state.maxWeight, today: null }, dropped: null };
  }
  const entry = { date: today.date, sets: today.sets };
  let history = [...state.history];
  let droppedEntry = null;
  if (history.length >= 2) {
    droppedEntry = history[0];
    history = [...history.slice(1), entry];
  } else {
    history.push(entry);
  }
  const maxWeight = Math.max(state.maxWeight, ...today.sets.map((s) => s.weight));
  return {
    next: { history, maxWeight, today: null },
    dropped: droppedEntry && toExportPayload(state, droppedEntry, today.routineName),
  };
}

function toExportPayload(exercise, entry, routineName) {
  const sets = entry.sets || [];
  return {
    id: `${exercise.exerciseId}:${entry.date}:${Date.now()}`,
    routineName,
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.name,
    date: entry.date,
    weight: sets.length ? Math.max(...sets.map((s) => s.weight)) : 0,
    sets,
  };
}

// YYYY-MM-DD in the phone's timezone. (toISOString is UTC, which turns an
// evening workout in the US into tomorrow's date.)
function localDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
