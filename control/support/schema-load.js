// Loads the Studio schema definitions in plain node, so the Control page can draw its forms from them. The schemas import
// 'sanity', and a few inputs they point at import 'react', so a scratch copy of the Studio's schemas, inputs and tools is made in a
// temporary folder with tiny stand-ins for those packages, the same idea as tests/helpers/studio-world.mjs. The copy is removed
// as soon as the modules are loaded. Nothing here talks to Sanity.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const copied = ['schemas', 'inputs', 'tools'];

// The real packages are never used. Each name a file imports from a package becomes an export of its stand-in.
const identities = ['defineType', 'defineField', 'defineArrayMember', 'defineConfig'];

function importedNames(folder) {
  const found = {};
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) {
        const text = fs.readFileSync(full, 'utf8');
        for (const match of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*'(sanity|sanity\/router|sanity\/structure|react)'/g)) {
          const list = found[match[2]] || (found[match[2]] = new Set());
          match[1].split(',').map(name => name.trim().split(/\s+as\s+/)[0]).filter(Boolean).forEach(name => list.add(name));
        }
      }
    }
  };
  walk(folder);
  return found;
}

function stubSource(names) {
  const lines = ['const nothing = () => null;'];
  identities.forEach(name => lines.push('export const ' + name + ' = value => value;'));
  names.filter(name => !identities.includes(name)).forEach(name => {
    if (name === 'createContext') lines.push('export const createContext = value => ({ current: value, Provider: null });');
    else if (name === 'createElement') lines.push('export const createElement = (type, props, ...children) => ({ type: type, props: props, children: children });');
    else lines.push('export const ' + name + ' = nothing;');
  });
  return lines.join('\n');
}

function writePackage(modules, packageName, source) {
  const folder = path.join(modules, packageName);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'package.json'), JSON.stringify({ name: packageName, type: 'module', exports: { '.': './index.js' } }));
  fs.writeFileSync(path.join(folder, 'index.js'), source);
}

// The schema types of the Studio in the folder that holds studio/ and dashboard/ (a release, or the repository).
// Gives { types, parts } and throws an Error with a plain reason when the folder has no Studio.
export async function loadSchemaTypes(root) {
  const studio = path.join(root, 'studio');
  if (!fs.existsSync(path.join(studio, 'schemas', 'index.js'))) throw new Error('This release has no studio/schemas folder.');

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-spec-'));
  try {
    const copy = path.join(scratch, 'studio');
    fs.mkdirSync(copy);
    copied.forEach(name => {
      const from = path.join(studio, name);
      if (fs.existsSync(from)) fs.cpSync(from, path.join(copy, name), { recursive: true, filter: source => !source.includes('node_modules') });
    });
    // The inputs read a few rules of the TV from ../dashboard, so the copy sits beside a link to it
    if (fs.existsSync(path.join(root, 'dashboard'))) fs.symlinkSync(path.join(root, 'dashboard'), path.join(scratch, 'dashboard'));
    fs.writeFileSync(path.join(copy, 'package.json'), JSON.stringify({ type: 'module' }));

    const modules = path.join(copy, 'node_modules');
    const names = importedNames(copy);
    writePackage(modules, 'react', stubSource(Array.from(names.react || [])));
    writePackage(modules, 'sanity', stubSource(Array.from(names.sanity || [])));
    // 'sanity/router' and 'sanity/structure' are subpaths of the one package, so the main stand-in routes them
    const sanityFolder = path.join(modules, 'sanity');
    fs.writeFileSync(path.join(sanityFolder, 'package.json'), JSON.stringify({
      name: 'sanity',
      type: 'module',
      exports: { '.': './index.js', './router': './router.js', './structure': './structure.js' },
    }));
    fs.writeFileSync(path.join(sanityFolder, 'router.js'), stubSource(Array.from(names['sanity/router'] || [])));
    fs.writeFileSync(path.join(sanityFolder, 'structure.js'), stubSource(Array.from(names['sanity/structure'] || [])));

    const loaded = await import(pathToFileURL(path.join(copy, 'schemas', 'index.js')).href);
    return { types: loaded.schemaTypes };
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}
