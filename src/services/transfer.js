import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { SETTINGS_KEY } from '../constants/storageKeys';
import { loadPlanState, savePlanState } from '../storage/plans';
import {
  getAllExerciseStates,
  replaceAllExerciseStates,
  getPendingExports,
  replacePendingExports,
} from '../storage/storage';
import {
  TransferError,
  planToShareFile,
  buildBackup,
  withPhotoPaths,
  isSafeFileName,
} from '../storage/transferFormat';
import { mediaDir } from './media';

// Reading and writing plan/backup files (formats in storage/transferFormat.js).
// Files are handed to Android's share sheet, so they can go to WhatsApp,
// email, Drive, Files, etc.; importing goes through the system file picker.

const MAX_IMPORT_MB = 200;

function exportDir() {
  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) dir.create();
  return dir;
}

function writeExport(name, data) {
  const file = new File(exportDir(), name);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(data));
  return file;
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plan';
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function share(file, dialogTitle) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new TransferError("Sharing isn't available on this phone.");
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle });
}

export async function sharePlan(plan) {
  const file = writeExport(`${slug(plan.name)}.plan.json`, planToShareFile(plan));
  await share(file, `Share ${plan.name}`);
}

// Asks for a file and returns its contents parsed as JSON, or null if the
// picker was cancelled.
export async function pickJsonFile() {
  const result = await DocumentPicker.getDocumentAsync({
    // Apps like WhatsApp often label .json files as plain binary, so accept
    // anything and check the contents instead.
    type: '*/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if ((asset.size || 0) > MAX_IMPORT_MB * 1024 * 1024) {
    throw new TransferError("That file is too big to be a plan or backup from this app.");
  }
  const text = await new File(asset.uri).text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new TransferError("That file isn't a plan or backup from this app.");
  }
}

// Saves everything into one file and opens the share sheet so it can be
// put somewhere safe (Drive, email to yourself, a computer).
export async function backUpEverything() {
  const [planState, exercises, pendingExports, rawSettings] = await Promise.all([
    loadPlanState(),
    getAllExerciseStates(),
    getPendingExports(),
    AsyncStorage.getItem(SETTINGS_KEY),
  ]);

  const photos = {};
  for (const plan of planState.plans) {
    for (const day of plan.days) {
      for (const ex of day.exercises) {
        if (!ex.photoUri) continue;
        const name = ex.photoUri.split('/').pop();
        const file = new File(ex.photoUri);
        if (photos[name] || !file.exists) continue;
        photos[name] = await file.base64();
      }
    }
  }

  const backup = buildBackup({
    planState,
    exercises,
    pendingExports,
    settings: rawSettings ? JSON.parse(rawSettings) : {},
    photos,
  });
  const file = writeExport(`splitcycle-backup-${today()}.json`, backup);
  await share(file, 'Save your backup');
}

// Replaces everything on this phone with a parsed backup (see parseBackup).
// The caller reloads the plan and settings contexts afterwards.
export async function restoreBackup(backup) {
  const dir = mediaDir();
  const restored = [];
  for (const [name, base64] of Object.entries(backup.photos)) {
    if (!isSafeFileName(name) || typeof base64 !== 'string') continue;
    const file = new File(dir, name);
    if (!file.exists) file.create();
    file.write(base64, { encoding: 'base64' });
    restored.push(name);
  }

  await savePlanState(withPhotoPaths(backup.planState, dir.uri, restored));
  await replaceAllExerciseStates(backup.exercises);
  await replacePendingExports(backup.pendingExports);
  // Signing in to Google happens again on the new phone, so don't carry over
  // the account name as if it were still signed in.
  await AsyncStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ ...backup.settings, googleAccountEmail: '' })
  );
}
