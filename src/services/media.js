import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { newId } from '../storage/plans';

// Machine photos and exercise videos people add to their plans. Files live in
// <documents>/media and exercises store their file:// URI (photoUri,
// videoUri).

const PHOTO_MAX_WIDTH = 800; // plenty for a thumbnail and a full-screen view
const MAX_VIDEO_MB = 150;
const MAX_RECORDING_SECONDS = 60;

function mediaDir() {
  const dir = new Directory(Paths.document, 'media');
  if (!dir.exists) dir.create();
  return dir;
}

// The picker hands back a file in the app's cache, which Android can clear
// whenever it likes, so keep our own copy.
function keepCopy(uri, extension) {
  const dest = new File(mediaDir(), `${newId('media')}.${extension}`);
  new File(uri).copy(dest);
  return dest.uri;
}

async function pick(source, options) {
  if (source === 'camera') {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      throw new Error('Camera access is turned off for this app. You can allow it in your phone settings.');
    }
    const result = await ImagePicker.launchCameraAsync(options);
    return result.canceled ? null : result.assets[0];
  }
  const result = await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : result.assets[0];
}

// Takes or chooses a photo (source: 'camera' | 'library'), crops it square,
// shrinks it and saves it. Returns its URI, or null if cancelled.
export async function pickPhoto(source) {
  const asset = await pick(source, {
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (!asset) return null;
  const width = Math.min(asset.width || PHOTO_MAX_WIDTH, PHOTO_MAX_WIDTH);
  const image = await ImageManipulator.manipulate(asset.uri).resize({ width }).renderAsync();
  const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return keepCopy(saved.uri, 'jpg');
}

// Records or chooses a video (source: 'camera' | 'library') and saves it.
// Returns its URI, or null if cancelled.
export async function pickVideo(source) {
  const asset = await pick(source, {
    mediaTypes: 'videos',
    videoMaxDuration: MAX_RECORDING_SECONDS,
  });
  if (!asset) return null;
  const sizeMb = (asset.fileSize || 0) / (1024 * 1024);
  if (sizeMb > MAX_VIDEO_MB) {
    throw new Error(
      `That video is ${Math.round(sizeMb)} MB. Pick a shorter clip (under ${MAX_VIDEO_MB} MB) so it doesn't fill up your phone.`
    );
  }
  const extension = (asset.uri.split('.').pop() || 'mp4').toLowerCase();
  return keepCopy(asset.uri, extension);
}

// Deletes saved media that no plan uses any more (replaced, removed, or
// their plan was deleted). Compares file names, since the same file can be
// written as file:/ or file:/// depending on where the URI came from.
export function cleanUnusedMedia(plans) {
  const dir = new Directory(Paths.document, 'media');
  if (!dir.exists) return;
  const fileName = (uri) => uri.split('/').pop();
  const used = new Set(
    plans
      .flatMap((p) => p.days.flatMap((d) => d.exercises.flatMap((ex) => [ex.photoUri, ex.videoUri])))
      .filter(Boolean)
      .map(fileName)
  );
  for (const item of dir.list()) {
    if (item instanceof File && !used.has(fileName(item.uri))) item.delete();
  }
}
