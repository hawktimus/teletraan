// The photos that come from a Google Drive folder. computer/scripts/photos-drive-sync.sh copies the
// pictures to data/live/photos/ and writes manifest.json next to them. This turns the manifest into
// photos like the ones from Studio, and mixes the two lists as the Photo source setting says. Nothing
// here touches the page, so the tests can run it. A manifest that is missing or broken gives no
// photos and never an error, so the Photo panel is never taken down by the Drive side.

import { liveFolder, sampleFolder, photoSources, defaultSettings } from '../config.js';

// The same limits as the script and as the Photo document in Studio
const mostPhotos = 200;
const captionLimit = 36;
const creditLimit = 14;
const filePattern = /^[A-Za-z0-9_-]{1,100}\.(jpg|png|webp|gif|avif)$/;
const creditPattern = /^[A-Za-z][A-Za-z-]*$/;

// The source of the settings: upload when it is missing or not one of the three
export function photoSourceOf(settings) {
  const source = settings && settings.photoSource;
  return photoSources.includes(source) ? source : defaultSettings.photoSource;
}

export function usesDrive(settings) {
  return photoSourceOf(settings) !== 'upload';
}

export function usesUpload(settings) {
  return photoSourceOf(settings) !== 'drive';
}

// The folder of the manifest and the pictures, with the slash at the end. The sample content has its own.
export function drivePhotosFolder(sample) {
  return (sample ? sampleFolder : liveFolder) + 'photos/';
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// The photos of a manifest.json, as the Photo panel takes them: { id, address, caption, credit,
// createdAt, show }. The address carries the change time, so a picture that was replaced under the
// same name is not taken from the browser's copy. An entry that cannot be used is left out, and a
// manifest that says ok: false, or is not a manifest, gives none.
export function drivePhotosFrom(manifest, folder) {
  if (!manifest || typeof manifest !== 'object' || manifest.ok !== true || !Array.isArray(manifest.photos)) return [];

  return manifest.photos
    .filter(entry => entry && typeof entry === 'object' && typeof entry.file === 'string' && filePattern.test(entry.file))
    .slice(0, mostPhotos)
    .map(entry => {
      const modified = text(entry.modified);
      const credit = text(entry.credit);
      return {
        id: 'drive-' + entry.file,
        address: folder + encodeURIComponent(entry.file) + (modified ? '?v=' + encodeURIComponent(modified) : ''),
        caption: text(entry.caption).slice(0, captionLimit),
        credit: credit.length <= creditLimit && creditPattern.test(credit) ? credit : '',
        createdAt: modified,
        show: true,
      };
    });
}

// The photos for the content: the Studio photos, the Drive photos or both. A source that is not
// asked for contributes nothing. With the source Google Drive alone and no Drive photo, the list is
// empty and the panel is left out of the rotation, like a panel with no photos.
export function mixPhotos(studioPhotos, drivePhotos, settings) {
  const studio = Array.isArray(studioPhotos) ? studioPhotos : [];
  const drive = Array.isArray(drivePhotos) ? drivePhotos : [];
  const parts = [];
  if (usesUpload(settings)) parts.push(studio);
  if (usesDrive(settings)) parts.push(drive);
  return [].concat(...parts);
}

// Reads the manifest. Gives { photos } when it was read (an empty list when there is no manifest yet),
// and null when the read failed, so the caller keeps the photos it had. fetchFunction is fetch.
export async function readDrivePhotos(fetchFunction, sample, seconds = 15) {
  const folder = drivePhotosFolder(sample);
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), seconds * 1000) : null;

  try {
    const answer = await fetchFunction(folder + 'manifest.json', { cache: 'no-store', signal: controller ? controller.signal : undefined });
    if (answer.status === 404) return { photos: [] };
    if (!answer.ok) return null;
    let manifest = null;
    try {
      manifest = await answer.json();
    } catch (error) {
      return { photos: [] };
    }
    return { photos: drivePhotosFrom(manifest, folder) };
  } catch (error) {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
