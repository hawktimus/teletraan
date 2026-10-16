// A fresh copy of a dashboard script that was split into parts (frame.js and frame-*.js, for
// example), so a test gets state of its own each time. The copies are written beside the
// originals with a number in their names and import each other, and the original files for
// everything else. The folder must be a scratch copy of the dashboard, never the real one.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let copies = 0;

export async function importFresh(entry) {
  const folder = path.dirname(entry);
  if (!fs.realpathSync(folder).startsWith(fs.realpathSync(os.tmpdir()))) throw new Error('importFresh writes beside the file, so it needs a scratch folder: ' + folder);

  const stem = path.basename(entry, '.js');
  const parts = fs.readdirSync(folder).filter(name => !name.includes('.fresh') && (name === stem + '.js' || name.startsWith(stem + '-')));
  const mark = '.fresh' + (copies += 1);

  for (const name of parts) {
    const text = fs.readFileSync(path.join(folder, name), 'utf8').replace(/(from\s+)'(\.\/[^'/]+)\.js'/g, (whole, from, specifier) => {
      return parts.includes(specifier.slice(2) + '.js') ? from + "'" + specifier + mark + ".js'" : whole;
    });
    fs.writeFileSync(path.join(folder, name.replace(/\.js$/, mark + '.js')), text);
  }

  return import(pathToFileURL(path.join(folder, stem + mark + '.js')).href);
}
