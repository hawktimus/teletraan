// The link of a Google Drive folder, or its id. computer/scripts/photos-drive-sync.sh reads the same
// two forms with the same pattern, so a link that passes here is one the Teletraan computer can use.
// It has no imports, so the Photos page and the tests can read it with node.

export const driveFolderLimit = 200;

// https://drive.google.com/drive/folders/<id>, the same with /u/0/ in it, either with ?usp=sharing or
// another tail, or the bare id
const pattern = /^(?:https:\/\/drive\.google\.com\/drive\/(?:u\/[0-9]+\/)?folders\/)?([A-Za-z0-9_-]{10,100})(?:[/?#].*)?$/;

// The folder id of what was typed, or '' when it is not a folder link or an id
export function driveFolderId(value) {
  const match = pattern.exec(String(value || '').trim());
  return match ? match[1] : '';
}

// The check for the field. An empty field is fine: it means no folder yet.
export function checkDriveFolder(value) {
  if (value === undefined || value === null || String(value).trim() === '') return true;
  if (String(value).length > driveFolderLimit) return 'Too long. Up to ' + driveFolderLimit + ' characters.';
  if (!driveFolderId(value)) return 'Paste the folder link from Google Drive. It starts with https://drive.google.com/drive/folders/, or paste just the id.';
  return true;
}
