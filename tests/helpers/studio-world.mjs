// Loads the Studio's own files in node without the real Studio packages, for the tests of its pages
// (tests/studio-*.test.mjs). A copy of studio/ is made in a temporary folder, with small stand-ins for sanity, react
// and the icons next to it. The react stand-in keeps the state of one mounted component, so a test can draw a page,
// click in it, and draw it again.
//
//   const studio = await openStudio();
//   const view = await studio.load('inputs/today-view.js');
//   const page = studio.mount(view.TodayView);
//   await page.settle();
//   page.tree()          the page as a tree of { type, props, children }
//   studio.close();      removes the copy

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = fileURLToPath(new URL('../../studio/', import.meta.url));

const stubs = {
  sanity: {
    'package.json': JSON.stringify({
      name: 'sanity',
      type: 'module',
      exports: { '.': './index.js', './structure': './structure.js', './cli': './cli.js', './router': './router.js' },
    }),
    'index.js': [
      'export const defineType = type => type;',
      'export const defineField = field => field;',
      'export const defineArrayMember = member => member;',
      'export const defineConfig = config => config;',
      'export const useClient = () => globalThis.studioClient || {};',
      'export const useSchema = () => ({ get: () => undefined });',
      'export const useWorkspace = () => ({});',
      'export const useCurrentUser = () => null;',
      "export const set = (value, path) => (path ? { type: 'set', value: value, path: path } : { type: 'set', value: value });",
      "export const unset = () => ({ type: 'unset' });",
      "export const useFormValue = path => (globalThis.studioForm || {})[path.join('.')];",
      'export const validateDocument = async () => [];',
      'export const useDocumentOperation = () => ({',
      '  patch: { execute: patches => (globalThis.studioCalls = globalThis.studioCalls || []).push({ patch: patches }) },',
      '  publish: { execute: () => (globalThis.studioCalls = globalThis.studioCalls || []).push({ publish: true }) },',
      '});',
    ].join('\n'),
    'structure.js': [
      'export const structureTool = options => ({ options: options });',
      "export const usePaneRouter = () => globalThis.studioPaneRouter || { ChildLink: 'ChildLink' };",
    ].join('\n'),
    'cli.js': 'export const defineCliConfig = config => config;',
    'router.js': "export const Link = 'a'; export const IntentLink = 'a';",
  },
  react: {
    'package.json': JSON.stringify({ name: 'react', type: 'module', exports: { '.': './index.js' } }),
    'index.js': [
      'const hooks = () => globalThis.studioHooks;',
      'export const useState = initial => {',
      '  const store = hooks();',
      '  const at = store.index++;',
      "  if (!(at in store.values)) store.values[at] = typeof initial === 'function' ? initial() : initial;",
      "  return [store.values[at], value => { store.values[at] = typeof value === 'function' ? value(store.values[at]) : value; store.dirty = true; }];",
      '};',
      'export const useEffect = (effect, deps) => {',
      '  const store = hooks();',
      '  const at = store.index++;',
      '  const before = store.deps[at];',
      '  const changed = !before || !deps || deps.length !== before.length || deps.some((item, position) => item !== before[position]);',
      '  store.deps[at] = deps;',
      '  if (changed) store.pending.push(effect);',
      '};',
      "export const createContext = value => ({ current: value, Provider: 'ContextProvider' });",
      'export const useContext = context => context.current;',
      'export const useRef = value => ({ current: value });',
      'export const createElement = (type, props, ...children) => ({ type: type, props: props, children: children });',
    ].join('\n'),
  },
};

// The icons structure.js imports, each from its own file of @sanity/icons: [file, name]
function iconImportsOf(source) {
  return Array.from(source.matchAll(/import \{ (\w+) \} from '@sanity\/icons\/(\w+)';/g)).map(match => [match[2], match[1]]);
}

