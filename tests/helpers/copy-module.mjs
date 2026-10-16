// Copies a dashboard script to a test folder, with every script it imports, so a test that
// copies one module does not break when that module is split into parts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function copyModule(source, target) {
  const from = source instanceof URL ? fileURLToPath(source) : source;
  const to = target instanceof URL ? fileURLToPath(target) : target;
  fs.copyFileSync(from, to);
  if (!from.endsWith('.js') || !from.includes(path.sep + 'dashboard' + path.sep)) return;

  const text = fs.readFileSync(from, 'utf8');
  for (const match of text.matchAll(/(?:from|import)\s*\(?\s*'(\.{1,2}\/[^']+\.js)'/g)) {
    const found = path.resolve(path.dirname(from), match[1]);
    const copy = path.resolve(path.dirname(to), match[1]);
    if (fs.existsSync(copy) || !fs.existsSync(found)) continue;

    fs.mkdirSync(path.dirname(copy), { recursive: true });
    copyModule(found, copy);
  }
}
