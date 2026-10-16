// Copies dashboard/ into studio/static/dashboard, so that the Studio serves the real screen at
// /dashboard/ on its own origin (the preview of the panels, docs/monday.md). npm runs it before
// sanity build and sanity deploy (predeploy and prebuild in package.json). The copy is ignored by git.
//
// The live folder is left out: it holds files the Teletraan computer makes, and the preview reads Sanity.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const skipped = ['data/live', 'node_modules'];

export function copyDashboard(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, {
    recursive: true,
    filter: source => {
      const relative = path.relative(from, source).split(path.sep).join('/');
      return !skipped.includes(relative);
    },
  });
  fs.mkdirSync(path.join(to, 'data', 'live'), { recursive: true });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const from = path.join(here, '..', '..', 'dashboard');
  const to = path.join(here, '..', 'static', 'dashboard');

  if (!fs.existsSync(path.join(from, 'index.html'))) {
    console.error('dashboard/index.html was not found next to studio/. Run this from a full copy of the repository.');
    process.exit(1);
  }
  copyDashboard(from, to);
  console.log('Copied dashboard/ to studio/static/dashboard');
}