export async function openStudio() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-studio-page-'));
  ['schemas', 'structure.js', 'inputs', 'tools', 'project.js', 'sanity.config.js', 'sanity.cli.js'].forEach(name => {
    fs.cpSync(path.join(here, name), path.join(folder, name), { recursive: true });
  });
  fs.writeFileSync(path.join(folder, 'package.json'), JSON.stringify({ type: 'module' }));

  Object.keys(stubs).forEach(packageName => {
    const stub = path.join(folder, 'node_modules', packageName);
    fs.mkdirSync(stub, { recursive: true });
    Object.keys(stubs[packageName]).forEach(name => fs.writeFileSync(path.join(stub, name), stubs[packageName][name]));
  });

  const iconFolder = path.join(folder, 'node_modules', '@sanity', 'icons');
  const iconExports = {};
  fs.mkdirSync(iconFolder, { recursive: true });
  iconImportsOf(fs.readFileSync(path.join(folder, 'structure.js'), 'utf8')).forEach(icon => {
    iconExports['./' + icon[0]] = './' + icon[0] + '.js';
    fs.writeFileSync(path.join(iconFolder, icon[0] + '.js'), 'export const ' + icon[1] + ' = () => null;');
  });
  fs.writeFileSync(path.join(iconFolder, 'package.json'), JSON.stringify({ name: '@sanity/icons', type: 'module', exports: iconExports }));

  const waitAWhile = () => new Promise(resolve => setTimeout(resolve, 0));

  return {
    folder: folder,
    load: file => import(pathToFileURL(path.join(folder, file)).href),
    source: file => fs.readFileSync(path.join(here, file), 'utf8'),
    close: () => fs.rmSync(folder, { recursive: true, force: true }),

    // Draws a component the way Studio does, and again after every change of state. settle() runs the effects that
    // are waiting and draws until nothing changes.
    mount(Component, props) {
      const store = { values: {}, deps: {}, index: 0, dirty: false, pending: [] };
      let result;
      const draw = () => {
        globalThis.studioHooks = store;
        store.index = 0;
        store.dirty = false;
        result = Component(props);
      };
      draw();

      return {
        tree: () => result,
        async settle() {
          for (let round = 0; round < 40; round++) {
            const effects = store.pending.splice(0);
            effects.forEach(effect => effect());
            for (let tick = 0; tick < 6; tick++) await waitAWhile();
            if (!store.dirty && effects.length === 0) return result;
            draw();
          }
          return result;
        },
      };
    },
  };
}

// Every node of a tree for which test is true
export function nodesWhere(node, test, found) {
  const list = found || [];
  if (Array.isArray(node)) node.forEach(item => nodesWhere(item, test, list));
  else if (node && typeof node === 'object') {
    if (test(node)) list.push(node);
    nodesWhere(node.children || [], test, list);
  }
  return list;
}

// The words of a tree, as one line
export function wordsIn(node) {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(wordsIn).join(' ').replace(/\s+/g, ' ').trim();
  return node && typeof node === 'object' ? wordsIn(node.children || []) : '';
}

// A stand-in for the client of the Studio: documents by id, and every write written down
export function fakeClient(documents) {
  const stored = {};
  (documents || []).forEach(doc => { stored[doc._id] = JSON.parse(JSON.stringify(doc)); });
  const calls = [];

  return {
    calls: calls,
    stored: stored,
    fetch: async (query, params) => {
      calls.push({ fetch: query });
      if (/_type == "announcement"/.test(query)) return Object.values(stored).filter(doc => doc._type === 'announcement');
      if (/_type == "team"/.test(query)) return Object.values(stored).filter(doc => doc._type === 'team');
      return Object.values(stored).filter(doc => doc._id === (params && params.draft) || doc._id === (params && params.published));
    },
    getDocument: async id => stored[id] || null,
    createIfNotExists: async doc => {
      calls.push({ create: JSON.parse(JSON.stringify(doc)) });
      if (!stored[doc._id]) stored[doc._id] = JSON.parse(JSON.stringify(doc));
      return doc;
    },
    patch: id => {
      const change = { patch: id, set: null, unset: [] };
      const builder = {
        set: fields => { change.set = fields; return builder; },
        unset: names => { change.unset = names; return builder; },
        commit: async () => {
          calls.push(change);
          Object.assign(stored[id], change.set);
          change.unset.forEach(name => delete stored[id][name]);
          return stored[id];
        },
      };
      return builder;
    },
  };
}
