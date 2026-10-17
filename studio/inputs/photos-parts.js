// The words and the plain rules of the Photos page (photos-view.js). It has no React and no Sanity
// import, so tests/photos-page.test.mjs can run it with node.

import { driveFolderId } from '../schemas/driveFolder.js';
import { ageText } from './time-text.js';

export const settingsId = 'dashboardSettings';
export const draftId = 'drafts.dashboardSettings';

// The id the list of photos opens under (structure.js)
export const photosChild = 'photoList';

// The values are the names in photoSources in dashboard/config.js
export const sources = [
  { value: 'upload', title: 'Upload photos', help: 'Pick photos on this computer and add them here. Good for a few photos.' },
  { value: 'drive', title: 'Google Drive folder', help: 'The Teletraan computer copies the pictures of one shared Google Drive folder. Good for a whole event.' },
  { value: 'both', title: 'Both', help: 'The photos uploaded here and the pictures of the folder play together.' },
];

export const words = {
  heading: 'Photos',
  help: 'The Photo panel plays pictures from the places you pick below. Each photo fills the panel, one at a time.',
  choose: 'Where do the photos come from?',
  saved: 'Saved as a draft. Click Publish all in the top bar.',
  problem: 'The change was not saved. ',
  notPublished: 'Dashboard Settings has not been published yet. Open it, click Publish once, and come back.',
  reading: 'Reading Dashboard Settings.',
  uploadHeading: 'Upload photos',
  uploadHelp: 'Pick as many pictures as you like. Each one becomes a photo with no caption and no credit, switched on. Add a caption or move the focus point in the list afterwards. Then click Publish all in the top bar.',
  creditLabel: 'Credit for all of them (optional)',
  creditHelp: 'The first name of the person who took them, with no last name. Up to 14 characters.',
  expiresLabel: 'Hide after (optional)',
  expiresHelp: 'After this date and time the photos hide themselves. Leave it empty to keep them showing.',
  pickLabel: 'Choose pictures',
  listLink: 'Open the list of photos',
  listHelp: 'There you can change a caption, a credit, the fit, the focus point or the switch of one photo, or delete it.',
  driveHeading: 'Google Drive folder',
  driveHelp: 'Share the folder with Anyone with the link as Viewer, then paste its link here. The Teletraan computer copies the pictures about every 15 minutes after you click Publish all. It needs the Google key on the control page, Keys tab. The guide Photos from Google Drive has the steps.',
  folderLabel: 'Folder link',
  folderSave: 'Save folder',
  folderNameHelp: 'A file named Firstname - caption.jpg shows that first name as the credit and the caption on the photo. Any other name shows no text.',
  folderCountOnly: 'This page shows how many pictures the Teletraan computer found, not their names. Studio cannot reach the computer, and file names can hold last names.',
};

// The reason a first name is not good, or '' when it is. The same rules as the Credit field of a photo.
export function creditProblem(text) {
  const value = String(text || '');
  if (value.length > 14) return 'Too long. Up to 14 characters fit.';
  if (/[\s\d]/.test(value)) return 'Use a first name only, with no spaces or numbers.';
  return '';
}

const kinds = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const mostBytes = 25 * 1024 * 1024;

// Why a file cannot be a photo, or '' when it can. A picture the TV could not draw is refused here, not on the wall.
export function fileProblem(file) {
  const name = file && file.name ? file.name : 'A file';
  if (!file || !kinds.includes(file.type)) return name + ' is not a JPEG, PNG, WebP or GIF picture, so it was skipped.';
  if (file.size > mostBytes) return name + ' is bigger than 25 MB, so it was skipped. Make it smaller and add it again.';
  return '';
}

// The photo document that one uploaded picture becomes: a draft, switched on, with no caption. credit
// and expires are empty or set for the whole batch.
export function photoDraft(id, assetId, options) {
  const photo = {
    _id: 'drafts.' + id,
    _type: 'photo',
    image: { _type: 'image', asset: { _type: 'reference', _ref: assetId } },
    show: true,
    fit: 'setting',
  };
  const settings = options || {};
  if (settings.credit) photo.credit = settings.credit;
  if (settings.expires) photo.expires = settings.expires;
  return photo;
}

// The line after a batch: how many were added and which were not
export function uploadSummary(added, problems) {
  const lines = [];
  if (added > 0) lines.push(added === 1 ? '1 photo was added as a draft. Click Publish all in the top bar.' : added + ' photos were added as drafts. Click Publish all in the top bar.');
  return lines.concat(problems);
}

// The source and the folder to show, from the documents found (the draft first, then the published one). null when there
// is neither document.
export function settingsFrom(documents) {
  const found = Array.isArray(documents) ? documents : [];
  const source = found.filter(doc => doc && doc._id === draftId)[0] || found.filter(doc => doc && doc._id === settingsId)[0];
  if (!source) return null;
  return {
    source: sources.some(item => item.value === source.photoSource) ? source.photoSource : 'upload',
    folder: typeof source.photoDriveFolder === 'string' ? source.photoDriveFolder : '',
  };
}

// The folder typed, checked: { ok, id, problem }. Empty is fine and means no folder yet.
export function folderCheck(text) {
  const value = String(text || '').trim();
  if (value === '') return { ok: true, id: '', problem: '' };
  if (value.length > 200) return { ok: false, id: '', problem: 'Too long. Up to 200 characters.' };
  const id = driveFolderId(value);
  if (!id) return { ok: false, id: '', problem: 'That is not a Google Drive folder link. It starts with https://drive.google.com/drive/folders/, or paste just the id.' };
  return { ok: true, id: id, problem: '' };
}

// What the Drive section says about the last read of the folder. status is the published status document
// (photosDriveAt, photosDriveCount, photosDriveState), or null when none was read. now is a Date.
export function driveStatusLine(status, folder, now) {
  if (!folderCheck(folder).id) return 'No folder is named yet. Paste the folder link above and click Save folder.';
  if (!status || !status.photosDriveAt) return 'The Teletraan computer has not read the folder yet. After you click Publish all it reads the folder within 15 minutes.';

  const when = ageText(status.photosDriveAt, now);
  switch (status.photosDriveState) {
    case 'ok': {
      const count = Number(status.photosDriveCount) || 0;
      return 'Last read ' + when + ', ' + count + (count === 1 ? ' photo.' : ' photos.');
    }
    case 'no-key':
      return 'The Teletraan computer has no Google key yet. Add GOOGLE_API_KEY on the control page, Keys tab.';
    case 'bad-key':
      return 'Google did not accept the key. Check GOOGLE_API_KEY on the control page, Keys tab.';
    case 'api-off':
      return 'The Google Drive API is not turned on for the project of the key. Turn it on in the Google Cloud console (step 2 of the guide Photos from Google Drive).';
    case 'not-shared':
      return 'Google would not open the folder. Share it with Anyone with the link as Viewer, and check the link above.';
    case 'no-folder':
      return 'The Teletraan computer has not seen the folder yet. Click Publish all, and it reads the folder within 15 minutes.';
    case 'off':
      return 'The last read (' + when + ') happened while the source was Upload photos. Click Publish all, and it reads the folder within 15 minutes.';
    default:
      return 'Last read ' + when + '.';
  }
}
