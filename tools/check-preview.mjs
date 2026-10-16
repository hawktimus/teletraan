// Checks the panel preview is in step with the rest (docs/monday.md, "Preview"):
//   - every registry id that studio/inputs/preview-panels.js lists is in dashboard/registry.js. An id that is
//     missing is named, because lane work that adds the panel may not be merged yet
//   - studio/package.json copies the dashboard before sanity build, deploy and dev
//   - the copy is ignored by git and no file of it is committed inside studio/
//
//   node tools/check-preview.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const problems = [];

const { panels } = await import(pathToFileURL(path.join(root, 'dashboard', 'registry.js')).href);
const { previewPanels, previewRegistryIds } = await import(pathToFileURL(path.join(root, 'studio', 'inputs', 'preview-panels.js')).href);

const registered = panels.map(panel => panel.id);
const missing = previewRegistryIds(previewPanels).filter(id => !registered.includes(id));
missing.forEach(id => problems.push('the preview lists "' + id + '", which dashboard/registry.js does not have'));
previewPanels.forEach(item => {
  const entry = panels.find(panel => panel.id === item.panel);
  if (entry && entry.region !== 'grid1') problems.push('"' + item.panel + '" should be a large panel (grid1) in dashboard/registry.js');
});

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'studio', 'package.json'), 'utf8'));
['prebuild', 'predeploy', 'predev'].forEach(name => {
  const script = manifest.scripts && manifest.scripts[name];
  if (script !== 'node scripts/copy-dashboard.mjs') problems.push('studio/package.json should run node scripts/copy-dashboard.mjs as ' + name);
});
if (!fs.existsSync(path.join(root, 'studio', 'scripts', 'copy-dashboard.mjs'))) problems.push('studio/scripts/copy-dashboard.mjs is missing');

const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8').split('\n').map(line => line.trim());
if (!ignore.includes('studio/static/dashboard/')) problems.push('.gitignore should list studio/static/dashboard/');

try {
  const tracked = execFileSync('git', ['ls-files', 'studio/static'], { cwd: root, encoding: 'utf8' }).trim();
  if (tracked !== '') problems.push('the dashboard copy is committed inside studio/static: ' + tracked.split('\n').slice(0, 3).join(', '));
} catch (error) {
  console.log('Note: git could not be asked which files studio/static holds.');
}

if (problems.length === 0) {
  console.log('PASS  the panel preview matches dashboard/registry.js, the copy step is in package.json and the copy is not committed');
  process.exit(0);
}

console.log('FAIL  the panel preview');
problems.forEach(problem => console.log('        ' + problem));
if (missing.length > 0) console.log('        Missing from the registry: ' + missing.join(', '));
process.exit(1);
