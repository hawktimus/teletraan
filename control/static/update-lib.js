// The parts of the Update tab that need no page: reading the git head of a picked folder, naming the folder
// against the releases on the Teletraan computer, and the "v14 · a1b2c3d" label. The tests run this file in Node.

import { isExcluded } from './tree-hash.js';

export const zipLimit = 100 * 1024 * 1024;

export function shortCommit(commit) {
  const text = String(commit || '').trim().toLowerCase();
  return /^[0-9a-f]{4,40}$/.test(text) ? text.slice(0, 7) : '';
}

// "v14 · a1b2c3d". The same text as dashboard/core/version-label.js.
export function versionLabel(version, commit) {
  const short = shortCommit(commit);
  const count = Number(version);
  const number = Number.isInteger(count) && count > 0 ? 'v' + count : version === '?' ? 'v?' : '';
  return [number, short].filter(Boolean).join(' · ');
}

// Files of a picked folder as [{ path, file }] with the folder's own name taken off the front
export function folderFiles(fileList) {
  const files = [];
  for (const file of fileList) {
    const full = file.webkitRelativePath || file.name;
    const slash = full.indexOf('/');
    files.push({ path: slash >= 0 ? full.slice(slash + 1) : full, file: file });
  }
  return files;
}

export function folderName(fileList) {
  const first = fileList[0];
  const full = first ? first.webkitRelativePath || '' : '';
  return full.includes('/') ? full.split('/')[0] : '';
}

// The commit the folder is on, from .git/HEAD and the ref it names. '' when there is no .git or no answer.
export async function readCommit(files) {
  const find = path => files.find(item => item.path === path);
  const head = find('.git/HEAD');
  if (!head) return '';
  const text = (await head.file.text()).trim();
  if (/^[0-9a-f]{40}$/.test(text)) return text;
  const ref = /^ref:\s*(\S+)$/.exec(text);
  if (!ref) return '';
  const loose = find('.git/' + ref[1]);
  if (loose) {
    const value = (await loose.file.text()).trim();
    if (/^[0-9a-f]{40}$/.test(value)) return value;
  }
  const packed = find('.git/packed-refs');
  if (packed) {
    for (const line of (await packed.file.text()).split('\n')) {
      const parts = line.trim().split(' ');
      if (parts[1] === ref[1] && /^[0-9a-f]{40}$/.test(parts[0])) return parts[0];
    }
  }
  return '';
}

// What to say about the folder. releases are the kept releases from the Teletraan computer (with treeHash and commit).
// Returns { text, same } where same is true when the folder is exactly what is on the wall.
export function describeFolder(releases, hash, commit) {
  const live = releases.find(release => release.current);
  const same = Boolean(live && live.treeHash && live.treeHash === hash);
  const identical = releases.find(release => release.treeHash && release.treeHash === hash);
  const short = shortCommit(commit);
  if (identical) return { text: 'Your folder: ' + versionLabel(identical.version, identical.commit) + (same ? ' · same as the wall' : ''), same: same };
  if (!short) return { text: 'Your folder: v? · commit unknown', same: false };
  const stored = releases.find(release => shortCommit(release.commit) === short);
  if (stored) return { text: 'Your folder: ' + versionLabel(stored.version, short) + ' · uncommitted changes', same: false };
  return { text: 'Your folder: ' + versionLabel('?', short) + ' · not on the wall yet', same: false };
}

// The files of a folder that go in the zip: every file that the rules do not leave out
export function zipCandidates(files) {
  return files.filter(item => item.path && !isExcluded(item.path));
}
