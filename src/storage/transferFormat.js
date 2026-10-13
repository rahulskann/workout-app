import { newId } from './plans';
import { parseYouTubeUrl } from '../services/youtube';
import { LOG_TYPES } from '../data/defaultPlan';

// The two kinds of file the app writes and reads (the file I/O itself is in
// services/transfer.js):
//  - a shared plan: one plan's days and exercises, to send to someone else.
//    No IDs, history, photos or video files -- just the program and its
//    YouTube links.
//  - a backup: everything on the phone (plans, logged history, unsent Sheets
//    rows, settings, photos), for moving to a new phone. Recorded video files
//    are left out; they're far too big for a file you email around.

export const FILE_APP = 'workout-cycle';
export const FORMAT_VERSION = 1;
const MAX_SETS = 10;
const MAX_TEXT = 120;

export class TransferError extends Error {}

// ---------- Shared plans ----------

export function planToShareFile(plan, now = new Date()) {
  return {
    app: FILE_APP,
    kind: 'plan',
    version: FORMAT_VERSION,
    exportedAt: now.toISOString(),
    plan: {
      name: plan.name,
      days: plan.days.map((day) => ({
        name: day.name,
        exercises: day.exercises.map((ex) => ({
          name: ex.name,
          targetGroup: ex.targetGroup || '',
          targetSets: ex.targetSets,
          logType: ex.logType,
          ...(ex.videoUrl ? { videoUrl: ex.videoUrl } : {}),
        })),
      })),
    },
  };
}

// Turns a shared plan file back into a plan with brand-new IDs, so the same
// file imported twice gives two separate plans and nothing collides with
// history already on the phone. Throws a TransferError with a readable
// message for anything that isn't a usable plan file.
export function planFromShareFile(data, existingNames = []) {
  checkHeader(data, 'plan');
  const source = data.plan;
  if (!source || !Array.isArray(source.days)) {
    throw new TransferError('This plan file is damaged and can\'t be opened.');
  }
  return {
    id: newId('plan'),
    name: uniqueName(cleanText(source.name) || 'Imported plan', existingNames),
    days: source.days.map((day, i) => ({
      id: newId('day'),
      name: cleanText(day?.name) || `Day ${i + 1}`,
      exercises: (Array.isArray(day?.exercises) ? day.exercises : [])
        .filter((ex) => cleanText(ex?.name))
        .map(importedExercise),
    })),
  };
}

function importedExercise(ex) {
  const logType = LOG_TYPES.includes(ex.logType) ? ex.logType : 'weights';
  const sets = Number.isInteger(ex.targetSets) ? Math.min(Math.max(ex.targetSets, 1), MAX_SETS) : 3;
  const videoUrl = typeof ex.videoUrl === 'string' && parseYouTubeUrl(ex.videoUrl) ? ex.videoUrl.trim() : null;
  return {
    exerciseId: newId('ex'),
    name: cleanText(ex.name),
    targetGroup: cleanText(ex.targetGroup),
    targetSets: sets,
    logType,
    videoUri: null,
    photoUri: null,
    videoUrl,
  };
}

// "Push Day" -> "Push Day (2)" if a plan with that name already exists.
function uniqueName(name, existingNames) {
  if (!existingNames.includes(name)) return name;
  let n = 2;
  while (existingNames.includes(`${name} (${n})`)) n += 1;
  return `${name} (${n})`;
}

// ---------- Backups ----------

const fileName = (uri) => uri.split('/').pop();

// photos: { fileName: base64 } for the photo files that were readable.
export function buildBackup({ planState, exercises, pendingExports, settings, photos }, now = new Date()) {
  const { googleAccountEmail, ...keptSettings } = settings || {};
  return {
    app: FILE_APP,
    kind: 'backup',
    version: FORMAT_VERSION,
    exportedAt: now.toISOString(),
    planState: {
      ...planState,
      plans: planState.plans.map((plan) =>
        mapExercises(plan, (ex) => ({
          ...ex,
          // Photos travel by file name; the paths are different on the new phone.
          photoUri: ex.photoUri && photos[fileName(ex.photoUri)] ? fileName(ex.photoUri) : null,
          videoUri: null,
        }))
      ),
    },
    exercises,
    pendingExports,
    settings: keptSettings,
    photos,
  };
}

// Checks a backup file and fills in anything optional that's missing.
export function parseBackup(data) {
  checkHeader(data, 'backup');
  const { planState, exercises } = data;
  if (!planState || !Array.isArray(planState.plans) || !exercises || typeof exercises !== 'object') {
    throw new TransferError('This backup file is damaged and can\'t be restored.');
  }
  return {
    exportedAt: data.exportedAt,
    planState: {
      plans: planState.plans,
      activePlanId: planState.activePlanId || null,
      progress: planState.progress || {},
    },
    exercises,
    pendingExports: Array.isArray(data.pendingExports) ? data.pendingExports : [],
    settings: data.settings && typeof data.settings === 'object' ? data.settings : {},
    photos: data.photos && typeof data.photos === 'object' ? data.photos : {},
  };
}

// After the photo files are written into mediaDirUri on this phone, points
// the restored exercises at them (by file name, as buildBackup stored them).
export function withPhotoPaths(planState, mediaDirUri, restoredFileNames) {
  const restored = new Set(restoredFileNames);
  const base = mediaDirUri.endsWith('/') ? mediaDirUri : `${mediaDirUri}/`;
  return {
    ...planState,
    plans: planState.plans.map((plan) =>
      mapExercises(plan, (ex) => ({
        ...ex,
        photoUri: ex.photoUri && restored.has(ex.photoUri) ? `${base}${ex.photoUri}` : null,
      }))
    ),
  };
}

export function summarizeBackup(backup) {
  return {
    exportedAt: backup.exportedAt,
    planCount: backup.planState.plans.length,
    loggedExercises: Object.values(backup.exercises).filter((s) => s?.history?.length).length,
    photoCount: Object.keys(backup.photos).length,
  };
}

// Photo file names come from the backup file, so only plain names are
// written -- never anything like "../" that could land outside the folder.
export function isSafeFileName(name) {
  return /^[A-Za-z0-9_.-]+$/.test(name) && !name.startsWith('.');
}

// ---------- Shared ----------

function checkHeader(data, kind) {
  if (!data || typeof data !== 'object' || data.app !== FILE_APP) {
    throw new TransferError("That file isn't a plan or backup from this app.");
  }
  if (data.kind !== kind) {
    throw new TransferError(
      data.kind === 'backup'
        ? 'That file is a full backup, not a single plan. Use "Restore from backup" in Settings instead.'
        : 'That file is a single plan, not a backup. Use "Import a plan" on the Plans screen instead.'
    );
  }
  if (typeof data.version !== 'number' || data.version > FORMAT_VERSION) {
    throw new TransferError('That file was made by a newer version of the app. Update the app, then try again.');
  }
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_TEXT) : '';
}

function mapExercises(plan, fn) {
  return {
    ...plan,
    days: plan.days.map((day) => ({ ...day, exercises: day.exercises.map(fn) })),
  };
}
