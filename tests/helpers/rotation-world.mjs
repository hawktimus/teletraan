// A copy of the Rotation board files in a temporary folder, with stand-ins for React and Sanity, so the tests can draw the
// board with node and read the elements back. It gives back the loaded modules and a few readers.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = fileURLToPath(new URL('../..', import.meta.url));

export async function rotationWorld() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-rotation-world-'));
  process.on('exit', () => fs.rmSync(work, { recursive: true, force: true }));

  fs.cpSync(path.join(root, 'studio', 'tools'), path.join(work, 'tools'), { recursive: true });
  fs.mkdirSync(path.join(work, 'inputs'));
  fs.readdirSync(path.join(root, 'studio', 'inputs')).filter(file => /^(screen-panels|rotation-.*)\.js$/.test(file))
    .forEach(file => fs.copyFileSync(path.join(root, 'studio', 'inputs', file), path.join(work, 'inputs', file)));
  fs.writeFileSync(path.join(work, 'package.json'), '{ "type": "module" }\n');
  const stub = (name, files) => {
    fs.mkdirSync(path.join(work, 'node_modules', name), { recursive: true });
    Object.keys(files).forEach(file => fs.writeFileSync(path.join(work, 'node_modules', name, file), files[file]));
  };
  stub('react', {
    'package.json': JSON.stringify({ name: 'react', type: 'module', exports: { '.': './index.js' } }),
    'index.js': 'export const createElement = (type, props, ...children) => ({ type, props: props || {}, children });\nexport const useState = v => [v, () => {}];\nexport const useRef = v => ({ current: v });\nexport const useEffect = () => {};',
  });
  stub('sanity', {
    'package.json': JSON.stringify({ name: 'sanity', type: 'module', exports: { '.': './index.js', './router': './router.js' } }),
    'index.js': 'export const useClient = () => ({});',
    'router.js': "export const Link = 'Link';",
  });

  const load = file => import(pathToFileURL(path.join(work, file)).href);
  return {
    board: await load('tools/rotation-board.js'),
    titles: await load('tools/rotation-titles.js'),
    auto: await load('tools/rotation-auto.js'),
    parts: await load('inputs/rotation-board-parts.js'),
    autoParts: await load('inputs/rotation-auto-parts.js'),
    view: await load('inputs/rotation-board-view.js'),
    panels: await load('inputs/screen-panels.js'),
  };
}

export function walk(node, found = []) {
  if (typeof node === 'string' || typeof node === 'number') found.push(String(node));
  if (!node || typeof node !== 'object') return found;
  found.push(node);
  (Array.isArray(node) ? node : node.children || []).forEach(child => walk(child, found));
  return found;
}

export const nodesWhere = (node, check) => walk(node).filter(item => typeof item === 'object' && item.props !== undefined && check(item));
export const textOf = node => walk(node).filter(item => typeof item === 'string').join('');
