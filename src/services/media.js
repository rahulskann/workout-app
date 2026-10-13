import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { newId } from '../storage/plans';

// Machine photos and exercise videos people add to their plans. Files live in
// <documents>/media and exercises store their file:// URI (photoUri,
// videoUri).

const PHOTO_MAX_WIDTH = 800; // plenty for a thumbnail and a full-screen view
// Android records at whatever quality the camera app uses (about 130 MB a
// minute at 1080p), so a full 10 minutes can run past a gigabyte.
export const MAX_RECORDING_SECONDS = 10 * 60;
const LARGE_VIDEO_MB = 200; // ask before keeping anything bigger
const MAX_VIDEO_MB = 2048;

export function mediaDir() {
  const dir = new Directory(Paths.document, 'media');
  if (!dir.exists) dir.create();
  return dir;
}

// The picker hands back a file in the app's cache, which Android can clear
// whenever it likes, so move it into our own folder. A move on the same
// storage is instant even for a big video; copy only if moving isn't possible.
function keepFile(uri, extension) {
  const dest = new File(mediaDir(), `${newId('media')}.${extension}`);
  const source = new File(uri);
  try {
    source.move(dest);
  } catch (e) {
    source.copy(dest);
  }
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
  return keepFile(saved.uri, 'jpg');
}

// Records or chooses a video (source: 'camera' | 'library') and saves it.
// confirmLarge(sizeMb) is asked before keeping a big one and resolves to
// true to keep it. Returns the video's URI, or null if cancelled.
export async function pickVideo(source, confirmLarge) {
  const asset = await pick(source, {
    mediaTypes: 'videos',
    videoMaxDuration: MAX_RECORDING_SECONDS,
  });
  if (!asset) return null;
  const extension = (asset.uri.split('.').pop() || 'mp4').toLowerCase();
  const sizeMb = Math.round((asset.fileSize || 0) / (1024 * 1024));
  const discard = () => {
    try {
      new File(asset.uri).delete(); // don't leave a huge file sitting in the cache
    } catch (e) {
      // the system clears the cache eventually anyway
    }
    return null;
  };
  if (sizeMb > MAX_VIDEO_MB) {
    discard();
    throw new Error(
      `That video is ${sizeMb} MB, over the ${MAX_VIDEO_MB / 1024} GB limit. Try a shorter clip.`
    );
  }
  if (sizeMb > LARGE_VIDEO_MB && !(await confirmLarge(sizeMb))) return discard();
  return keepFile(asset.uri, extension);
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
