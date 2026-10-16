// Loads every other file in this folder, in alphabetical order, and lets each one add its routes.
// A new route file needs no change anywhere else.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export async function register(router, ctx) {
  const files = fs.readdirSync(here).filter(name => name.endsWith('.js') && name !== 'index.js').sort();
  for (const name of files) {
    const loaded = await import(pathToFileURL(path.join(here, name)).href);
    if (typeof loaded.register === 'function') await loaded.register(router, ctx);
  }
  return files;
}
