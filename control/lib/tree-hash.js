// The tree hash of a folder on the Mini. The rules and the text that is hashed are in
// control/static/tree-hash.js, which the page runs too, and tests/control-tree-hash.test.mjs checks that the
// two give the same answer for the same folder.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { canonicalText, isExcluded, isHashed } from '../static/tree-hash.js';

// Every regular file under a folder as relative paths with /, skipping excluded names. Symbolic links are not followed.
export function listFiles(root, base = '') {
  const found = [];
  for (const entry of fs.readdirSync(path.join(root, base), { withFileTypes: true })) {
    const relative = base ? base + '/' + entry.name : entry.name;
    if (isExcluded(relative)) continue;
    if (entry.isDirectory()) found.push(...listFiles(root, relative));
    else if (entry.isFile()) found.push(relative);
  }
  return found;
}

export function treeHash(root) {
  const entries = [];
  for (const relative of listFiles(root)) {
    if (!isHashed(relative)) continue;
    const bytes = fs.readFileSync(path.join(root, relative));
    entries.push({ path: relative, size: bytes.length, hash: crypto.createHash('sha256').update(bytes).digest('hex') });
  }
  return crypto.createHash('sha256').update(canonicalText(entries)).digest('hex');
}
