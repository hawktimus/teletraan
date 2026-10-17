// The tree hash, for the browser and for the Teletraan computer. The computer's copy is control/lib/tree-hash.js, which imports
// the rules in this file, so the two cannot drift apart. The hash is the SHA-256 of one line for every file
// under dashboard/, studio/schemas/, computer/ and control/, sorted by path: path, size and the SHA-256 of the
// content, each followed by a line break. It is how the page tells whether the folder on this computer is
// the one on the wall.

import { sha256Hex as plainSha256Hex } from './sha256.js';

const hashRoots = ['dashboard/', 'studio/schemas/', 'computer/', 'control/'];

// Names left out at any depth, and the generated files left out by path. The same list decides what the page
// zips and what the Teletraan computer copies.
const skippedNames = ['.git', 'node_modules', '.DS_Store', '.env', '_inputs', '_outputs'];
const skippedPaths = ['dashboard/build.js', 'computer/build.txt', 'studio-dist', 'studio/static/dashboard', 'dashboard/data/live', 'RELEASE.json'];

export function isExcluded(path) {
  const parts = path.split('/');
  for (const part of parts) {
    if (skippedNames.includes(part)) return true;
    if (part === 'local.env' || part.startsWith('local.env.')) return true;
  }
  for (const skipped of skippedPaths) {
    if (path === skipped || path.startsWith(skipped + '/')) return true;
  }
  return false;
}

// A file that counts toward the hash: inside one of the four roots and not excluded
export function isHashed(path) {
  if (isExcluded(path)) return false;
  return hashRoots.some(root => path.startsWith(root));
}

// The text that is hashed, from [{ path, size, hash }]
export function canonicalText(entries) {
  const sorted = entries.slice().sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return sorted.map(entry => entry.path + '\0' + entry.size + '\0' + entry.hash + '\n').join('');
}

function hex(buffer) {
  return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');
}

// crypto.subtle exists only on secure pages (https or localhost). The control page is plain http, so the plain
// script version in sha256.js does the work there.
async function sha256Hex(bytes) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  return subtle ? hex(await subtle.digest('SHA-256', bytes)) : plainSha256Hex(bytes);
}

// files: [{ path, read }] where read() gives the bytes of the file (a Uint8Array or ArrayBuffer). Paths are
// relative to the top of the repository and use /. Files that do not count are not read.
export async function treeHashOfFiles(files) {
  const entries = [];
  for (const file of files) {
    if (!isHashed(file.path)) continue;
    const bytes = await file.read();
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    entries.push({ path: file.path, size: view.length, hash: await sha256Hex(view) });
  }
  return sha256Hex(new TextEncoder().encode(canonicalText(entries)));
}
