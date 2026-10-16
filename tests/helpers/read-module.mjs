// The text of a dashboard script, and of the parts it was split into. A script such as frame.js
// or plate.js that only re-exports from parts reads as one file here, so a test that looks for
// a line of code does not care which part holds it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function readModule(file, encoding) {
  const name = file instanceof URL ? fileURLToPath(file) : file;
  const text = fs.readFileSync(name, encoding);
  if (typeof text !== 'string' || typeof name !== 'string' || !name.endsWith('.js') || !name.includes(path.sep + 'dashboard' + path.sep)) return text;

  return [text].concat(partsOf(name).map(part => fs.readFileSync(part, encoding))).join('\n');
}

// The files whose first line says they are a part of this one: "(part of frame.js)"
function partsOf(name) {
  const folder = path.dirname(name);
  const marker = new RegExp('\\(part of (?:[\\w-]+/)?' + path.basename(name, '.js') + '\\.js\\)');
  const found = [];

  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const candidates = entry.isDirectory() && entry.name === 'art' ? fs.readdirSync(path.join(folder, entry.name)).map(inner => path.join(folder, entry.name, inner)) : [path.join(folder, entry.name)];
    for (const candidate of candidates) {
      if (candidate === name || !candidate.endsWith('.js') || !fs.statSync(candidate).isFile()) continue;
      if (marker.test(fs.readFileSync(candidate, 'utf8').split('\n', 1)[0])) found.push(candidate);
    }
  }
  return found;
}

// True when every name is imported from the address, in one import line or several
export function hasImports(text, names, from) {
  const found = [];
  for (const match of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
    if (match[2] === from) match[1].split(',').forEach(name => found.push(name.trim().split(/\s+as\s+/).pop()));
  }
  return names.every(name => found.includes(name));
}
