// Loads every schema without installing anything and checks it against what
// the dashboard reads. Run it in this folder with: node check-schemas.mjs

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardFolder = path.join(here, '..', 'dashboard');

// The shape of the content, as the dashboard reads it. A field name that is
// not listed here is a field the dashboard would ignore, and a name that is
// listed but missing from a schema is something the dashboard expects.
//   text(30)   a string or text field that must stop at 30 characters
//   'string'   a string picked from a fixed list
const text = max => ({ kind: 'text', max: max });
const number = (min, max) => ({ kind: 'number', min: min, max: max });
const object = fields => ({ kind: 'object', fields: fields });
const rows = (fields, maxItems) => ({ kind: 'rows', fields: fields, maxItems: maxItems });
const strings = (max, maxItems) => ({ kind: 'strings', max: max, maxItems: maxItems });

const blockNames = ['headingBlock', 'textBlock', 'statBlock', 'listBlock', 'imageBlock', 'progressBlock', 'countdownBlock'];
const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const panelStep = { panel: 'string', show: 'boolean', seconds: number(6, 120) };

function withFlags(fields) {
  return Object.assign({}, fields, { show: 'boolean', expires: 'datetime' });
}

// The limits are what fits on the screen, measured with ordinary mixed case
// text. Change one here only after measuring the panel again.
const contract = {
  task: withFlags({
    title: text(22),
    subteam: { kind: 'reference', to: 'subteam' },
    status: 'string',
    finishedOn: 'datetime',
    contact: text(12),
    location: { kind: 'reference', to: 'place' },
    order: 'number',
  }),
  place: { name: text(16), show: 'boolean' },
  plan: withFlags({
    heading: text(26),
    date: 'date',
    location: text(30),
    rows: rows({ time: text(9), text: text(18), lead: text(10) }, 5),
  }),
  extraEvent: { title: text(30), startDate: 'date', endDate: 'date', startTime: 'time', endTime: 'time', location: text(24), show: 'boolean' },
  sponsor: withFlags({ name: text(19), tier: text(12), blurb: text(80), thankYou: text(54), logoAddress: 'url', order: 'number' }),
  tipOrNews: withFlags({ kind: 'string', text: text(52), order: 'number' }),
  subteam: withFlags({
    name: text(11),
    lead: text(17),
    members: strings(12, 24),
    spotlight: 'boolean',
    spotlightHeadline: text(40),
    spotlightText: text(100),
    order: 'number',
  }),
  person: withFlags({ role: 'string', name: text(17), title: text(22), photo: 'image', showPhoto: 'boolean', order: 'number' }),
  photo: withFlags({ image: 'image', caption: text(36), credit: text(14) }),
  customPanel: withFlags({ title: text(7), blocks: { kind: 'blocks', max: 6 }, order: 'number' }),
  dashboardSettings: {
    team: object({ name: text(16), number: text(5), school: text(30) }),
    motion: 'string',
    speed: 'string',
    frameMetal: 'string',
    contentSource: 'string',
    switchBackAt: 'datetime',
    glint: 'boolean',
    pageSeconds: number(8, 120),
    logoAnimations: 'boolean',
    logoEntrance: 'boolean',
    logoSpin: 'boolean',
    logoSpinEvery: number(0, 3600),
    logoSpinDuration: number(0.5, 10),
    logoHawk: 'boolean',
    logoHawkEvery: number(0, 3600),
    logoHawkDuration: number(6, 30),
    nameTransform: 'boolean',
    nameEvery: number(0, 900),
    nameDuration: number(0.5, 10),
    pageChangeStyle: 'string',
    breakSeconds: number(0.3, 2),
    frameFinish: 'string',
    silverChance: number(0, 100),
    photoOrder: 'string',
    photoSeconds: number(6, 120),
    nightEnabled: 'boolean',
    nightStyle: 'string',
    nightStart: 'time',
    nightEnd: 'time',
    nightLogoWidth: number(120, 800),
    nightSpeed: 'string',
    nightPreview: 'boolean',
    hiddenEnabled: 'boolean',
    desktopChance: number(0, 100),
    redEyesChance: number(0, 100),
    hiddenRequest: object({ kind: 'string', requestedAt: 'datetime' }),
    announceRequest: object({ requestedAt: 'datetime' }),
    countdown: object({ kickoffLabel: text(12), kickoff: 'datetime', rolloutLabel: text(12), rollout: 'datetime' }),
    alert: object({ on: 'boolean', headline: text(24), message: text(90), until: 'datetime' }),
    rotation: object({ grid1: rows(panelStep), grid2: rows(panelStep), tickerSeconds: number(6, 120) }),
    doneDays: 'number',
    safetyDaysSince: 'date',
    crt: object({ on: 'boolean', everySeconds: number(0, 3600), durationSeconds: number(0.5, 10) }),
    announcements: rows({
      time: 'time',
      title: text(24),
      followUp: text(24),
      titleSeconds: number(3, 60),
      followUpSeconds: number(3, 60),
      days: { kind: 'weekdays' },
      show: 'boolean',
    }),
    calendars: rows({ id: text(20), name: text(20), show: 'boolean' }),
    showConnectionStatus: 'boolean',
  },
  theme: {
    defaultTheme: 'string',
    useNow: object({ theme: 'string', overlay: 'string', until: 'datetime' }),
    schedule: rows({
      name: text(24),
      kind: 'string',
      theme: 'string',
      overlay: 'string',
      startDate: 'date',
      endDate: 'date',
      repeatsEveryYear: 'boolean',
    }, 24),
    timeZone: text(40),
  },
  demo: {
    requestedAt: 'datetime',
    steps: rows({ screen: 'string', seconds: number(5, 300) }, 10),
    announcementText: text(24),
  },
  headingBlock: { text: text(30) },
  textBlock: { text: text(100) },
  statBlock: { value: text(6), label: text(24) },
  listBlock: { items: strings(34, 5) },
  imageBlock: { address: 'url' },
  progressBlock: { label: text(30), percent: number(0, 100) },
  countdownBlock: { label: text(24), target: 'datetime' },
};

const itemTypes = ['task', 'plan', 'sponsor', 'tipOrNews', 'subteam', 'person', 'photo', 'customPanel'];

const choices = {
  'task.status': ['blocked', 'in-progress', 'up-next', 'done'],
  'tipOrNews.kind': ['tip', 'news', 'reminder'],
  'person.role': ['Coach', 'Captain', 'Mentor'],
  'dashboardSettings.motion': ['full', 'calm'],
  'dashboardSettings.speed': ['very-slow', 'slow', 'normal', 'fast'],
  'dashboardSettings.frameMetal': ['gold', 'silver'],
  'dashboardSettings.pageChangeStyle': ['alternate', 'slat', 'mechanical'],
  'dashboardSettings.frameFinish': ['mostly-gold', 'alternate', 'gold', 'silver'],
  'dashboardSettings.photoOrder': ['random', 'newest-first'],
  'dashboardSettings.nightStyle': ['bounce', 'black'],
  'dashboardSettings.nightSpeed': ['slow', 'normal', 'fast'],
  'dashboardSettings.contentSource': ['production', 'sample'],
  'dashboardSettings.hiddenRequest.kind': ['desktop', 'redEyes'],
  'demo.steps.screen': ['announcement', 'all-announcements', 'night-mode'],
};

// The panels that can be put in each area of the screen. The Studio lists and
// defaultSettings in config.js must offer the same panels as registry.js.
const rotationAreas = ['grid1', 'grid2'];

// The field each sidebar list is sorted by. Where a line sits in structure.js
// is up to whoever edits that file, so only the sort of each list is checked.
const listSort = {
  task: 'order',
  plan: 'date',
  extraEvent: 'startDate',
  sponsor: 'order',
  tipOrNews: 'order',
  subteam: 'order',
  person: 'order',
  photo: '_createdAt',
  customPanel: 'order',
  place: 'name',
};

// The pages that exist once. Each is one document whose id is its type.
const pageTypes = ['dashboardSettings', 'theme', 'demo'];

// Document types that have no line in structure.js, with the reason for each.
// Types that are only objects inside another document are not documents and
// are left out of the check without being listed here.
const notInSidebar = {};

// The sidebar titles that people look for by name
const sidebarTitles = { extraEvent: 'Events Calendar', place: 'Places' };

// The real 'sanity' and 'react' packages are not installed, so stand-ins with
// the same function names sit next to a copy of the files that import them.
const standIns = {
  sanity: {
    'package.json': JSON.stringify({
      name: 'sanity',
      type: 'module',
      exports: { '.': './index.js', './structure': './structure.js', './cli': './cli.js' },
    }),
    'index.js': [
      'export const defineType = type => type;',
      'export const defineField = field => field;',
      'export const defineArrayMember = member => member;',
      'export const defineConfig = config => config;',
      // writes down what an action does, so checkContentSource can read it back
      // only the names the Publish all tool imports, so that its file can be loaded
      'export const useClient = () => ({});',
      'export const useSchema = () => ({ get: () => undefined });',
      'export const useWorkspace = () => ({});',
      'export const useCurrentUser = () => null;',
      'export const validateDocument = async () => [];',
      'export const useDocumentOperation = () => ({',
      '  patch: { execute: patches => globalThis.studioCalls.push({ patch: patches }) },',
      '  publish: { execute: () => globalThis.studioCalls.push({ publish: true }) },',
      '});',
    ].join('\n'),
    'structure.js': 'export const structureTool = options => ({ options: options });',
    'cli.js': 'export const defineCliConfig = config => config;',
  },
  react: {
    'package.json': JSON.stringify({ name: 'react', type: 'module', exports: { '.': './index.js' } }),
    'index.js': [
      'export const useState = value => [value, () => {}];',
      'export const useEffect = () => {};',
      'export const createElement = (type, props, ...children) => ({ type: type, props: props, children: children });',
    ].join('\n'),
  },
};

function makeSandbox() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-studio-'));
  ['schemas', 'structure.js', 'project.js', 'actions.js', 'themes.js', 'demo-screens.js', 'hidden-transitions.js', 'publish-all.js', 'publish-all-tool.js', 'sanity.config.js', 'sanity.cli.js'].forEach(name => {
    fs.cpSync(path.join(here, name), path.join(folder, name), { recursive: true });
  });
  fs.writeFileSync(path.join(folder, 'package.json'), JSON.stringify({ type: 'module' }));

  Object.keys(standIns).forEach(packageName => {
    const stub = path.join(folder, 'node_modules', packageName);
    fs.mkdirSync(stub, { recursive: true });
    Object.keys(standIns[packageName]).forEach(name => fs.writeFileSync(path.join(stub, name), standIns[packageName][name]));
  });
  return folder;
}

function load(file) {
  return import(pathToFileURL(file).href);
}

// A Rule that writes down what it is asked to do, so the limits can be read
// back without Sanity. Each call gives a new Rule, as the real one does.
const ruleMethods = [
  'required', 'min', 'max', 'length', 'integer', 'positive', 'regex', 'uri', 'email', 'custom', 'unique', 'valid',
  'error', 'warning', 'info',
];

function makeRule(constraints) {
  const rule = { constraints: constraints };
  ruleMethods.forEach(name => {
    rule[name] = function (...args) {
      return makeRule(constraints.concat([{ name: name, args: args }]));
    };
  });
  return rule;
}

function constraintsOf(item) {
  if (!item.validation) return [];

  const result = item.validation(makeRule([]));
  const rules = Array.isArray(result) ? result : [result];
  return rules.reduce((all, rule) => all.concat(rule.constraints), []);
}

function constraintNamed(constraints, name) {
  return constraints.filter(constraint => constraint.name === name)[0];
}

// The words of the error that comes right after a constraint
function messageAfter(constraints, name) {
  const index = constraints.indexOf(constraintNamed(constraints, name));
  const next = constraints[index + 1];
  return next && next.name === 'error' && next.args[0] ? String(next.args[0]) : '';
}

function typeByName(name) {
  return world.types.filter(type => type.name === name)[0];
}

// The fields of a type or of an object field, or of the items of a list
function fieldsIn(item) {
  if (item.fields) return item.fields;
  return item.of && item.of.length === 1 && item.of[0].fields ? item.of[0].fields : [];
}

// 'task.status' or 'dashboardSettings.rotation.grid1.panel'
function fieldAt(pathText) {
  const names = pathText.split('.');
  let current = typeByName(names[0]);
  for (let i = 1; i < names.length && current; i++) {
    current = fieldsIn(current).filter(field => field.name === names[i])[0];
  }
  return current;
}

function eachField(visit) {
  function walk(item, where) {
    fieldsIn(item).forEach(field => {
      visit(where + '.' + field.name, field);
      walk(field, where + '.' + field.name);
    });
  }
  world.types.forEach(type => walk(type, type.name));
}

// Every preview: on a type, or on the items of a list
function eachPreview(visit) {
  world.types.forEach(type => {
    if (type.preview) visit(type.name, type.preview);
  });
  eachField((where, field) => {
    (field.of || []).forEach(member => {
      if (member.preview) visit(where + ' item', member.preview);
    });
  });
}

function sameData(a, b) {
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return a === b;

  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => sameData(a[key], b[key]));
}

function need(problems, condition, message) {
  if (!condition) problems.push(message);
}

function without(object, name) {
  const copy = Object.assign({}, object);
  delete copy[name];
  return copy;
}

// 2027-01-09T17:00:00.000Z written as 2027-01-09T12:00, as it reads in Holly Springs
function localTime(isoText) {
  const format = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return format.format(new Date(isoText)).replace(' ', 'T');
}

function compareFields(where, fields, expected, problems) {
  const names = fields.map(field => field.name);
  Object.keys(expected).forEach(name => {
    const field = fields.filter(item => item.name === name)[0];
    if (!field) problems.push(where + '.' + name + ': the dashboard expects this field and it is missing');
    else checkField(where + '.' + name, field, expected[name], problems);
  });
  names.forEach(name => {
    if (!expected[name]) problems.push(where + '.' + name + ': the dashboard does not read this field');
  });
}

// Kinds with their own check. Any other kind is a plain Sanity type name.
const kindChecks = {
  text: checkText,
  string: checkChoice,
  time: checkTime,
  number: checkNumber,
  object: checkObject,
  reference: checkReference,
  rows: checkRows,
  strings: checkStrings,
  weekdays: checkWeekdays,
  blocks: checkBlocks,
  image: checkImage,
};

function checkField(where, field, spec, problems) {
  const want = typeof spec === 'string' ? { kind: spec } : spec;
  const say = message => problems.push(where + ': ' + message);
  const specific = kindChecks[want.kind];

  if (specific) specific(field, want, say, problems, where);
  else if (field.type !== want.kind) say('should be type ' + want.kind + ', it is ' + field.type);
}

function checkLimit(item, max, say, what) {
  const constraints = constraintsOf(item);
  const limit = constraintNamed(constraints, 'max');

  if (!limit || limit.args[0] !== max) say(what + ' needs a limit of ' + max);
  else if (messageAfter(constraints, 'max').indexOf(String(max)) === -1) say('the error for the limit of ' + max + ' does not say ' + max);
}

function checkText(field, want, say) {
  if (field.type !== 'string' && field.type !== 'text') say('should be a string or text field');
  checkLimit(field, want.max, say, 'it');
  if ((field.description || '').indexOf(String(want.max)) === -1) say('the description does not mention the limit of ' + want.max);
}

function checkChoice(field, want, say) {
  if (field.type !== 'string') say('should be a string');
  if (!field.options || !field.options.list || field.options.list.length === 0) say('should be picked from a list');
}

function checkTime(field, want, say) {
  const pattern = constraintNamed(constraintsOf(field), 'regex');
  if (field.type !== 'string' || !pattern) return say('should be a string checked with a pattern');

  ['00:00', '09:05', '14:30', '23:59'].forEach(good => {
    if (!pattern.args[0].test(good)) say('the pattern refuses ' + good);
  });
  ['24:00', '9:05', '14:60', '1430', '14:3', '', 'ab:cd', '14:30 '].forEach(bad => {
    if (pattern.args[0].test(bad)) say('the pattern accepts "' + bad + '"');
  });
}

function checkNumber(field, want, say) {
  if (field.type !== 'number') say('should be a number');
  if (want.min === undefined) return;

  const constraints = constraintsOf(field);
  ['min', 'max'].forEach(name => {
    const found = constraintNamed(constraints, name);
    if (!found || found.args[0] !== want[name]) say('needs ' + name + ' ' + want[name]);
  });
}

function checkReference(field, want, say) {
  const target = field.to && field.to[0];
  if (field.type !== 'reference' || !target || target.type !== want.to) say('should be a reference to ' + want.to);
}

function checkObject(field, want, say, problems, where) {
  if (field.type !== 'object') say('should be an object');
  compareFields(where, field.fields || [], want.fields, problems);
}

function checkRows(field, want, say, problems, where) {
  if (field.type !== 'array' || fieldsIn(field).length === 0) return say('should be a list of objects');

  compareFields(where, fieldsIn(field), want.fields, problems);
  if (want.maxItems) checkLimit(field, want.maxItems, say, 'the list');
}

function checkStrings(field, want, say) {
  const member = field.of && field.of[0];
  if (field.type !== 'array' || !member || member.type !== 'string') return say('should be a list of strings');

  checkLimit(member, want.max, say, 'each line');
  checkLimit(field, want.maxItems, say, 'the list');
}

function checkWeekdays(field, want, say) {
  const member = field.of && field.of[0];
  if (field.type !== 'array' || !member || member.type !== 'number') return say('should be a list of numbers');

  const list = (field.options && field.options.list) || [];
  const wanted = weekdayNames.map((name, index) => index + ':' + name);
  if (list.map(item => item.value + ':' + item.title).join() !== wanted.join()) say('should be a checkbox list of 0 to 6 titled Sunday to Saturday');
}

// A picture field: images only, with the crop and hotspot tools on, so an
// editor can keep a face in the middle of the square the screen cuts
function checkImage(field, want, say) {
  const options = field.options || {};

  if (field.type !== 'image') say('should be an image');
  if (options.hotspot !== true) say('should have the crop and hotspot tools on (options.hotspot)');
  if (options.accept !== 'image/*') say('should accept images only (options.accept should be "image/*")');
}

function checkBlocks(field, want, say) {
  const used = (field.of || []).map(member => member.type);
  if (used.join() !== blockNames.join()) say('should allow exactly: ' + blockNames.join(', '));
  checkLimit(field, want.max, say, 'the list');
}

function checkShape() {
  const problems = [];
  Object.keys(contract).forEach(name => {
    const type = typeByName(name);
    if (type) compareFields(name, fieldsIn(type), contract[name], problems);
    else problems.push(name + ' is missing from schemas/index.js');
  });
  world.types.forEach(type => {
    if (!contract[type.name]) problems.push(type.name + ' is a type the dashboard does not read');
  });
  return problems;
}

function checkNamesAndTitles() {
  const problems = [];
  world.types.forEach(type => {
    if (!type.name) problems.push('a type has no name');
    if (!type.title) problems.push(type.name + ' has no title');
  });
  return problems;
}

function checkDescriptions() {
  const problems = [];
  eachField((where, field) => {
    const words = field.description || '';
    if (!field.title) problems.push(where + ' has no title');
    if (!words) problems.push(where + ' has no description');
    else if (words.indexOf('\n') !== -1 || words.length > 160) problems.push(where + ' description should be one line of 160 characters or fewer');
  });
  return problems;
}

function checkValidations() {
  const problems = [];
  eachField((where, field) => {
    [field].concat(field.of || []).forEach(item => {
      try {
        constraintsOf(item);
      } catch (error) {
        problems.push(where + ': the validation does not run (' + error.message + ')');
      }
    });
  });
  return problems;
}

function checkItemFields() {
  const problems = [];
  itemTypes.forEach(name => {
    const show = fieldAt(name + '.show');
    const expires = fieldAt(name + '.expires');
    const showOk = show && show.type === 'boolean' && show.title === 'Show on screen' && show.initialValue === true;
    const expiresOk = expires && expires.type === 'datetime' && expires.title === 'Hide after' && /optional/i.test(expires.description || '');
    need(problems, showOk, name + '.show should be a switch titled Show on screen that starts on');
    need(problems, expiresOk, name + '.expires should be a datetime titled Hide after, described as optional');
  });
  return problems;
}

function checkPreviews() {
  const problems = [];
  eachPreview((where, preview) => {
    const result = preview.prepare ? preview.prepare({}) : {};
    if (!result.title) problems.push(where + ': the preview has no title when every field is empty');
    ['title', 'subtitle'].forEach(key => {
      const unfinished = typeof result[key] === 'string' && /\b(undefined|null)\b/.test(result[key]);
      need(problems, !unfinished, where + ': the preview ' + key + ' shows undefined or null');
    });
  });

  itemTypes.forEach(name => {
    const type = typeByName(name);
    const preview = type && type.preview;
    if (!preview || !preview.select || !preview.prepare) return problems.push(name + ' needs a preview with select and prepare');

    const hidden = preview.prepare({ title: 'Example', show: false }).subtitle || '';
    const expired = preview.prepare({ title: 'Example', expires: '2000-01-01T00:00:00.000Z' }).subtitle || '';
    if (hidden.indexOf('Hidden') === -1) problems.push(name + ': the preview does not say when an item is hidden');
    if (expired.indexOf('Expired') === -1) problems.push(name + ': the preview does not say when an item has expired');

    const names = fieldsIn(type).map(field => field.name);
    Object.keys(preview.select).forEach(alias => {
      const first = preview.select[alias].split('.')[0];
      if (names.indexOf(first) === -1) problems.push(name + ': the preview selects ' + first + ', which is not a field');
    });
  });
  return problems;
}

function checkOrderings() {
  const problems = [];
  itemTypes.forEach(name => {
    // a photo has no Order field: its list goes by when it was uploaded
    const wanted = name === 'plan' ? 'date' : name === 'photo' ? '_createdAt' : 'order';
    const type = typeByName(name);
    const found = (type.orderings || []).some(item => item.by && item.by[0].field === wanted);
    if (!found) problems.push(name + ' needs an ordering by ' + wanted);
  });
  return problems;
}

function isPlainTitle(item) {
  return /^[A-Z]/.test(item.title || '') && item.title.indexOf('-') === -1;
}

function choicesOf(pathText) {
  const field = fieldAt(pathText);
  return (field && field.options && field.options.list) || [];
}

function checkChoices() {
  const problems = [];
  Object.keys(choices).forEach(pathText => {
    const list = choicesOf(pathText);
    if (list.map(item => item.value).join() !== choices[pathText].join()) problems.push(pathText + ' should offer: ' + choices[pathText].join(', '));
    list.forEach(item => need(problems, isPlainTitle(item), pathText + ': "' + item.title + '" is not a plain-words title'));
  });

  const statuses = ((fieldAt('task.status') || {}).options || {}).list || [];
  const titles = statuses.map(item => item.title).join();
  need(problems, titles === 'Blocked,In progress,Up next,Done', 'task.status titles should be Blocked, In progress, Up next, Done');
  return problems;
}

// Panel names in one list that the other list does not have, both ways round
function differences(expected, actual, expectedName, actualName, problems) {
  expected.filter(id => actual.indexOf(id) === -1).forEach(id => {
    problems.push(actualName + ' is missing ' + id + ', which ' + expectedName + ' has');
  });
  actual.filter(id => expected.indexOf(id) === -1).forEach(id => {
    problems.push(actualName + ' has ' + id + ', which ' + expectedName + ' does not have for this area');
  });
  need(problems, new Set(actual).size === actual.length, actualName + ' lists a panel twice');
}

// A panel the editors can pick has to be one the dashboard has, and the other
// way round, or a new panel can never be switched on
function checkPanelIds() {
  const problems = [];
  const registered = world.registry.panels.filter(panel => !panel.testOnly);

  rotationAreas.forEach(area => {
    const inRegistry = registered.filter(panel => panel.region === area).map(panel => panel.id);
    const offered = choicesOf('dashboardSettings.rotation.' + area + '.panel');
    const inConfig = world.dashboard.defaultSettings.rotation[area].map(step => step.panel);

    differences(inRegistry, offered.map(item => item.value), 'registry.js', 'the Studio list for ' + area, problems);
    differences(inRegistry, inConfig, 'registry.js', 'defaultSettings.rotation.' + area + ' in config.js', problems);
    offered.forEach(item => need(problems, isPlainTitle(item), area + ': "' + item.title + '" is not a plain-words title'));
  });
  return problems;
}

// The Mini saves CALENDAR_BUILD_SEASON_URL as build_season.ics, so a calendar
// code is lowercase letters, digits and underscores
function checkRules() {
  const problems = [];
  const announcement = name => fieldAt('dashboardSettings.announcements.' + name);

  const days = constraintsOf(announcement('days'));
  const atLeastOne = constraintNamed(days, 'min');
  const daysOk = constraintNamed(days, 'required') && atLeastOne && atLeastOne.args[0] === 1;
  need(problems, daysOk, 'announcements.days should be required and need at least 1 day');

  const show = announcement('show');
  need(problems, show && show.type === 'boolean' && show.initialValue === true, 'announcements.show should be a switch that starts on');

  const code = constraintNamed(constraintsOf(fieldAt('dashboardSettings.calendars.id')), 'regex');
  if (!code) return problems.concat('calendars.id should be checked with a pattern');

  ['team', 'build_season', 'band2'].forEach(good => {
    if (!code.args[0].test(good)) problems.push('the calendar code pattern refuses ' + good);
  });
  ['Team', 'build-season', 'build season', 'team.ics', 'team\n', ''].forEach(bad => {
    if (code.args[0].test(bad)) problems.push('the calendar code pattern accepts "' + bad + '"');
  });
  return problems;
}

// The Speed setting offers the speeds that dashboard/config.js knows, and
// refuses any other value
function checkSpeed() {
  const problems = [];
  const field = fieldAt('dashboardSettings.speed');
  const known = Object.keys(world.dashboard.speeds);

  const offered = choicesOf('dashboardSettings.speed').map(item => item.value);
  need(problems, offered.join() === known.join(), 'speed should offer the same names as speeds in config.js: ' + known.join(', '));

  const constraints = field ? constraintsOf(field) : [];
  const allowed = constraintNamed(constraints, 'valid');
  need(problems, constraintNamed(constraints, 'required'), 'speed should be required');
  need(problems, allowed && allowed.args[0].join() === known.join(), 'speed should only allow: ' + known.join(', '));

  const pace = known.map(name => world.dashboard.speeds[name]).join();
  need(problems, pace === '2,1.5,1,0.75', 'speeds in config.js should be 2, 1.5, 1 and 0.75 times, not ' + pace);
  need(problems, world.dashboard.speeds[world.dashboard.defaultSettings.speed] === 1, 'the default speed in config.js should be normal, which is 1');
  return problems;
}

// The Logo tab: the master switch, the entrance, and a switch, seconds between
// plays and seconds one play lasts for each animation that repeats. The name
// effect keeps its old stored names. The section is all in schemas/settingsLogo.js.
const logoSwitches = ['logoAnimations', 'logoEntrance', 'logoSpin', 'logoHawk', 'nameTransform'];
const logoNumbers = ['logoSpinEvery', 'logoSpinDuration', 'logoHawkEvery', 'logoHawkDuration', 'nameEvery', 'nameDuration'];

function checkLogoTab(problems) {
  const settings = typeByName('dashboardSettings');
  const tabs = settings.groups.map(group => group.name);
  const logoFieldNames = logoSwitches.concat(logoNumbers);

  need(problems, tabs.indexOf('effects') === -1, 'the Logo and effects tab (group effects) should be gone');
  need(problems, settings.groups.filter(group => group.title === 'Logo').length === 1, 'Dashboard Settings should have exactly one tab named Logo');
  need(problems, settings.groups.filter(group => group.name === 'logo' && group.title === 'Logo').length === 1, 'the Logo tab should be the group logo');

  logoFieldNames.forEach(name => {
    const field = fieldAt('dashboardSettings.' + name);
    need(problems, field && field.group === 'logo', name + ' should be in the Logo tab');
  });

  // Nothing else is in the tab, so deleting settingsLogo.js removes the whole section
  const others = fieldsIn(settings).filter(field => field.group === 'logo' && logoFieldNames.indexOf(field.name) === -1);
  need(problems, others.length === 0, 'only the logo and name effect fields belong in the Logo tab, not ' + others.map(field => field.name).join(', '));

  // The master switch is first, and the order in the tab is the order here
  const inTab = fieldsIn(settings).filter(field => field.group === 'logo').map(field => field.name);
  need(problems, inTab[0] === 'logoAnimations', 'the master switch logoAnimations should be the first field in the Logo tab');

  const titles = { logoAnimations: 'Logo animations', logoEntrance: 'Entrance', logoSpin: 'Spin', logoHawk: 'Flying hawk', nameTransform: 'Name effect' };
  Object.keys(titles).forEach(name => {
    const field = fieldAt('dashboardSettings.' + name);
    need(problems, field && field.title === titles[name], name + ' should be titled ' + titles[name]);
  });

  // The entrance plays once, so it has no seconds. Every Logo field has a one-line description.
  need(problems, !fieldAt('dashboardSettings.logoEntranceEvery') && !fieldAt('dashboardSettings.logoEntranceDuration'), 'the entrance plays once, so it has no timing fields');
  logoFieldNames.forEach(name => {
    const field = fieldAt('dashboardSettings.' + name);
    const words = field ? field.description || '' : '';
    need(problems, words.length > 0 && words.indexOf('\n') === -1, name + ' needs a one-line description');
  });
}

// The Transitions tab: Page change style, Break and rebuild time, Frame finish
// and Silver chance. The section is all in schemas/settingsTransitions.js. The
// number fields and their limits are compared with config.js in checkLookAndTiming.
const transitionNames = ['pageChangeStyle', 'breakSeconds', 'frameFinish', 'silverChance'];
const photoNames = ['photoOrder', 'photoSeconds'];
const nightNames = ['nightEnabled', 'nightStyle', 'nightStart', 'nightEnd', 'nightLogoWidth', 'nightSpeed', 'nightPreview'];
const hiddenNames = ['hiddenEnabled', 'desktopChance', 'redEyesChance', 'hiddenRequest'];

function checkTransitionsTab() {
  const problems = [];
  const config = world.dashboard;
  const settings = typeByName('dashboardSettings');
  const at = name => fieldAt('dashboardSettings.' + name);

  need(problems, settings.groups.filter(group => group.title === 'Transitions').length === 1, 'Dashboard Settings should have exactly one tab named Transitions');
  need(problems, settings.groups.filter(group => group.name === 'transitions' && group.title === 'Transitions').length === 1, 'the Transitions tab should be the group transitions');

  // Nothing else is in the tab, so deleting settingsTransitions.js removes the whole section
  const inTab = fieldsIn(settings).filter(field => field.group === 'transitions').map(field => field.name);
  need(problems, inTab.join() === transitionNames.join(), 'the Transitions tab should hold, in this order: ' + transitionNames.join(', ') + ', not ' + inTab.join(', '));

  const titles = { pageChangeStyle: 'Page change style', breakSeconds: 'Break and rebuild time', frameFinish: 'Frame finish', silverChance: 'Silver chance (percent)' };
  Object.keys(titles).forEach(name => {
    need(problems, at(name) && at(name).title === titles[name], name + ' should be titled ' + titles[name]);
  });

  // The two choice lists offer the names in config.js, as radio lists, and only those
  [['pageChangeStyle', config.pageChangeStyles, 'alternate'], ['frameFinish', config.frameFinishes, 'mostly-gold']].forEach(entry => {
    const field = at(entry[0]);
    const rules = field ? constraintsOf(field) : [];
    const allowed = constraintNamed(rules, 'valid');
    need(problems, field && field.options && field.options.layout === 'radio', entry[0] + ' should be a radio list');
    need(problems, choicesOf('dashboardSettings.' + entry[0]).map(item => item.value).join() === entry[1].join(), entry[0] + ' should offer the names in config.js: ' + entry[1].join(', '));
    need(problems, constraintNamed(rules, 'required'), entry[0] + ' should be required');
    need(problems, allowed && allowed.args[0].join() === entry[1].join(), entry[0] + ' should only allow: ' + entry[1].join(', '));
    need(problems, config.defaultSettings[entry[0]] === entry[2], 'the default ' + entry[0] + ' in config.js should be ' + entry[2]);
  });
  need(problems, config.pageChangeStyles.join() === 'alternate,slat,mechanical', 'pageChangeStyles in config.js should be alternate, slat and mechanical');
  need(problems, config.frameFinishes.join() === 'mostly-gold,alternate,gold,silver', 'frameFinishes in config.js should be mostly-gold, alternate, gold and silver');

  // Silver chance is a whole number of percent, from 0 to 100
  const chance = at('silverChance');
  need(problems, chance && /Mostly gold/.test(chance.description || ''), 'the silverChance description should say that Mostly gold uses it');

  // The two settings that share a word with Frame metal say how they differ
  const finish = at('frameFinish');
  need(problems, finish && /Frame metal/.test(finish.description || ''), 'the frameFinish description should say how it relates to Frame metal');
  const metal = at('frameMetal');
  need(problems, metal && /Frame finish/.test(metal.description || ''), 'the frameMetal description should say that page frames follow Frame finish');

  // The sample content carries the settings, with values the dashboard accepts
  const sample = world.sample.settings;
  need(problems, config.pageChangeStyles.indexOf(sample.pageChangeStyle) !== -1, 'the sample settings need a pageChangeStyle of ' + config.pageChangeStyles.join(', '));
  need(problems, config.frameFinishes.indexOf(sample.frameFinish) !== -1, 'the sample settings need a frameFinish of ' + config.frameFinishes.join(', '));
  ['breakSeconds', 'silverChance'].forEach(name => {
    const limit = config.limits[name];
    need(problems, sample[name] >= limit.min && sample[name] <= limit.max, 'the sample settings need ' + name + ' from ' + limit.min + ' to ' + limit.max);
  });
  return problems;
}

// Frame metal, glint, seconds per page and the name effect. The Studio and
// dashboard/config.js must agree on the choices, the limits and the defaults,
// and a row or the ticker may leave seconds empty to follow Seconds per page.
function checkLookAndTiming() {
  const problems = [];
  const config = world.dashboard;
  const settings = config.defaultSettings;
  const at = name => fieldAt('dashboardSettings.' + name);

  const metal = at('frameMetal');
  const metalRules = metal ? constraintsOf(metal) : [];
  const allowed = constraintNamed(metalRules, 'valid');
  const offered = choicesOf('dashboardSettings.frameMetal').map(item => item.value);
  need(problems, config.metals.join() === 'gold,silver', 'metals in config.js should be gold and silver, not ' + config.metals.join());
  need(problems, settings.frameMetal === 'gold', 'the default frame metal in config.js should be gold');
  need(problems, offered.join() === config.metals.join(), 'frameMetal should offer the same names as metals in config.js: ' + config.metals.join(', '));
  need(problems, metal && metal.options && metal.options.layout === 'radio', 'frameMetal should be a radio list');
  need(problems, constraintNamed(metalRules, 'required'), 'frameMetal should be required');
  need(problems, allowed && allowed.args[0].join() === config.metals.join(), 'frameMetal should only allow: ' + config.metals.join(', '));

  logoSwitches.concat(['glint']).forEach(name => {
    const field = at(name);
    const ok = field && field.type === 'boolean' && field.initialValue === true && settings[name] === true;
    need(problems, ok, name + ' should be a switch that starts on, and so should its default in config.js');
  });

  // The numbers in a range: the same limits and starting value in both places.
  //   [field, name in config.limits, starting value, whole numbers only]
  [
    ['pageSeconds', 'pageSeconds', 20, true],
    ['nameEvery', 'nameEvery', 300, true],
    ['nameDuration', 'nameDuration', 1.43, false],
    ['crt.everySeconds', 'crtEvery', 240, true],
    ['crt.durationSeconds', 'crtDuration', 2.7, false],
    ['logoSpinEvery', 'logoSpinEvery', 72, true],
    ['logoSpinDuration', 'logoSpinDuration', 1.6, false],
    ['logoHawkEvery', 'logoHawkEvery', 24, true],
    ['logoHawkDuration', 'logoHawkDuration', 11, false],
    ['breakSeconds', 'breakSeconds', 0.6, false],
    ['silverChance', 'silverChance', 10, true],
    ['photoSeconds', 'photoSeconds', 16, true],
    ['nightLogoWidth', 'nightLogoWidth', 300, true],
    ['desktopChance', 'desktopChance', 1, true],
    ['redEyesChance', 'redEyesChance', 1, true],
  ].forEach(entry => {
    const name = entry[0];
    const field = at(name);
    const limit = config.limits[entry[1]];
    const rules = field ? constraintsOf(field) : [];
    const low = constraintNamed(rules, 'min');
    const high = constraintNamed(rules, 'max');
    const start = name.split('.').reduce((object, key) => object[key], settings);

    need(problems, start === entry[2], 'the default ' + name + ' in config.js should be ' + entry[2] + ', not ' + start);
    need(problems, limit && low && high && low.args[0] === limit.min && high.args[0] === limit.max, name + ' should have the limits in config.js, ' + JSON.stringify(limit));
    need(problems, constraintNamed(rules, 'required'), name + ' should be required');
    need(problems, !!constraintNamed(rules, 'integer') === entry[3], name + (entry[3] ? ' should be a whole number' : ' should allow decimals, so no integer rule'));
  });

  // Seconds between plays: 0 means never, and a number from 1 to 29 is too often
  // [field, name in config.limits, the shortest number of seconds that is not 0]
  [
    ['nameEvery', 'nameEvery', 30],
    ['crt.everySeconds', 'crtEvery', 30],
    ['logoSpinEvery', 'logoSpinEvery', 10],
    ['logoHawkEvery', 'logoHawkEvery', 10],
  ].forEach(entry => {
    const field = at(entry[0]);
    const custom = field ? constraintNamed(constraintsOf(field), 'custom') : null;
    const limit = config.limits[entry[1]];
    const shortest = entry[2];

    need(problems, limit && limit.min === 0 && limit.shortest === shortest, 'limits.' + entry[1] + ' in config.js should have min 0 and shortest ' + shortest);
    need(problems, field && /0 to never|never/.test(field.description || ''), entry[0] + ' description should say that 0 means never');
    if (!custom) return problems.push(entry[0] + ' should refuse 1 to ' + (shortest - 1) + ' with a custom rule (0 or at least ' + shortest + ')');

    const check = custom.args[0];
    need(problems, check(0) === true && check(shortest) === true && check(limit.max) === true && check(undefined) === true, entry[0] + ' should accept 0, ' + shortest + ' and above, and empty');
    need(problems, typeof check(1) === 'string' && typeof check(shortest - 1) === 'string', entry[0] + ' should refuse 1 and ' + (shortest - 1) + ' with a message');
  });

  // The name effect lasts .8 s for a letter and each later letter starts 45 ms
  // after the one before it (frame.css). nameDuration is that, on the default name.
  const defaultLetters = Array.from(world.dashboard.defaultTeam.name).length;
  const measured = 0.8 + (defaultLetters - 1) * 0.045;
  need(problems, Math.abs(measured - settings.nameDuration) < 0.0005, 'nameDuration in config.js should be the length of the name effect on ' + world.dashboard.defaultTeam.name + ', ' + measured.toFixed(2) + ' seconds');

  const pageWords = (at('pageSeconds') || {}).description || '';
  need(problems, /three quarters/.test(pageWords) && /one and a half/.test(pageWords), 'the pageSeconds description should give the small panel and ticker times');

  // Seconds in the lists and on the ticker are optional, and an empty field follows pageSeconds
  [['rotation.grid1.seconds', 6, 120], ['rotation.grid2.seconds', 6, 120], ['rotation.tickerSeconds', 6, 120]].forEach(entry => {
    const field = at(entry[0]);
    const rules = field ? constraintsOf(field) : [];
    const low = constraintNamed(rules, 'min');
    const high = constraintNamed(rules, 'max');

    need(problems, field && !constraintNamed(rules, 'required'), entry[0] + ' should be optional');
    need(problems, field && field.initialValue === undefined, entry[0] + ' should start empty');
    need(problems, low && high && low.args[0] === entry[1] && high.args[0] === entry[2], entry[0] + ' should allow ' + entry[1] + ' to ' + entry[2]);
    need(problems, field && /Seconds per page/.test(field.description || ''), entry[0] + ' should say that empty follows Seconds per page');
  });

  rotationAreas.forEach(area => {
    const withSeconds = settings.rotation[area].filter(step => step.seconds !== undefined);
    need(problems, withSeconds.length === 0, 'defaultSettings.rotation.' + area + ' in config.js should have rows with no seconds, so they follow pageSeconds');
  });
  need(problems, settings.rotation.tickerSeconds === undefined, 'defaultSettings.rotation in config.js should have no tickerSeconds');

  // The tabs: the look settings and the screen glitch sit beside Motion and Speed, the page time
  // with the lists, and everything the logo does (the name effect too) is in one tab, Logo
  ['motion', 'speed', 'frameMetal', 'glint', 'crt'].forEach(name => {
    need(problems, at(name) && at(name).group === 'screen', name + ' should be in the Screen tab');
  });
  need(problems, at('crt') && at('crt').title === 'Screen glitch', 'crt should be titled Screen glitch');
  checkLogoTab(problems);
  need(problems, at('pageSeconds') && at('pageSeconds').group === 'panels', 'pageSeconds should be in the Panels tab');

  // The sample content carries the new settings, with values the dashboard accepts
  const sample = world.sample.settings;
  need(problems, config.metals.indexOf(sample.frameMetal) !== -1, 'the sample settings need a frameMetal of ' + config.metals.join(' or '));
  need(problems, typeof sample.glint === 'boolean', 'the sample settings need glint, true or false');
  logoSwitches.forEach(name => {
    need(problems, typeof sample[name] === 'boolean', 'the sample settings need ' + name + ', true or false');
  });
  need(problems, config.contentSources.indexOf(sample.contentSource) !== -1, 'the sample settings need a contentSource of ' + config.contentSources.join(' or '));
  need(problems, typeof sample.switchBackAt === 'string', 'the sample settings need switchBackAt, empty or a time');
  ['pageSeconds'].concat(logoNumbers).forEach(name => {
    const limit = config.limits[name];
    need(problems, sample[name] >= limit.min && sample[name] <= limit.max, 'the sample settings need ' + name + ' from ' + limit.min + ' to ' + limit.max);
  });
  const glitch = sample.crt || {};
  need(problems, typeof glitch.on === 'boolean', 'the sample settings need crt.on, true or false');
  [['everySeconds', 'crtEvery'], ['durationSeconds', 'crtDuration']].forEach(entry => {
    const limit = config.limits[entry[1]];
    need(problems, glitch[entry[0]] >= limit.min && glitch[entry[0]] <= limit.max, 'the sample settings need crt.' + entry[0] + ' from ' + limit.min + ' to ' + limit.max);
  });
  return problems;
}

// Content source and Switch back to production at. The Studio and
// dashboard/config.js agree on the choices and the starting value, and the two
// buttons on the settings page set the field and publish.
function checkContentSource() {
  const problems = [];
  const config = world.dashboard;
  const at = name => fieldAt('dashboardSettings.' + name);

  const source = at('contentSource');
  const rules = source ? constraintsOf(source) : [];
  const allowed = constraintNamed(rules, 'valid');
  const offered = choicesOf('dashboardSettings.contentSource').map(item => item.value);
  need(problems, config.contentSources.join() === 'production,sample', 'contentSources in config.js should be production and sample, not ' + config.contentSources.join());
  need(problems, config.defaultSettings.contentSource === 'production', 'the default contentSource in config.js should be production');
  need(problems, offered.join() === config.contentSources.join(), 'contentSource should offer the same names as contentSources in config.js: ' + config.contentSources.join(', '));
  need(problems, source && source.options && source.options.layout === 'radio', 'contentSource should be a radio list');
  need(problems, constraintNamed(rules, 'required'), 'contentSource should be required');
  need(problems, allowed && allowed.args[0].join() === config.contentSources.join(), 'contentSource should only allow: ' + config.contentSources.join(', '));

  // The switch back time is optional, starts empty, and is kept to a sensible range
  const back = at('switchBackAt');
  const backRules = back ? constraintsOf(back) : [];
  need(problems, back && !constraintNamed(backRules, 'required'), 'switchBackAt should be optional');
  need(problems, back && back.initialValue === undefined, 'switchBackAt should start empty');
  need(problems, constraintNamed(backRules, 'min') && constraintNamed(backRules, 'max'), 'switchBackAt should have a smallest and a largest time');
  need(problems, config.defaultSettings.switchBackAt === '', 'the default switchBackAt in config.js should be empty');
  need(problems, back && /optional/i.test(back.description || ''), 'the switchBackAt description should say it is optional');

  const tabs = typeByName('dashboardSettings').groups.map(group => group.name);
  need(problems, tabs.indexOf('source') !== -1, 'Dashboard Settings should have a tab named source');
  ['contentSource', 'switchBackAt'].forEach(name => {
    need(problems, at(name) && at(name).group === 'source', name + ' should be in the Content source tab');
  });

  // The two buttons: plain functions on the settings page and nowhere else
  const buttons = world.config.document.actions([], { schemaType: 'dashboardSettings' }).slice(0, 2); // the Hidden tab's buttons come after these (checkHiddenTab)
  const elsewhere = world.config.document.actions([], { schemaType: 'task' });
  need(problems, elsewhere.length === 0, 'only the settings page should get the content source buttons');
  if (buttons.length !== 2 || !buttons.every(button => typeof button === 'function')) {
    return problems.concat('the settings page should start with two actions, written as plain functions');
  }

  // Each one sets the field and publishes, and is switched off when it has nothing to do
  const past = '2020-06-01T12:00:00.000Z';
  const future = '2099-06-01T12:00:00.000Z';

  function press(button, published, draft) {
    globalThis.studioCalls = [];
    const props = { id: 'dashboardSettings', type: 'dashboardSettings', published: published, draft: draft || null, onComplete: () => {} };
    const state = button(props);
    if (!state.disabled) state.onHandle();
    return { state: state, calls: globalThis.studioCalls };
  }

  const toSample = buttons[0];
  const toProduction = buttons[1];
  need(problems, toSample({ published: null, draft: null }).label === 'Use sample content', 'the first action should be labelled Use sample content');
  need(problems, toProduction({ published: null, draft: null }).label === 'Use production content', 'the second action should be labelled Use production content');

  const sampleFromProduction = press(toSample, { contentSource: 'production' });
  need(problems, JSON.stringify(sampleFromProduction.calls) === JSON.stringify([{ patch: [{ set: { contentSource: 'sample' } }] }, { publish: true }]), 'Use sample content should set contentSource to sample and then publish');

  const productionFromSample = press(toProduction, { contentSource: 'sample', switchBackAt: future });
  need(problems, JSON.stringify(productionFromSample.calls) === JSON.stringify([{ patch: [{ set: { contentSource: 'production' } }] }, { publish: true }]), 'Use production content should set contentSource to production and then publish');

  const staleTime = press(toSample, { contentSource: 'production', switchBackAt: past });
  need(problems, JSON.stringify(staleTime.calls[0]) === JSON.stringify({ patch: [{ set: { contentSource: 'sample' } }, { unset: ['switchBackAt'] }] }), 'Use sample content should clear a switch back time that has already passed');

  need(problems, press(toSample, { contentSource: 'sample' }).state.disabled === true, 'Use sample content should be off when the screen is already on the sample');
  need(problems, press(toSample, { contentSource: 'sample', switchBackAt: future }).state.disabled === true, 'Use sample content should be off while the sample runs to a time in the future');
  need(problems, press(toSample, { contentSource: 'sample', switchBackAt: past }).state.disabled === false, 'Use sample content should be on when the switch back time has passed');
  need(problems, press(toProduction, { contentSource: 'sample', switchBackAt: past }).state.disabled === true, 'Use production content should be off when the switch back time has passed');
  need(problems, press(toProduction, { contentSource: 'production' }).state.disabled === true, 'Use production content should be off when the screen is already on production');
  need(problems, press(toProduction, null).state.disabled === true, 'Use production content should be off when nothing is published yet');
  need(problems, press(toProduction, { contentSource: 'production' }, { contentSource: 'production' }).state.disabled === false, 'a draft is something to publish, so the button should be on');
  return problems;
}

// The Night mode tab (the screensaver): a switch that starts on, a style, a start
// and an end time, the logo width, a speed and a preview switch. The section is
// all in schemas/settingsNight.js. There is no time zone field: night mode uses
// the time zone of the Theme page, so the descriptions say so. The choices, the
// limit and the starting values are compared with config.js here and in
// checkChoices, checkLookAndTiming and checkStartingValues.
function checkNightTab() {
  const problems = [];
  const config = world.dashboard;
  const settings = typeByName('dashboardSettings');
  const at = name => fieldAt('dashboardSettings.' + name);

  need(problems, settings.groups.filter(group => group.title === 'Night mode').length === 1, 'Dashboard Settings should have exactly one tab named Night mode');
  need(problems, settings.groups.filter(group => group.name === 'night' && group.title === 'Night mode').length === 1, 'the Night mode tab should be the group night');

  // Nothing else is in the tab, so deleting settingsNight.js removes the whole section
  const inTab = fieldsIn(settings).filter(field => field.group === 'night').map(field => field.name);
  need(problems, inTab.join() === nightNames.join(), 'the Night mode tab should hold, in this order: ' + nightNames.join(', ') + ', not ' + inTab.join(', '));

  const titles = {
    nightEnabled: 'Use night mode',
    nightStyle: 'Night style',
    nightStart: 'Night starts at',
    nightEnd: 'Night ends at',
    nightLogoWidth: 'Logo width (pixels)',
    nightSpeed: 'Bounce speed',
    nightPreview: 'Preview night mode',
  };
  Object.keys(titles).forEach(name => {
    need(problems, at(name) && at(name).title === titles[name], name + ' should be titled ' + titles[name]);
  });

  // The switches: night mode starts on, the preview starts off
  need(problems, at('nightEnabled') && at('nightEnabled').type === 'boolean' && at('nightEnabled').initialValue === true && config.defaultSettings.nightEnabled === true, 'nightEnabled should be a switch that starts on, and so should its default in config.js');
  need(problems, at('nightPreview') && at('nightPreview').type === 'boolean' && at('nightPreview').initialValue === false && config.defaultSettings.nightPreview === false, 'nightPreview should be a switch that starts off, and so should its default in config.js');

  // The two choice lists offer the names in config.js, as radio lists, and only those
  [['nightStyle', config.nightStyles, 'bounce'], ['nightSpeed', Object.keys(config.nightSpeeds), 'normal']].forEach(entry => {
    const field = at(entry[0]);
    const rules = field ? constraintsOf(field) : [];
    const allowed = constraintNamed(rules, 'valid');
    need(problems, field && field.options && field.options.layout === 'radio', entry[0] + ' should be a radio list');
    need(problems, choicesOf('dashboardSettings.' + entry[0]).map(item => item.value).join() === entry[1].join(), entry[0] + ' should offer the names in config.js: ' + entry[1].join(', '));
    need(problems, constraintNamed(rules, 'required'), entry[0] + ' should be required');
    need(problems, allowed && allowed.args[0].join() === entry[1].join(), entry[0] + ' should only allow: ' + entry[1].join(', '));
    need(problems, config.defaultSettings[entry[0]] === entry[2], 'the default ' + entry[0] + ' in config.js should be ' + entry[2]);
  });

  // The times: 23:30 to 11:30 to start with, and required. The pattern is checked by the time kind in the shape table.
  need(problems, config.defaultSettings.nightStart === '23:30' && config.defaultSettings.nightEnd === '11:30', 'the default night times in config.js should be 23:30 to 11:30');
  ['nightStart', 'nightEnd'].forEach(name => {
    need(problems, at(name) && constraintNamed(constraintsOf(at(name)), 'required'), name + ' should be required');
    need(problems, at(name) && /time zone/i.test(at(name).description || '') && /Theme/.test(at(name).description || ''), 'the ' + name + ' description should say that it uses the time zone on the Theme page');
  });
  need(problems, !fieldsIn(settings).some(field => /zone/i.test(field.name)), 'night mode has no time zone field of its own, because it uses the one on the Theme page');

  // The same start and end is no time at all, so the end time warns about it, and only warns
  const endRules = at('nightEnd') ? constraintsOf(at('nightEnd')) : [];
  const custom = constraintNamed(endRules, 'custom');
  const next = custom ? endRules[endRules.indexOf(custom) + 1] : null;
  need(problems, custom && next && next.name === 'warning', 'nightEnd should warn (not refuse) when it is the same as nightStart');
  if (custom) {
    const check = custom.args[0];
    need(problems, typeof check('23:30', { document: { nightStart: '23:30' } }) === 'string', 'nightEnd should warn when it is the same as nightStart');
    need(problems, check('11:30', { document: { nightStart: '23:30' } }) === true, 'nightEnd should not warn when it differs from nightStart');
    need(problems, check('11:30', {}) === true && check(undefined, { document: {} }) === true, 'nightEnd should not warn when there is nothing to compare');
  }

  // The logo width is in pixels, and the speed says how often a corner is reached
  const speed = at('nightSpeed');
  need(problems, speed && /corner/.test(speed.description || ''), 'the nightSpeed description should say how often the logo reaches a corner');
  need(problems, at('nightPreview') && /even with Use night mode off/.test(at('nightPreview').description || ''), 'the nightPreview description should say that it works with Use night mode off');

  // The sample content carries the settings, with values the dashboard accepts
  const sample = world.sample.settings;
  need(problems, config.nightStyles.indexOf(sample.nightStyle) !== -1, 'the sample settings need a nightStyle of ' + config.nightStyles.join(' or '));
  need(problems, Object.keys(config.nightSpeeds).indexOf(sample.nightSpeed) !== -1, 'the sample settings need a nightSpeed of ' + Object.keys(config.nightSpeeds).join(', '));
  need(problems, typeof sample.nightEnabled === 'boolean' && typeof sample.nightPreview === 'boolean', 'the sample settings need nightEnabled and nightPreview as true or false');
  need(problems, /^([01]\d|2[0-3]):[0-5]\d$/.test(sample.nightStart) && /^([01]\d|2[0-3]):[0-5]\d$/.test(sample.nightEnd), 'the sample settings need nightStart and nightEnd in 24 hour time');
  const width = config.limits.nightLogoWidth;
  need(problems, sample.nightLogoWidth >= width.min && sample.nightLogoWidth <= width.max, 'the sample settings need nightLogoWidth from ' + width.min + ' to ' + width.max);
  return problems;
}

// The Hidden tab: the master switch, the two chances and the last push, all in
// schemas/settingsHidden.js, and one Play button for each hidden transition on the
// settings page (actions.js). The list of transitions in hidden-transitions.js is a
// copy of the dashboard's registry, so it is compared here too. The limits and
// starting values are also compared in checkLookAndTiming and checkStartingValues.
function checkHiddenTab() {
  const problems = [];
  const config = world.dashboard;
  const settings = typeByName('dashboardSettings');
  const at = name => fieldAt('dashboardSettings.' + name);

  need(problems, settings.groups.filter(group => group.title === 'Hidden').length === 1, 'Dashboard Settings should have exactly one tab named Hidden');
  need(problems, settings.groups.filter(group => group.name === 'hidden' && group.title === 'Hidden').length === 1, 'the Hidden tab should be the group hidden');

  // Nothing else is in the tab, so deleting settingsHidden.js removes the whole section
  const inTab = fieldsIn(settings).filter(field => field.group === 'hidden').map(field => field.name);
  need(problems, inTab.join() === hiddenNames.join(), 'the Hidden tab should hold, in this order: ' + hiddenNames.join(', ') + ', not ' + inTab.join(', '));

  const titles = { hiddenEnabled: 'Allow hidden transitions', desktopChance: 'Desktop reveal chance (percent)', redEyesChance: 'Red eyes chance (percent)', hiddenRequest: 'Last push' };
  Object.keys(titles).forEach(name => need(problems, at(name) && at(name).title === titles[name], name + ' should be titled ' + titles[name]));

  // The master switch starts on, and its description says what it stops
  need(problems, at('hiddenEnabled') && at('hiddenEnabled').type === 'boolean' && at('hiddenEnabled').initialValue === true && config.defaultSettings.hiddenEnabled === true, 'hiddenEnabled should be a switch that starts on, and so should its default in config.js');
  need(problems, at('hiddenEnabled') && /push/.test(at('hiddenEnabled').description || '') && /calm/.test(at('hiddenEnabled').description || ''), 'the hiddenEnabled description should say that it stops a push too, and that calm motion never plays one');

  // Each chance in the registry is a whole percent, 0 is never
  const registry = world.hiddenRegistry.hiddenTransitions;
  Object.keys(registry).forEach(id => {
    const name = registry[id].chanceField;
    const field = at(name);
    need(problems, field && field.group === 'hidden', name + ' should be in the Hidden tab');
    need(problems, field && /0 is never/.test(field.description || ''), 'the ' + name + ' description should say that 0 is never');
    need(problems, config.limits[name] && config.limits[name].min === 0 && config.limits[name].max === 100, 'limits.' + name + ' in config.js should be 0 to 100');
  });

  // The last push is read only, optional, has no starting value, and its description names the two buttons
  const push = at('hiddenRequest');
  need(problems, push && push.type === 'object' && push.initialValue === undefined, 'hiddenRequest should be an object with no starting value');
  need(problems, sameData(config.defaultSettings.hiddenRequest, { kind: '', requestedAt: '' }), 'the default hiddenRequest in config.js should be a kind and a time that are both empty');
  need(problems, push && /Play desktop reveal/.test(push.description || '') && /Play red eyes/.test(push.description || ''), 'the hiddenRequest description should name the buttons Play desktop reveal and Play red eyes');
  ['kind', 'requestedAt'].forEach(name => {
    const field = fieldAt('dashboardSettings.hiddenRequest.' + name);
    need(problems, field && field.readOnly === true, 'hiddenRequest.' + name + ' should be read only');
    need(problems, field && !constraintNamed(constraintsOf(field), 'required'), 'hiddenRequest.' + name + ' should be optional');
  });
  need(problems, fieldAt('dashboardSettings.hiddenRequest.requestedAt') && fieldAt('dashboardSettings.hiddenRequest.requestedAt').type === 'datetime', 'hiddenRequest.requestedAt should be a datetime');
  const kindField = fieldAt('dashboardSettings.hiddenRequest.kind');
  const allowed = kindField ? constraintNamed(constraintsOf(kindField), 'valid') : null;
  need(problems, allowed && allowed.args[0].join() === Object.keys(registry).join(), 'hiddenRequest.kind should only allow: ' + Object.keys(registry).join(', '));

  // The sample content carries the settings, with values the dashboard accepts, and never a push
  const sample = world.sample.settings;
  need(problems, typeof sample.hiddenEnabled === 'boolean', 'the sample settings need hiddenEnabled as true or false');
  Object.keys(registry).forEach(id => {
    const name = registry[id].chanceField;
    need(problems, sample[name] >= 0 && sample[name] <= 100, 'the sample settings need ' + name + ' from 0 to 100');
  });
  need(problems, !('hiddenRequest' in sample), 'the sample settings should not carry a hiddenRequest');

  // The Studio's list is the dashboard's registry: the same ids, names and chance fields, in the same order
  const copy = world.studioHidden.hiddenTransitions;
  const ids = Object.keys(registry);
  need(problems, ids.length > 0, 'the registry in dashboard/core/hidden-transitions.js has no transitions');
  need(problems, copy.length === ids.length, 'studio/hidden-transitions.js has ' + copy.length + ' transitions and the dashboard registry has ' + ids.length);
  ids.forEach((id, index) => {
    const entry = registry[id];
    need(problems, typeof entry.name === 'string' && entry.name !== '', 'the hidden transition "' + id + '" needs a name');
    need(problems, typeof entry.run === 'function', 'the hidden transition "' + id + '" needs a run function');
    const other = copy[index];
    if (!other || other.id !== id) return problems.push('hidden transition number ' + (index + 1) + ' is "' + id + '" in the dashboard registry but "' + (other && other.id) + '" in studio/hidden-transitions.js');
    need(problems, other.name === entry.name, 'the hidden transition "' + id + '" has name "' + entry.name + '" in the dashboard registry but "' + other.name + '" in studio/hidden-transitions.js');
    need(problems, other.chanceField === entry.chanceField, 'the hidden transition "' + id + '" has chance field "' + entry.chanceField + '" in the dashboard registry but "' + other.chanceField + '" in studio/hidden-transitions.js');
  });
  const offered = choicesOf('dashboardSettings.hiddenRequest.kind');
  need(problems, offered.map(item => item.title).join() === ids.map(id => registry[id].name).join(), 'hiddenRequest.kind should show the names in the dashboard registry');

  // The Play buttons come after the two content source buttons: one for each transition, plain functions, and only on this page.
  // Play announcements comes after them (checkPlayAnnouncements).
  const buttons = world.config.document.actions([], { schemaType: 'dashboardSettings' }).slice(2, 2 + Object.keys(registry).length);
  if (buttons.length !== ids.length || !buttons.every(button => typeof button === 'function')) {
    return problems.concat('the settings page should add one Play button for each hidden transition, written as plain functions');
  }
  need(problems, world.config.document.actions([], { schemaType: 'demo' }).every(button => !/^play/.test(button.action)), 'only the settings page should get the Play buttons');

  function press(button, published, draft) {
    globalThis.studioCalls = [];
    const props = { id: 'dashboardSettings', type: 'dashboardSettings', published: published, draft: draft || null, onComplete: () => {} };
    const state = button(props);
    if (!state.disabled) state.onHandle();
    return { state: state, calls: globalThis.studioCalls };
  }

  ids.forEach((id, index) => {
    const button = buttons[index];
    const label = 'Play ' + registry[id].name.toLowerCase();
    const before = Date.now();
    const pressed = press(button, null);
    const after = Date.now();
    const set = pressed.calls[0] && pressed.calls[0].patch && pressed.calls[0].patch[0] && pressed.calls[0].patch[0].set;
    const request = set && set.hiddenRequest;

    need(problems, pressed.state.label === label, 'the button for ' + id + ' should be labelled ' + label);
    need(problems, button.action === 'play' + id.charAt(0).toUpperCase() + id.slice(1), 'the button for ' + id + ' should be called play' + id.charAt(0).toUpperCase() + id.slice(1));
    need(problems, pressed.calls.length === 2 && pressed.calls[0].patch.length === 1 && Object.keys(set).join() === 'hiddenRequest' && pressed.calls[1].publish === true, label + ' should set hiddenRequest and then publish');
    need(problems, request && Object.keys(request).join() === 'kind,requestedAt' && request.kind === id, label + ' should write the kind ' + id);
    need(problems, request && typeof request.requestedAt === 'string' && new Date(request.requestedAt).toISOString() === request.requestedAt && Date.parse(request.requestedAt) >= before && Date.parse(request.requestedAt) <= after, label + ' should write the time now, as new Date().toISOString() writes it');
    need(problems, press(button, { hiddenRequest: { kind: id, requestedAt: '2026-06-01T12:00:00.000Z' } }).state.disabled === false, label + ' should be on when a push is already published, so it can be played again');
  });
  return problems;
}

// Play announcements: the hidden announceRequest field in the Announcements tab
// (schemas/settingsAnnouncements.js), its starting value in config.js, the button that
// fills it in (actions.js) and the Demo step that plays the same announcements
// (the registry in dashboard/core/demo-screens.js and the Studio's copy of it).
function checkPlayAnnouncements() {
  const problems = [];
  const config = world.dashboard;
  const settings = typeByName('dashboardSettings');
  const request = fieldAt('dashboardSettings.announceRequest');
  const time = fieldAt('dashboardSettings.announceRequest.requestedAt');

  // The field: an object with one read only time, hidden from editors, with no starting value of its own
  need(problems, request && request.type === 'object', 'announceRequest should be an object');
  need(problems, request && request.group === 'announcements', 'announceRequest should be in the Announcements tab');
  need(problems, request && request.hidden === true, 'announceRequest should be hidden from editors (hidden: true)');
  need(problems, request && request.initialValue === undefined, 'announceRequest should have no starting value in the Studio');
  need(problems, request && /Play announcements/.test(request.description || ''), 'the announceRequest description should name the button Play announcements');
  need(problems, time && time.type === 'datetime' && time.readOnly === true, 'announceRequest.requestedAt should be a read only datetime');
  need(problems, time && !constraintNamed(constraintsOf(time), 'required'), 'announceRequest.requestedAt should be optional');
  const inTab = fieldsIn(settings).filter(field => field.group === 'announcements').map(field => field.name);
  need(problems, inTab.join() === 'announcements,announceRequest', 'the Announcements tab should hold, in this order: announcements, announceRequest, not ' + inTab.join(', '));

  // The starting value is a request with no time, and the sample content never carries a request
  need(problems, sameData(config.defaultSettings.announceRequest, { requestedAt: '' }), 'the default announceRequest in config.js should be a time that is empty');
  need(problems, !('announceRequest' in world.sample.settings), 'the sample settings should not carry an announceRequest');

  // A Demo step can play the same announcements: the same id and name in the registry and in the Studio's copy
  const registry = world.demoRegistry.demoScreens;
  const copy = world.studioDemoScreens.demoScreens.filter(entry => entry.id === 'all-announcements')[0];
  need(problems, registry['all-announcements'] && registry['all-announcements'].name === 'All announcements', 'the dashboard demo screens should have all-announcements, named All announcements');
  need(problems, copy && copy.name === 'All announcements', 'studio/demo-screens.js should have all-announcements, named All announcements');

  // The button comes last on the settings page, after the Play buttons of the hidden transitions, and nowhere else
  const played = Object.keys(world.hiddenRegistry.hiddenTransitions).length;
  const buttons = world.config.document.actions([], { schemaType: 'dashboardSettings' });
  const button = buttons[2 + played];
  if (buttons.length !== 3 + played || typeof button !== 'function') {
    return problems.concat('the settings page should end with the Play announcements button, a plain function, after the Play buttons of the hidden transitions');
  }
  need(problems, world.config.document.actions([], { schemaType: 'demo' }).every(item => item.action !== 'playAnnouncements'), 'only the settings page should get the Play announcements button');

  function press(published, draft) {
    globalThis.studioCalls = [];
    const props = { id: 'dashboardSettings', type: 'dashboardSettings', published: published, draft: draft || null, onComplete: () => {} };
    const state = button(props);
    if (!state.disabled) state.onHandle();
    return { state: state, calls: globalThis.studioCalls };
  }

  // It writes the time now, only that, and publishes
  const before = Date.now();
  const pressed = press(null);
  const after = Date.now();
  const set = pressed.calls[0] && pressed.calls[0].patch && pressed.calls[0].patch[0] && pressed.calls[0].patch[0].set;
  const written = set && set.announceRequest;

  need(problems, pressed.state.label === 'Play announcements', 'the button should be labelled Play announcements');
  need(problems, button.action === 'playAnnouncements', 'the button should be called playAnnouncements');
  need(problems, pressed.calls.length === 2 && pressed.calls[0].patch.length === 1 && Object.keys(set).join() === 'announceRequest' && pressed.calls[1].publish === true, 'Play announcements should set announceRequest and then publish');
  need(problems, written && Object.keys(written).join() === 'requestedAt', 'Play announcements should write only requestedAt');
  need(problems, written && typeof written.requestedAt === 'string' && new Date(written.requestedAt).toISOString() === written.requestedAt && Date.parse(written.requestedAt) >= before && Date.parse(written.requestedAt) <= after, 'Play announcements should write the time now, as new Date().toISOString() writes it');
  need(problems, press({ announceRequest: { requestedAt: '2026-06-01T12:00:00.000Z' } }).state.disabled === false, 'Play announcements should be on when a request is already published, so it can be played again');
  return problems;
}

// Show connection status is a switch that starts off, in a Connection tab of
// its own. The connection status text comes up by itself when Sanity cannot be
// reached, whatever the switch says (dashboard/core/connection.js).
function checkConnectionStatus() {
  const problems = [];
  const field = fieldAt('dashboardSettings.showConnectionStatus');
  const tab = typeByName('dashboardSettings').groups.filter(group => group.name === 'connection')[0];

  need(problems, world.dashboard.defaultSettings.showConnectionStatus === false, 'the default showConnectionStatus in config.js should be false');
  need(problems, field && field.type === 'boolean' && field.initialValue === false, 'showConnectionStatus should be a switch that starts off');
  need(problems, field && field.title === 'Show connection status', 'showConnectionStatus should be titled Show connection status');
  need(problems, field && field.group === 'connection', 'showConnectionStatus should be in the Connection tab');
  need(problems, tab && tab.title === 'Connection', 'Dashboard Settings should have a tab named Connection (group connection)');
  return problems;
}

// The values a new Studio starts with are copies of the dashboard's defaults
function checkStartingValues() {
  const problems = [];
  const settings = world.dashboard.defaultSettings;
  const team = world.dashboard.defaultTeam;

  function expect(pathText, expected) {
    const field = fieldAt('dashboardSettings.' + pathText);
    const actual = field && field.initialValue;
    const message = pathText + ' starts as ' + JSON.stringify(actual) + ' but config.js says ' + JSON.stringify(expected);
    need(problems, sameData(actual, expected), message);
  }

  ['name', 'number', 'school'].forEach(name => expect('team.' + name, team[name]));
  expect('contentSource', settings.contentSource);
  expect('motion', settings.motion);
  expect('speed', settings.speed);
  expect('frameMetal', settings.frameMetal);
  expect('glint', settings.glint);
  expect('showConnectionStatus', settings.showConnectionStatus);
  expect('pageSeconds', settings.pageSeconds);
  logoSwitches.concat(logoNumbers, transitionNames, photoNames, nightNames, hiddenNames.slice(0, 3)).forEach(name => expect(name, settings[name]));
  expect('countdown.kickoffLabel', settings.countdown.kickoffLabel);
  expect('countdown.rolloutLabel', settings.countdown.rolloutLabel);
  expect('alert.on', settings.alert.on);
  expect('rotation.grid1', settings.rotation.grid1);
  expect('rotation.grid2', settings.rotation.grid2);
  expect('rotation.tickerSeconds', settings.rotation.tickerSeconds);
  expect('doneDays', settings.doneDays);
  expect('crt.on', settings.crt.on);
  expect('crt.everySeconds', settings.crt.everySeconds);
  expect('crt.durationSeconds', settings.crt.durationSeconds);
  expect('calendars', settings.calendars);

  // A missing show means on. The Studio writes it out so its switch shows on.
  expect('announcements', settings.announcements.map(item => Object.assign({ show: true }, item)));

  const kickoff = fieldAt('dashboardSettings.countdown.kickoff').initialValue;
  const kickoffOk = kickoff && localTime(kickoff) === settings.countdown.kickoff;
  need(problems, kickoffOk, 'countdown.kickoff should start at ' + settings.countdown.kickoff + ' in Holly Springs');
  if (fieldAt('dashboardSettings.countdown.rollout').initialValue) problems.push('countdown.rollout should start empty');
  if (fieldAt('dashboardSettings.switchBackAt').initialValue) problems.push('switchBackAt should start empty');
  return problems;
}

// Names in an object that no field of the schema carries
function unknownKeys(value, fields, where) {
  const problems = [];
  Object.keys(value).forEach(key => {
    const field = fields.filter(item => item.name === key)[0];
    if (!field) return problems.push(where + '.' + key + ' is read by the dashboard but the Studio has no such field');

    const inside = fieldsIn(field);
    const items = Array.isArray(value[key]) ? value[key] : [value[key]];
    items.forEach(item => {
      if (item && typeof item === 'object' && inside.length > 0) problems.push.apply(problems, unknownKeys(item, inside, where + '.' + key));
    });
  });
  return problems;
}

function checkDashboardNames() {
  const problems = [];
  const sample = world.sample;
  const settingsFields = fieldsIn(typeByName('dashboardSettings'));
  const add = list => problems.push.apply(problems, list);

  add(unknownKeys(Object.assign({ team: world.dashboard.defaultTeam }, world.dashboard.defaultSettings), settingsFields, 'config.js'));
  add(unknownKeys(Object.assign({ team: sample.team }, sample.settings), settingsFields, 'sample settings'));
  add(unknownKeys(sample.plan, fieldsIn(typeByName('plan')), 'sample plan'));
  add(unknownKeys(world.dashboard.defaultThemeSettings, fieldsIn(typeByName('theme')), 'defaultThemeSettings in config.js'));
  add(unknownKeys(sample.theme || {}, fieldsIn(typeByName('theme')), 'sample theme'));
  add(unknownKeys(world.dashboard.defaultDemo, fieldsIn(typeByName('demo')), 'defaultDemo in config.js'));
  add(unknownKeys(sample.demo || {}, fieldsIn(typeByName('demo')), 'sample demo'));

  const lists = { tasks: 'task', sponsors: 'sponsor', tipsAndNews: 'tipOrNews', subteams: 'subteam', people: 'person', extraEvents: 'extraEvent' };
  Object.keys(lists).forEach(key => {
    sample[key].forEach(item => add(unknownKeys(item, fieldsIn(typeByName(lists[key])), 'sample ' + key)));
  });

  sample.customPanels.forEach(panel => {
    add(unknownKeys(without(panel, 'blocks'), fieldsIn(typeByName('customPanel')), 'sample customPanels'));
    panel.blocks.forEach(block => {
      const type = typeByName(block.type + 'Block');
      if (!type) return problems.push('sample block type ' + block.type + ' has no block in the Studio');
      add(unknownKeys(without(block, 'type'), fieldsIn(type), 'sample ' + block.type + ' block'));
    });
  });
  return problems;
}

// A stand-in for the Studio's structure builder that writes down each call
function fakeBuilder() {
  const methods = ['title', 'id', 'child', 'items', 'schemaType', 'documentId', 'defaultOrdering'];
  function node(start) {
    const made = Object.assign({}, start);
    const builder = { made: made };
    methods.forEach(name => {
      builder[name] = value => {
        made[name] = value;
        return builder;
      };
    });
    return builder;
  }

  return {
    list: () => node({}),
    listItem: () => node({}),
    documentTypeList: type => node({ type: type }),
    document: () => node({}),
    divider: () => node({ divider: true }),
  };
}

// structure.js holds the whole sidebar as one list, sidebarEntries. Each line
// has to name a type that exists, and each kind of document has to have a
// line, or editors could not reach it. The order of the lines is not checked.
function checkSidebarLines(problems) {
  const entries = world.structure.sidebarEntries;
  const typeNames = world.types.map(type => type.name);
  const named = [];

  entries.forEach((entry, index) => {
    const line = 'structure.js line ' + (index + 1) + ' of sidebarEntries';
    if (entry.kind === 'divider') return;
    if (entry.kind !== 'list' && entry.kind !== 'page') return problems.push(line + ' has the kind "' + entry.kind + '". Use list, page or divider.');

    const where = line + ' ("' + entry.title + '")';
    if (!entry.title) problems.push(line + ' has no title');
    if (typeNames.indexOf(entry.type) === -1) return problems.push(where + ' names the type "' + entry.type + '", and schemas/index.js has no type with that name. Fix the spelling or remove the line.');

    if (named.indexOf(entry.type) !== -1) problems.push(where + ' repeats the type "' + entry.type + '", which already has a line in the sidebar');
    named.push(entry.type);

    if (entry.kind === 'page') {
      need(problems, pageTypes.indexOf(entry.type) !== -1, where + ' is a page, but "' + entry.type + '" is not one of the pages that exist once: ' + pageTypes.join(', '));
      need(problems, entry.id === entry.type, where + ' should open the document with id ' + entry.type + ', not ' + entry.id);
      return;
    }

    need(problems, pageTypes.indexOf(entry.type) === -1, where + ' is a list, but "' + entry.type + '" exists once and should be a page');
    const field = entry.sort && entry.sort.field;
    const sortable = field && (field.charAt(0) === '_' || fieldsIn(typeByName(entry.type)).some(item => item.name === field));
    need(problems, sortable, where + ' is sorted by "' + field + '", which is not a field of ' + entry.type);
    if (listSort[entry.type]) need(problems, field === listSort[entry.type], where + ' should be listed by ' + listSort[entry.type] + ', not ' + field);
  });

  world.types.filter(type => type.type === 'document').forEach(type => {
    const reason = notInSidebar[type.name];
    if (reason) return need(problems, named.indexOf(type.name) === -1, type.name + ' is listed in notInSidebar in check-schemas.mjs ("' + reason + '") and also has a line in structure.js. Remove one of the two.');
    need(problems, named.indexOf(type.name) !== -1, 'the document type "' + type.name + '" (' + type.title + ') has no line in the sidebar. Add a line for it to sidebarEntries in studio/structure.js, or, if editors should not see it there, list it in notInSidebar in studio/check-schemas.mjs with the reason.');
  });

  Object.keys(sidebarTitles).forEach(typeName => {
    const entry = entries.filter(item => item.type === typeName)[0];
    need(problems, !entry || entry.title === sidebarTitles[typeName], 'the sidebar line for ' + typeName + ' should be titled ' + sidebarTitles[typeName] + ', not ' + (entry && entry.title));
  });
}

function checkSidebar() {
  const problems = [];
  const entries = world.structure.sidebarEntries;
  if (!Array.isArray(entries) || entries.length === 0) return ['structure.js should export sidebarEntries, the one list that holds every line of the sidebar'];

  checkSidebarLines(problems);

  // What the Studio gets is those lines, in the same order, with the same sorting
  const items = world.structure.structure(fakeBuilder()).made.items.map(item => item.made);
  if (items.length !== entries.length) return problems.concat('structure() should make one sidebar item for each line of sidebarEntries (' + entries.length + '), it makes ' + items.length);

  entries.forEach((entry, index) => {
    const item = items[index];
    const child = item.child && item.child.made;
    const what = 'sidebar line ' + (index + 1) + ' ("' + (entry.title || entry.kind) + '")';

    if (entry.kind === 'divider') return need(problems, item.divider === true, what + ' should be a divider');
    if (item.title !== entry.title) return problems.push(what + ' should be titled ' + entry.title + ', it is ' + item.title);

    if (entry.kind === 'list') {
      const listOk = child && child.type === entry.type && child.title === entry.title && child.defaultOrdering[0].field === entry.sort.field;
      need(problems, listOk, what + ' should open the ' + entry.type + ' list, titled ' + entry.title + ', sorted by ' + entry.sort.field);
    } else {
      const pageOk = child && child.schemaType === entry.type && child.documentId === entry.id;
      need(problems, pageOk, what + ' should open the one document with id ' + entry.id);
    }
  });
  return problems;
}

function checkSettingsPage() {
  const problems = [];
  // The content source buttons are added to the settings page after the ones Studio keeps
  const actions = ['publish', 'discardChanges', 'delete', 'duplicate', 'unpublish'].map(action => ({ action: action }));
  const kept = world.config.document.actions(actions, { schemaType: 'dashboardSettings' }).map(item => item.action).join();
  const others = world.config.document.actions(actions, { schemaType: 'task' }).length;
  const wanted = 'publish,discardChanges,useSampleContent,useProductionContent,playDesktop,playRedEyes,playAnnouncements';
  if (kept !== wanted) problems.push('the settings page should have these actions: ' + wanted + '. It has: ' + kept);
  if (others !== actions.length) problems.push('other types should keep every action');

  // The Theme page is made the same way: nothing that copies it or takes it away, and no buttons of its own
  const themeActions = world.config.document.actions(actions, { schemaType: 'theme' }).map(item => item.action).join();
  if (themeActions !== 'publish,discardChanges') problems.push('the Theme page should have these actions: publish,discardChanges. It has: ' + themeActions);

  // The Demo page is the same, with its two buttons (checkDemo looks at them)
  const demoActions = world.config.document.actions(actions, { schemaType: 'demo' }).map(item => item.action).join();
  if (demoActions !== 'publish,discardChanges,runDemo,stopDemo') problems.push('the Demo page should have these actions: publish,discardChanges,runDemo,stopDemo. It has: ' + demoActions);

  const templates = [{ templateId: 'task' }, { templateId: 'dashboardSettings' }, { templateId: 'theme' }, { templateId: 'demo' }];
  const offered = world.config.document.newDocumentOptions(templates, {}).map(item => item.templateId).join();
  if (offered !== 'task') problems.push('the New menu should not offer Dashboard Settings, Theme or Demo');

  const named = world.structure.settingsType === 'dashboardSettings' && world.structure.settingsId === 'dashboardSettings';
  need(problems, named, 'structure.js should name the settings type and id dashboardSettings');
  const themeNamed = world.structure.themeType === 'theme' && world.structure.themeId === 'theme';
  need(problems, themeNamed, 'structure.js should name the theme type and id theme');
  const demoNamed = world.structure.demoType === 'demo' && world.structure.demoId === 'demo';
  need(problems, demoNamed, 'structure.js should name the demo type and id demo');
  need(problems, world.structure.singletonTypes.join() === 'dashboardSettings,theme,demo', 'structure.js should list the pages that exist once: dashboardSettings, theme, demo');
  if (world.config.schema.types.length !== world.types.length) problems.push('sanity.config.js does not use every schema');
  const agree = world.cli.api.projectId === world.config.projectId && world.cli.api.dataset === world.config.dataset;
  need(problems, agree, 'sanity.cli.js and sanity.config.js disagree about the project');

  // The Studio and the dashboard must talk about the same project and dataset
  const screen = world.dashboard.sanity;
  need(problems, /^[a-z0-9]{8,}$/.test(world.config.projectId), 'project.js should hold the Sanity project ID, lowercase letters and digits');
  need(problems, screen.projectId === world.config.projectId, 'dashboard/config.js has project ID "' + screen.projectId + '" but project.js has "' + world.config.projectId + '"');
  need(problems, screen.dataset === world.config.dataset, 'dashboard/config.js has dataset "' + screen.dataset + '" but project.js has "' + world.config.dataset + '"');
  need(problems, typeof world.dashboard.useSampleContent === 'boolean', 'useSampleContent in dashboard/config.js should be true or false');
  return problems;
}

// The Photo type and the Photos tab. A photo has a picture (required, images
// only, crop and hotspot on, checked with the contract above), an optional
// short caption, a credit that is a first name only, a show switch and an
// optional expiry, and no approval field. The tab has the order and the seconds
// per photo, with the names, limits and starting values of config.js, and the
// sample content has a photo list the Photo panel can show.
function checkPhotos() {
  const problems = [];
  const config = world.dashboard;
  const at = name => fieldAt('photo.' + name);
  const setting = name => fieldAt('dashboardSettings.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);
  const type = typeByName('photo');

  need(problems, type && type.title === 'Photo', 'the photo type should be titled Photo');
  need(problems, at('image') && constraintNamed(rulesOf(at('image')), 'required'), 'photo.image should be required');
  need(problems, at('image') && at('image').title === 'Picture', 'photo.image should be titled Picture');

  // The caption and the credit are optional
  ['caption', 'credit'].forEach(name => {
    need(problems, at(name) && !constraintNamed(rulesOf(at(name)), 'required'), 'photo.' + name + ' should be optional');
    need(problems, at(name) && /optional/i.test(at(name).description || ''), 'the photo.' + name + ' description should say it is optional');
  });
  need(problems, at('caption') && /last name/i.test(at('caption').description || ''), 'the photo.caption description should say no last names');

  // The credit is a first name: a space or a digit is refused with a message, a hyphen is fine
  const custom = constraintNamed(rulesOf(at('credit')), 'custom');
  if (!custom) {
    problems.push('photo.credit should be checked so that it is a first name only');
  } else {
    const run = custom.args[0];
    ['Sam', 'Mary-Anne', "O'Neil", 'Zoë', '', undefined].forEach(good => need(problems, run(good) === true, 'the credit check refuses "' + good + '"'));
    ['Sam Smith', 'Sam2', '7', ' Sam', 'Sam '].forEach(bad => {
      const answer = run(bad);
      need(problems, typeof answer === 'string' && answer.length > 0, 'the credit check accepts "' + bad + '"');
    });
  }
  need(problems, at('credit') && /first name/i.test(at('credit').description || ''), 'the photo.credit description should say first name');

  // No approval of any kind: the show switch and the expiry date are the only controls
  const names = fieldsIn(type || {}).map(field => field.name);
  need(problems, !names.some(name => /approv|status|review/i.test(name)), 'a photo should have no approval field, not ' + names.join(', '));

  const newest = (type.orderings || []).some(item => item.by && item.by[0].field === '_createdAt' && item.by[0].direction === 'desc');
  need(problems, newest, 'photo needs an ordering by _createdAt, newest first');
  need(problems, type.preview && type.preview.select && type.preview.select.media === 'image', 'the photo list should show each picture (select media: image)');

  // The Photos tab holds the two settings, in this order, and nothing else
  const settings = typeByName('dashboardSettings');
  need(problems, settings.groups.filter(group => group.name === 'photos' && group.title === 'Photos').length === 1, 'Dashboard Settings should have one tab named Photos (group photos)');
  const inTab = fieldsIn(settings).filter(field => field.group === 'photos').map(field => field.name);
  need(problems, inTab.join() === photoNames.join(), 'the Photos tab should hold, in this order: ' + photoNames.join(', ') + ', not ' + inTab.join(', '));
  need(problems, setting('photoOrder') && setting('photoOrder').title === 'Photo order', 'photoOrder should be titled Photo order');
  need(problems, setting('photoSeconds') && setting('photoSeconds').title === 'Seconds per photo', 'photoSeconds should be titled Seconds per photo');

  // The order is a radio list of the names in config.js, required, and random to start with
  const order = setting('photoOrder');
  const orderRules = rulesOf(order);
  const allowed = constraintNamed(orderRules, 'valid');
  need(problems, config.photoOrders.join() === 'random,newest-first', 'photoOrders in config.js should be random and newest-first, not ' + config.photoOrders.join());
  need(problems, order && order.options && order.options.layout === 'radio', 'photoOrder should be a radio list');
  need(problems, choicesOf('dashboardSettings.photoOrder').map(item => item.value).join() === config.photoOrders.join(), 'photoOrder should offer the names in config.js: ' + config.photoOrders.join(', '));
  need(problems, constraintNamed(orderRules, 'required'), 'photoOrder should be required');
  need(problems, allowed && allowed.args[0].join() === config.photoOrders.join(), 'photoOrder should only allow: ' + config.photoOrders.join(', '));
  need(problems, config.defaultSettings.photoOrder === 'random', 'the default photoOrder in config.js should be random');

  // A row in the Panels list with no seconds of its own: the Photo row follows Seconds per photo
  need(problems, setting('photoSeconds') && /Panels/.test(setting('photoSeconds').description || ''), 'the photoSeconds description should say that a row in Panels with its own seconds wins');

  // The sample content carries the settings and a list of photos with addresses
  const sample = world.sample;
  need(problems, config.photoOrders.indexOf(sample.settings.photoOrder) !== -1, 'the sample settings need a photoOrder of ' + config.photoOrders.join(' or '));
  const limit = config.limits.photoSeconds;
  need(problems, sample.settings.photoSeconds >= limit.min && sample.settings.photoSeconds <= limit.max, 'the sample settings need photoSeconds from ' + limit.min + ' to ' + limit.max);
  need(problems, Array.isArray(sample.photos) && sample.photos.length > 0, 'the sample content needs a photos list for the Photo panel');
  (sample.photos || []).forEach((photo, index) => {
    need(problems, typeof photo.address === 'string' && photo.address.length > 0, 'sample photo ' + (index + 1) + ' needs an address');
    Object.keys(photo).forEach(key => need(problems, ['address', 'caption', 'credit'].indexOf(key) !== -1, 'sample photo ' + (index + 1) + ' has ' + key + ', which the sample photos do not use'));
  });
  return problems;
}

// The members of a subteam are first names for the Subteam roster panel. Each
// one is needed, has no digits and stops at 12 characters, the list stops at
// 24 and refuses the same name twice in any capitals, and it starts empty.
// The sample subteams have to follow the same rules.
function checkSubteamMembers() {
  const problems = [];
  const field = fieldAt('subteam.members');
  if (!field) return ['subteam.members is missing'];

  const member = field.of && field.of[0];
  const eachRules = member ? constraintsOf(member) : [];
  const listRules = constraintsOf(field);
  const eachCheck = constraintNamed(eachRules, 'custom');
  const listCheck = constraintNamed(listRules, 'custom');

  need(problems, constraintNamed(eachRules, 'required'), 'each member should be required, so an empty line is refused');
  need(problems, Array.isArray(field.initialValue) && field.initialValue.length === 0, 'subteam.members should start as an empty list');
  need(problems, /first names/i.test(field.description || ''), 'the subteam.members description should say first names only');
  need(problems, /drag/i.test(field.description || ''), 'the subteam.members description should say that the order can be changed by dragging');
  need(problems, constraintNamed(listRules, 'required') === undefined, 'subteam.members should be optional');

  if (!eachCheck) {
    problems.push('each member should be checked: no digits, and not only spaces');
  } else {
    const run = eachCheck.args[0];
    ['Sam', 'Mary Anne', "O'Neil", 'Zoë', 'Sam K.', '[Student A]'].forEach(good => need(problems, run(good) === true, 'the member check refuses "' + good + '"'));
    ['Sam2', '7', '   ', ''].forEach(bad => need(problems, typeof run(bad) === 'string' && run(bad).length > 0, 'the member check accepts "' + bad + '"'));
  }

  if (!listCheck) {
    problems.push('the list of members should be checked for the same name twice');
  } else {
    const run = listCheck.args[0];
    [undefined, [], ['Sam'], ['Sam', 'Alex'], ['Sam', '', 'Alex']].forEach(good => need(problems, run(good) === true, 'the repeat check refuses ' + JSON.stringify(good)));
    [['Sam', 'sam'], ['Sam', ' SAM '], ['Alex', 'Sam', 'alex']].forEach(bad => need(problems, typeof run(bad) === 'string' && run(bad).length > 0, 'the repeat check accepts ' + JSON.stringify(bad)));
  }

  // The list in the Studio shows how many members a subteam has
  const preview = typeByName('subteam').preview;
  need(problems, preview.select.members === 'members', 'the subteam list should select the members');
  need(problems, preview.prepare({ title: 'Build', members: ['a', 'b', 'c'] }).subtitle.indexOf('3 members') !== -1, 'the subteam list should say how many members');
  need(problems, preview.prepare({ title: 'Build', members: ['a'] }).subtitle.indexOf('1 member') !== -1, 'the subteam list should say 1 member');
  need(problems, preview.prepare({ title: 'Build', members: [] }).subtitle.indexOf('member') === -1, 'the subteam list should not mention members when there are none');

  // The sample content follows the same rules as the Studio
  world.sample.subteams.forEach(subteam => {
    const names = subteam.members || [];
    need(problems, names.length <= 24, 'sample subteam ' + subteam.name + ' has more than 24 members');
    names.forEach(name => need(problems, name.length <= 12 && (!eachCheck || eachCheck.args[0](name) === true), 'sample member ' + name + ' breaks the Members rules'));
    need(problems, !listCheck || listCheck.args[0](names) === true, 'sample subteam ' + subteam.name + ' has the same member twice');
  });
  return problems;
}

// A person's photo and its switch. The photo is optional, its description has
// the advice for the people who upload, the switch starts at the value
// defaultPerson has in config.js, and the sample people have no photos.
function checkPersonPhoto() {
  const problems = [];
  const photo = fieldAt('person.photo');
  const shown = fieldAt('person.showPhoto');
  const words = photo ? (photo.description || '').toLowerCase() : '';
  const defaultPerson = world.dashboard.defaultPerson || {};

  need(problems, photo && photo.title === 'Photo', 'person.photo should be titled Photo');
  need(problems, photo && !constraintNamed(constraintsOf(photo), 'required'), 'person.photo should be optional, so a person can have no photo');
  ['square', 'plain background', 'first name'].forEach(advice => {
    need(problems, words.indexOf(advice) !== -1, 'the person.photo description should say "' + advice + '"');
  });

  need(problems, shown && shown.type === 'boolean' && shown.title === 'Show photo on screen', 'person.showPhoto should be a switch titled Show photo on screen');
  need(problems, shown && shown.initialValue === true, 'person.showPhoto should start on');
  need(problems, shown && defaultPerson.showPhoto === shown.initialValue, 'defaultPerson.showPhoto in config.js should be the same as the starting value of person.showPhoto');

  const preview = typeByName('person').preview;
  need(problems, preview && preview.select && preview.select.media === 'photo', 'the person list should show each photo (select media: photo)');
  need(problems, world.sample.people.every(person => person.photo === undefined), 'the sample people should have no photo, so the sample shows silhouettes');
  return problems;
}

// The lists of themes and overlays, one entry at a time. The Studio's copy
// (themes.js) must say the same as the dashboard's registries, because the
// editors pick from the Studio's list and the screen looks the ids up in its own.
function sameRegistry(name, dashboardList, studioList, problems) {
  need(problems, studioList.length === dashboardList.length, 'studio/themes.js has ' + studioList.length + ' ' + name + ' and the dashboard registry has ' + dashboardList.length);

  dashboardList.forEach((entry, index) => {
    const copy = studioList[index];
    if (!copy) return problems.push('studio/themes.js is missing the ' + name + ' "' + entry.id + '"');

    ['id', 'name', 'description'].forEach(key => {
      if (copy[key] !== entry[key]) problems.push('the ' + name + ' number ' + (index + 1) + ' has ' + key + ' "' + copy[key] + '" in studio/themes.js but "' + entry[key] + '" in the dashboard registry');
    });
  });
}

function checkThemeLists() {
  const problems = [];
  sameRegistry('themes', world.themeRegistry.themes, world.studioThemes.themes, problems);
  sameRegistry('overlays', world.overlayRegistry.overlays, world.studioThemes.overlays, problems);

  // What the editors are offered is the dashboard's list, in the same order, in plain words
  const themeIds = world.themeRegistry.themes.map(entry => entry.id);
  const overlayIds = world.overlayRegistry.overlays.map(entry => entry.id);
  const lists = [
    ['theme.defaultTheme', themeIds],
    ['theme.useNow.theme', themeIds],
    ['theme.useNow.overlay', overlayIds.concat('none')],
    ['theme.schedule.theme', themeIds],
    ['theme.schedule.overlay', overlayIds],
    ['theme.schedule.kind', ['theme', 'overlay']],
  ];
  lists.forEach(entry => {
    const list = choicesOf(entry[0]);
    if (list.map(item => item.value).join() !== entry[1].join()) problems.push(entry[0] + ' should offer: ' + entry[1].join(', '));
    list.forEach(item => need(problems, isPlainTitle(item), entry[0] + ': "' + item.title + '" is not a plain-words title'));
  });

  const shown = choicesOf('theme.defaultTheme').map(item => item.title).join();
  need(problems, shown === world.themeRegistry.themes.map(entry => entry.name).join(), 'theme.defaultTheme should show the names in the dashboard registry');
  return problems;
}

// The Theme page. The Studio and dashboard/config.js agree on the starting
// values, a rule has to have a start and an end, and the time zone is checked.
function checkTheme() {
  const problems = [];
  const defaults = world.dashboard.defaultThemeSettings;
  const at = name => fieldAt('theme.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);

  // The starting values
  need(problems, world.themeRegistry.themes.some(entry => entry.id === defaults.defaultTheme), 'the default theme in config.js should be one of the themes in the dashboard registry');
  need(problems, at('defaultTheme') && at('defaultTheme').initialValue === defaults.defaultTheme, 'theme.defaultTheme should start as ' + defaults.defaultTheme + ', as in config.js');
  need(problems, at('timeZone') && at('timeZone').initialValue === defaults.timeZone, 'theme.timeZone should start as ' + defaults.timeZone + ', as in config.js');
  need(problems, defaults.timeZone === 'America/New_York', 'the default time zone in config.js should be America/New_York');
  need(problems, sameData(defaults.useNow, { theme: '', overlay: '', until: '' }), 'useNow in config.js should be empty');
  need(problems, sameData(defaults.schedule, []), 'the schedule in config.js should be empty');
  need(problems, !at('schedule').initialValue && !at('useNow').initialValue, 'theme.useNow and theme.schedule should start empty');
  need(problems, sameData(world.sample.theme, defaults), 'the sample content should carry the theme settings in config.js');

  // Default theme: required, and only the registry's themes
  const defaultRules = rulesOf(at('defaultTheme'));
  need(problems, constraintNamed(defaultRules, 'required'), 'theme.defaultTheme should be required');
  const allowed = constraintNamed(defaultRules, 'valid');
  need(problems, allowed && allowed.args[0].join() === world.themeRegistry.themes.map(entry => entry.id).join(), 'theme.defaultTheme should only allow the themes in the registry');

  // Use a theme now: everything is optional, Until has a smallest and a largest time
  ['useNow.theme', 'useNow.overlay', 'useNow.until'].forEach(name => {
    const field = at(name);
    need(problems, field && !constraintNamed(rulesOf(field), 'required'), 'theme.' + name + ' should be optional');
    need(problems, field && /optional/i.test(field.description || ''), 'the theme.' + name + ' description should say it is optional');
  });
  const untilRules = rulesOf(at('useNow.until'));
  need(problems, constraintNamed(untilRules, 'min') && constraintNamed(untilRules, 'max'), 'theme.useNow.until should have a smallest and a largest time');

  // A rule has a start and an end, and both are limited to 2020 to 2099
  ['startDate', 'endDate'].forEach(name => {
    const rules = rulesOf(at('schedule.' + name));
    const low = constraintNamed(rules, 'min');
    const high = constraintNamed(rules, 'max');
    need(problems, constraintNamed(rules, 'required'), 'theme.schedule.' + name + ' should be required, so a rule always has a start and an end');
    need(problems, low && high && low.args[0] === '2020-01-01' && high.args[0] === '2099-12-31', 'theme.schedule.' + name + ' should allow 2020-01-01 to 2099-12-31');
  });
  need(problems, constraintNamed(rulesOf(at('schedule.name')), 'required'), 'theme.schedule.name should be required');
  need(problems, constraintNamed(rulesOf(at('schedule.kind')), 'required'), 'theme.schedule.kind should be required');
  const repeats = at('schedule.repeatsEveryYear');
  need(problems, repeats && repeats.initialValue === false && repeats.title === 'Repeats every year', 'theme.schedule.repeatsEveryYear should be a switch titled Repeats every year that starts off');

  // The theme and the overlay of a rule show only for their kind, and are required for it
  const rule = (kind, value) => ({ parent: { kind: kind }, value: value });
  ['theme', 'overlay'].forEach(kind => {
    const other = kind === 'theme' ? 'overlay' : 'theme';
    const field = at('schedule.' + kind);
    const custom = constraintNamed(rulesOf(field), 'custom');

    need(problems, field && field.hidden && field.hidden(rule(other)) === true && field.hidden(rule(kind)) === false, 'theme.schedule.' + kind + ' should show only when the kind is ' + kind);
    if (!custom) return problems.push('theme.schedule.' + kind + ' should be required when the kind is ' + kind);

    need(problems, typeof custom.args[0](undefined, { parent: { kind: kind } }) === 'string', 'a rule of kind ' + kind + ' with no ' + kind + ' picked should be refused');
    need(problems, custom.args[0]('picked', { parent: { kind: kind } }) === true, 'a rule of kind ' + kind + ' with a ' + kind + ' picked should be accepted');
    need(problems, custom.args[0](undefined, { parent: { kind: other } }) === true, 'a rule of kind ' + other + ' should not need a ' + kind);
  });

  // An end before the start is refused unless the rule repeats every year
  const member = at('schedule').of[0];
  const endCheck = constraintNamed(constraintsOf(member), 'custom');
  if (!endCheck) {
    problems.push('a schedule rule should check that its end is not before its start');
  } else {
    const run = rule => endCheck.args[0](rule);
    const dates = (start, end, repeats) => ({ startDate: start, endDate: end, repeatsEveryYear: repeats });

    need(problems, typeof run(dates('2026-12-20', '2026-12-01', false)) === 'string', 'a rule that does not repeat should not end before it starts');
    need(problems, run(dates('2026-12-20', '2027-01-05', false)) === true, 'a rule that does not repeat may run over New Year');
    need(problems, run(dates('2026-12-20', '2026-12-20', false)) === true, 'a rule may start and end on the same day');
    need(problems, run(dates('2026-12-20', '2026-01-05', true)) === true, 'a rule that repeats every year may end before it starts, to run over New Year');
    need(problems, run(dates('2026-12-20', undefined, false)) === true && run(undefined) === true, 'a rule with no end yet is left to the required check');
  }

  // The time zone: a name Intl knows. Browsers that cannot list the names get a plain pattern.
  const zone = constraintNamed(rulesOf(at('timeZone')), 'custom');
  need(problems, constraintNamed(rulesOf(at('timeZone')), 'required'), 'theme.timeZone should be required');
  if (!zone) {
    problems.push('theme.timeZone should be checked against the time zones Intl knows');
  } else {
    const run = zone.args[0];
    ['America/New_York', 'America/Chicago', 'Europe/London', 'UTC', ''].forEach(good => {
      need(problems, run(good) === true, 'the time zone check refuses "' + good + '"');
    });
    ['Nowhere/Land', 'new york', 'America/New York', 'EST5EDT now'].forEach(bad => {
      need(problems, typeof run(bad) === 'string', 'the time zone check accepts "' + bad + '"');
    });

    const supported = Intl.supportedValuesOf;
    try {
      Intl.supportedValuesOf = undefined;
      ['America/New_York', 'Etc/GMT+5', 'UTC'].forEach(good => need(problems, run(good) === true, 'with no Intl list, the time zone pattern refuses "' + good + '"'));
      ['new york', 'America/', '/New_York', 'a b'].forEach(bad => need(problems, typeof run(bad) === 'string', 'with no Intl list, the time zone pattern accepts "' + bad + '"'));
    } finally {
      Intl.supportedValuesOf = supported;
    }
  }
  return problems;
}

// Events Calendar: events that are not on BAND. The title, start date and
// show switch are asked for, the rest is optional, the end date may not come
// before the start date, and an end time needs a start time. The seed file in
// docs/seed has to be something `sanity dataset import --missing` can load
// twice with no change: fixed ids, real fields and values the Studio accepts.
// The screens a demo can show, one at a time. The Studio's copy
// (demo-screens.js) must say the same as the dashboard's registry, because the
// editors pick from the Studio's list and the screen looks the id up in its own.
function checkDemoScreens() {
  const problems = [];
  const registry = world.demoRegistry.demoScreens;
  const ids = Object.keys(registry);
  const copy = world.studioDemoScreens.demoScreens;

  need(problems, ids.length > 0, 'the registry in dashboard/core/demo-screens.js has no screens');
  need(problems, copy.length === ids.length, 'studio/demo-screens.js has ' + copy.length + ' screens and the dashboard registry has ' + ids.length);
  need(problems, new Set(copy.map(entry => entry.id)).size === copy.length, 'studio/demo-screens.js lists a screen twice');

  ids.forEach((id, index) => {
    const entry = registry[id];
    need(problems, typeof entry.name === 'string' && entry.name !== '', 'the dashboard demo screen "' + id + '" needs a name');
    need(problems, typeof entry.run === 'function', 'the dashboard demo screen "' + id + '" needs a run function');

    const other = copy[index];
    if (!other) return problems.push('studio/demo-screens.js is missing the demo screen "' + id + '"');
    if (other.id !== id) problems.push('demo screen number ' + (index + 1) + ' has id "' + id + '" in the dashboard registry but "' + other.id + '" in studio/demo-screens.js');
    if (other.name !== entry.name) problems.push('the demo screen "' + id + '" has name "' + entry.name + '" in the dashboard registry but "' + other.name + '" in studio/demo-screens.js');
  });

  // What the editors are offered on a step is the registry's list, in order, in plain words
  const offered = choicesOf('demo.steps.screen');
  need(problems, offered.map(item => item.value).join() === ids.join(), 'demo.steps.screen should offer: ' + ids.join(', '));
  need(problems, offered.map(item => item.title).join() === ids.map(id => registry[id].name).join(), 'demo.steps.screen should show the names in the dashboard registry');

  const screen = fieldAt('demo.steps.screen');
  const allowed = screen ? constraintNamed(constraintsOf(screen), 'valid') : null;
  need(problems, allowed && allowed.args[0].join() === ids.join(), 'demo.steps.screen should only allow: ' + ids.join(', '));
  return problems;
}

// The Demo page. The Studio and dashboard/config.js agree on the starting
// values and the limits, Requested at is read only because the buttons fill it
// in, and Run demo and Stop demo do what they say. The sample content carries
// the same starting values.
function checkDemo() {
  const problems = [];
  const config = world.dashboard;
  const defaults = config.defaultDemo;
  const at = name => fieldAt('demo.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);

  // The starting values
  need(problems, at('steps') && sameData(at('steps').initialValue, defaults.steps), 'demo.steps should start as ' + JSON.stringify(defaults.steps) + ', as in config.js');
  need(problems, defaults.steps.length === 2 && defaults.steps[0].screen === 'announcement' && defaults.steps[1].screen === 'night-mode', 'defaultDemo in config.js should start with the announcement and then night mode');
  need(problems, defaults.steps.every(step => step.seconds === config.demoDefaultSeconds), 'every starting step should last demoDefaultSeconds, ' + config.demoDefaultSeconds);
  need(problems, defaults.requestedAt === '' && defaults.announcementText === '', 'defaultDemo in config.js should have no request and no announcement text');
  need(problems, at('requestedAt') && at('requestedAt').initialValue === undefined, 'demo.requestedAt should start empty');
  need(problems, at('announcementText') && at('announcementText').initialValue === undefined, 'demo.announcementText should start empty, so the screen uses the first announcement');
  need(problems, /^\[.+\]$/.test(config.demoPlaceholderText), 'demoPlaceholderText in config.js should be marked with square brackets');
  need(problems, sameData(world.sample.demo, defaults), 'the sample content should carry the demo settings in config.js');

  // Requested at is filled in by Run demo and cleared by Stop demo
  need(problems, at('requestedAt') && at('requestedAt').readOnly === true, 'demo.requestedAt should be read only');
  need(problems, !constraintNamed(rulesOf(at('requestedAt')), 'required'), 'demo.requestedAt should be optional, because Stop demo clears it');

  // The announcement text is optional
  need(problems, !constraintNamed(rulesOf(at('announcementText')), 'required'), 'demo.announcementText should be optional');
  need(problems, at('announcementText') && /optional/i.test(at('announcementText').description || ''), 'the demo.announcementText description should say it is optional');
  need(problems, at('announcementText') && at('announcementText').title === 'Demo announcement text', 'demo.announcementText should be titled Demo announcement text');

  // The steps: a list of at most demoMaxSteps, each with a screen and the seconds in the limits
  const listLimit = constraintNamed(rulesOf(at('steps')), 'max');
  need(problems, listLimit && listLimit.args[0] === config.demoMaxSteps, 'demo.steps should allow demoMaxSteps steps, ' + config.demoMaxSteps);
  need(problems, config.limits.demoSeconds && config.limits.demoSeconds.min === 5 && config.limits.demoSeconds.max === 300, 'limits.demoSeconds in config.js should be 5 to 300');

  const seconds = at('steps.seconds');
  const secondsRules = rulesOf(seconds);
  const low = constraintNamed(secondsRules, 'min');
  const high = constraintNamed(secondsRules, 'max');
  need(problems, seconds && seconds.initialValue === config.demoDefaultSeconds, 'demo.steps.seconds should start as ' + config.demoDefaultSeconds);
  need(problems, low && high && low.args[0] === config.limits.demoSeconds.min && high.args[0] === config.limits.demoSeconds.max, 'demo.steps.seconds should have the limits in config.js, ' + JSON.stringify(config.limits.demoSeconds));
  need(problems, constraintNamed(secondsRules, 'integer'), 'demo.steps.seconds should be whole seconds');
  need(problems, constraintNamed(secondsRules, 'required'), 'demo.steps.seconds should be required');
  need(problems, constraintNamed(rulesOf(at('steps.screen')), 'required'), 'demo.steps.screen should be required');

  // The two buttons: plain functions on the Demo page and nowhere else
  const buttons = world.config.document.actions([], { schemaType: 'demo' });
  if (buttons.length !== 2 || !buttons.every(button => typeof button === 'function')) {
    return problems.concat('the Demo page should add two actions, written as plain functions');
  }

  function press(button, published, draft) {
    globalThis.studioCalls = [];
    const props = { id: 'demo', type: 'demo', published: published, draft: draft || null, onComplete: () => {} };
    const state = button(props);
    if (!state.disabled) state.onHandle();
    return { state: state, calls: globalThis.studioCalls };
  }

  const run = buttons[0];
  const stop = buttons[1];
  const asked = '2026-06-01T12:00:00.000Z';
  need(problems, run({ published: null, draft: null }).label === 'Run demo', 'the first Demo action should be labelled Run demo');
  need(problems, stop({ published: null, draft: null }).label === 'Stop demo', 'the second Demo action should be labelled Stop demo');

  // Run demo writes the time now and publishes
  const before = Date.now();
  const ran = press(run, null);
  const after = Date.now();
  const stamp = ran.calls[0] && ran.calls[0].patch && ran.calls[0].patch[0] && ran.calls[0].patch[0].set ? ran.calls[0].patch[0].set.requestedAt : '';
  need(problems, ran.calls.length === 2 && JSON.stringify(Object.keys(ran.calls[0].patch[0].set)) === '["requestedAt"]' && ran.calls[1].publish === true, 'Run demo should set requestedAt and then publish');
  need(problems, typeof stamp === 'string' && new Date(stamp).toISOString() === stamp && Date.parse(stamp) >= before && Date.parse(stamp) <= after, 'Run demo should set requestedAt to the time now, as new Date().toISOString() writes it');
  need(problems, press(run, { requestedAt: asked }).state.disabled === false, 'Run demo should be on when a request is already published, so it can be run again');

  // Stop demo clears it and publishes, and is off when there is nothing to clear
  const stopped = press(stop, { requestedAt: asked });
  need(problems, JSON.stringify(stopped.calls) === JSON.stringify([{ patch: [{ unset: ['requestedAt'] }] }, { publish: true }]), 'Stop demo should clear requestedAt and then publish');
  need(problems, press(stop, null).state.disabled === true, 'Stop demo should be off when nothing is published yet');
  need(problems, press(stop, { steps: [] }).state.disabled === true, 'Stop demo should be off when no demo has been asked for');
  need(problems, press(stop, null, { requestedAt: asked }).state.disabled === false, 'Stop demo should be on when the draft has a request');
  need(problems, press(stop, { requestedAt: asked }, { steps: [] }).state.disabled === false, 'Stop demo should be on when a request is published, even if the draft has none');
  return problems;
}

function checkExtraEvents() {
  const problems = [];
  const at = name => fieldAt('extraEvent.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);

  ['title', 'startDate'].forEach(name => {
    need(problems, constraintNamed(rulesOf(at(name)), 'required'), 'extraEvent.' + name + ' should be required');
  });
  ['endDate', 'startTime', 'endTime', 'location'].forEach(name => {
    need(problems, at(name) && !constraintNamed(rulesOf(at(name)), 'required'), 'extraEvent.' + name + ' should be optional');
    need(problems, at(name) && /optional/i.test(at(name).description || ''), 'the extraEvent.' + name + ' description should say it is optional');
  });

  const show = at('show');
  need(problems, show && show.type === 'boolean' && show.title === 'Show on screen' && show.initialValue === true, 'extraEvent.show should be a switch titled Show on screen that starts on');
  need(problems, !at('expires'), 'extraEvent should have no Hide after field: the dashboard drops a finished event itself');

  // Both dates are limited to 2020 to 2099, like the dates in the Theme schedule
  ['startDate', 'endDate'].forEach(name => {
    const rules = rulesOf(at(name));
    const low = constraintNamed(rules, 'min');
    const high = constraintNamed(rules, 'max');
    need(problems, low && high && low.args[0] === '2020-01-01' && high.args[0] === '2099-12-31', 'extraEvent.' + name + ' should allow 2020-01-01 to 2099-12-31');
  });

  // The end date is not before the start date, and may be empty
  const endDate = constraintNamed(rulesOf(at('endDate')), 'custom');
  if (!endDate) {
    problems.push('extraEvent.endDate should be checked so that it is not before the start date');
  } else {
    const run = (value, start) => endDate.args[0](value, { document: { startDate: start } });
    need(problems, typeof run('2027-04-01', '2027-04-02') === 'string', 'an end date before the start date should be refused');
    need(problems, run('2027-04-02', '2027-04-02') === true && run('2027-04-04', '2027-04-02') === true, 'an end date on or after the start date should be accepted');
    need(problems, run(undefined, '2027-04-02') === true && run('2027-04-04', undefined) === true, 'an empty end date, or an end date with no start date yet, is left to the other checks');
  }

  // The end time needs a start time, and on a one day event may not come before it
  const endTime = constraintNamed(rulesOf(at('endTime')), 'custom');
  if (!endTime) {
    problems.push('extraEvent.endTime should be checked against the start time');
  } else {
    const run = (value, event) => endTime.args[0](value, { document: event });
    const oneDay = { startTime: '18:30', startDate: '2027-04-02', endDate: '2027-04-02' };
    need(problems, run(undefined, {}) === true, 'an empty end time should be accepted');
    need(problems, typeof run('20:00', {}) === 'string', 'an end time with no start time should be refused');
    need(problems, run('20:00', oneDay) === true && run('20:00', { startTime: '18:30', startDate: '2027-04-02' }) === true, 'an end time after the start time should be accepted');
    need(problems, typeof run('17:00', oneDay) === 'string', 'an end time before the start time on a one day event should be refused');
    need(problems, run('17:00', Object.assign({}, oneDay, { endDate: '2027-04-03' })) === true, 'an end time before the start time is fine when the event runs over days');
  }

  const type = typeByName('extraEvent');
  const soonestFirst = (type.orderings || []).some(item => item.by && item.by[0].field === 'startDate' && item.by[0].direction === 'asc');
  need(problems, soonestFirst, 'extraEvent needs an ordering by startDate, soonest first');
  const hidden = type.preview.prepare({ title: 'Example', startDate: '2027-04-02', show: false }).subtitle || '';
  need(problems, hidden.indexOf('Hidden') !== -1, 'the extraEvent preview does not say when an event is hidden');

  // The seed file: one JSON document a line, fixed ids, only fields the Studio has
  const lines = world.seed.split('\n').filter(line => line.trim() !== '');
  need(problems, lines.length > 0, 'docs/seed/extra-events.ndjson has no documents');

  const names = fieldsIn(type).map(field => field.name);
  const ids = [];
  lines.forEach((line, index) => {
    const where = 'docs/seed/extra-events.ndjson line ' + (index + 1);
    let doc;
    try {
      doc = JSON.parse(line);
    } catch (error) {
      return problems.push(where + ' is not JSON');
    }

    need(problems, doc._type === 'extraEvent', where + ' should have _type extraEvent');
    need(problems, typeof doc._id === 'string' && /^extraEvent-[A-Za-z0-9-]+$/.test(doc._id), where + ' should have a fixed _id such as extraEvent-2026-10-17-doyenne-east, with hyphens and no dots');
    ids.push(doc._id);
    Object.keys(doc).forEach(key => need(problems, key.charAt(0) === '_' || names.indexOf(key) !== -1, where + ': ' + key + ' is not a field of extraEvent'));

    const day = /^\d{4}-\d{2}-\d{2}$/;
    need(problems, typeof doc.title === 'string' && doc.title.length > 0 && doc.title.length <= 30, where + ' needs a title of 1 to 30 characters');
    need(problems, day.test(doc.startDate || ''), where + ' needs a startDate such as 2026-10-17');
    need(problems, doc.endDate === undefined || (day.test(doc.endDate) && doc.endDate >= doc.startDate), where + ': endDate should be a date that is not before startDate');
    need(problems, doc.startTime === undefined && doc.endTime === undefined, where + ' should have no times: the events are all-day');
    need(problems, doc.location === undefined || (typeof doc.location === 'string' && doc.location.length <= 24), where + ': location should be at most 24 characters');
    need(problems, doc.show === true, where + ' should have show true');
  });
  need(problems, new Set(ids).size === ids.length, 'docs/seed/extra-events.ndjson uses an _id twice');
  return problems;
}

// The Place type, and the two fields of a task that use it. A place has a name
// (required, up to 16 characters, different from every other place) and a
// Show on screen switch. A task's contact and location are optional, and the
// location keeps Sanity's Create new option, so an editor can add a place
// while editing a task. The seed file holds the three starting places.
function checkPlaces() {
  const problems = [];
  const rulesOf = field => (field ? constraintsOf(field) : []);
  const type = typeByName('place');
  if (!type) return ['place is missing from schemas/index.js'];

  need(problems, constraintNamed(rulesOf(fieldAt('place.name')), 'required'), 'place.name should be required');
  const show = fieldAt('place.show');
  need(problems, show && show.type === 'boolean' && show.title === 'Show on screen' && show.initialValue === true, 'place.show should be a switch titled Show on screen that starts on');
  need(problems, type.title === 'Places', 'the place type should have the title Places');
  need(problems, (type.orderings || []).some(item => item.by && item.by[0].field === 'name'), 'place needs an ordering by name');
  const hidden = type.preview.prepare({ title: 'Classroom', show: false }).subtitle || '';
  need(problems, hidden.indexOf('Hidden') !== -1, 'the place preview does not say when a place is hidden');

  ['contact', 'location'].forEach(name => {
    const field = fieldAt('task.' + name);
    need(problems, field && !constraintNamed(rulesOf(field), 'required'), 'task.' + name + ' should be optional');
    need(problems, field && /optional/i.test(field.description || ''), 'the task.' + name + ' description should say it is optional');
  });

  const location = fieldAt('task.location');
  const options = (location && location.options) || {};
  need(problems, !options.disableNew, 'task.location should leave Create new on: do not set disableNew');
  need(problems, !options.filter && !options.weak, 'task.location should be an ordinary reference to a place');

  // the contact is a first name, with no space or digit
  const firstName = constraintNamed(rulesOf(fieldAt('task.contact')), 'custom');
  if (!firstName) {
    problems.push('task.contact should be checked so that it is a first name only');
  } else {
    const run = value => firstName.args[0](value);
    need(problems, run(undefined) === true && run('Sam') === true && run('Mary-Anne') === true, 'a first name, or an empty contact, should be accepted');
    need(problems, typeof run('Sam K') === 'string' && typeof run('Sam2') === 'string', 'a contact with a space or a number in it should be refused');
  }

  // the sample content shows a contact and a place, and keeps to the limits
  const tasks = world.sample.tasks;
  need(problems, tasks.some(task => task.contact && task.location), 'the sample content needs a task with a contact and a location');
  need(problems, tasks.some(task => task.contact && !task.location) && tasks.some(task => task.location && !task.contact), 'the sample content needs a task with only a contact and one with only a location');
  tasks.forEach(task => {
    need(problems, task.contact === undefined || (typeof task.contact === 'string' && task.contact.length <= 12), 'sample task "' + task.title + '": contact should be text of 12 characters or fewer');
    need(problems, task.location === undefined || (typeof task.location === 'string' && task.location.length <= 16), 'sample task "' + task.title + '": location should be the place name, 16 characters or fewer');
  });

  // The seed file: one JSON document a line, fixed ids, only fields the Studio has
  const lines = world.placeSeed.split('\n').filter(line => line.trim() !== '');
  const names = fieldsIn(type).map(field => field.name);
  const ids = [];
  const seeded = [];
  lines.forEach((line, index) => {
    const where = 'docs/seed/places.ndjson line ' + (index + 1);
    let doc;
    try {
      doc = JSON.parse(line);
    } catch (error) {
      return problems.push(where + ' is not JSON');
    }

    need(problems, doc._type === 'place', where + ' should have _type place');
    need(problems, typeof doc._id === 'string' && /^place-[a-z0-9-]+$/.test(doc._id), where + ' should have a fixed _id such as place-classroom, with lowercase letters, digits and hyphens');
    // the CSV importer makes the same id from a place's name, so a task in a CSV can point at a seeded place
    const importerId = 'place-' + String(doc.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    need(problems, doc._id === importerId, where + ': the _id should be ' + importerId + ', which is the one studio/scripts/import-csv.mjs makes from the name');
    ids.push(doc._id);
    seeded.push(String(doc.name).toLowerCase());
    Object.keys(doc).forEach(key => need(problems, key.charAt(0) === '_' || names.indexOf(key) !== -1, where + ': ' + key + ' is not a field of place'));
    need(problems, typeof doc.name === 'string' && doc.name.length > 0 && doc.name.length <= 16, where + ' needs a name of 1 to 16 characters');
    need(problems, doc.show === true, where + ' should have show true');
  });
  need(problems, new Set(ids).size === ids.length, 'docs/seed/places.ndjson uses an _id twice');
  need(problems, new Set(seeded).size === seeded.length, 'docs/seed/places.ndjson has the same name twice');
  need(problems, seeded.join() === 'classroom,programming room,media center', 'docs/seed/places.ndjson should hold Classroom, Programming room and Media center, in that order');
  return problems;
}

// The name check asks Sanity for the other places, so it waits for an answer.
// A stand-in client gives the answer here and writes down what it was asked.
async function checkPlaceNames() {
  const problems = [];
  const custom = constraintNamed(constraintsOf(fieldAt('place.name')), 'custom');
  if (!custom) return ['place.name should be checked against the names of the other places'];

  async function ask(name, document, others) {
    const asked = [];
    const getClient = () => ({ fetch: async (query, params, options) => { asked.push({ query: query, params: params, options: options }); return others; } });
    const answer = await custom.args[0](name, { document: document, getClient: getClient });
    return { answer: answer, asked: asked[0] };
  }

  const others = ['Classroom', 'Media center'];
  const same = await ask('Classroom', { _id: 'drafts.place-new' }, others);
  need(problems, typeof same.answer === 'string', 'a name that another place has should be refused');
  need(problems, typeof (await ask('  mEDIA CENTER ', { _id: 'place-new' }, others)).answer === 'string', 'a name that another place has, in other capitals or with spaces round it, should be refused');
  need(problems, (await ask('Programming room', { _id: 'place-new' }, others)).answer === true, 'a name no other place has should be accepted');
  need(problems, (await ask('Classroom', { _id: 'place-new' }, [])).answer === true, 'a name should be accepted when there are no other places');
  need(problems, (await ask('Classroom', { _id: 'place-new' }, null)).answer === true, 'a name should be accepted when Sanity lists no places');
  need(problems, (await ask('', { _id: 'place-new' }, others)).answer === true && (await ask(undefined, { _id: 'place-new' }, others)).answer === true, 'an empty name is left to the required check');

  // the place itself, as published and as a draft, is not another place, and a draft of another place counts
  const own = same.asked;
  need(problems, own && JSON.stringify(own.params.ownIds) === JSON.stringify(['place-new', 'drafts.place-new']), 'the lookup should leave out the place being edited, both as published and as a draft');
  need(problems, own && own.options && own.options.perspective === 'raw', 'the lookup should include drafts (perspective raw), so a place that is not yet published counts');
  need(problems, own && own.query.indexOf('_type == "place"') !== -1, 'the lookup should look at places only');
  return problems;
}

const world = {};
const results = [];

function check(name, run) {
  let problems;
  try {
    problems = run();
  } catch (error) {
    problems = ['the check stopped: ' + error.message];
  }
  results.push({ name: name, problems: problems });
}

function report() {
  results.forEach(result => {
    console.log((result.problems.length === 0 ? 'PASS  ' : 'FAIL  ') + result.name);
    result.problems.forEach(problem => console.log('        ' + problem));
  });

  const failed = results.filter(result => result.problems.length > 0).length;
  console.log('\n' + (results.length - failed) + ' of ' + results.length + ' checks passed.');
  return failed;
}

// Publish all (studio/publish-all-tool.js) is a tool in the top bar. What it
// publishes comes from publish-all.js, whose logic tools/test-publish-all.mjs
// runs. Here: the tool is registered, the pages that exist once keep their
// fixed ids, and every kind of document has a name in its list.
function checkPublishAll() {
  const problems = [];
  const tool = (world.config.tools || []).filter(entry => entry.name === 'publish-all')[0];
  if (!tool) return ['sanity.config.js should add a tool named publish-all'];
  need(problems, tool.title === 'Publish all', 'the Publish all tool should have the title Publish all');
  need(problems, typeof tool.component === 'function', 'the Publish all tool needs a component, written as a plain function');

  const ids = world.publishAllTool.singletonIds;
  need(problems, Object.keys(ids).join() === world.structure.singletonTypes.join(), 'the Publish all tool should know the pages that exist once: ' + world.structure.singletonTypes.join(', '));

  const schema = { get: name => typeByName(name) };
  world.structure.singletonTypes.forEach(type => {
    const right = world.publishAll.chooseDrafts([{ _id: 'drafts.' + type, _type: type }], schema, ids)[0];
    const wrong = world.publishAll.chooseDrafts([{ _id: 'drafts.another', _type: type }], schema, ids)[0];
    need(problems, right && right.problem === '' && right.publishedId === type, type + ' should publish to the fixed id ' + type);
    need(problems, wrong && wrong.problem !== '', 'a draft of ' + type + ' with some other id should be left alone');
  });

  world.types.filter(type => type.type === 'document').forEach(type => {
    const item = world.publishAll.chooseDrafts([{ _id: 'drafts.example', _type: type.name }], schema, ids)[0];
    need(problems, item && item.typeTitle !== '' && item.title !== '', type.name + ' should have a type title and a title in the Publish all list, even with every field empty');
  });
  return problems;
}

// The theme files are checked by their own script, so a failure there fails
// this run too. Its output is kept so the failing lines are shown here.
function checkThemeGuard() {
  const script = path.join(here, '..', 'tools', 'check-themes.mjs');
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  if (run.error) return ['the theme check could not start: ' + run.error.message];
  if (run.status === 0) return [];
  const lines = (run.stdout + run.stderr).split('\n').filter(line => line.trim() !== '');
  return ['tools/check-themes.mjs failed:'].concat(lines.map(line => '  ' + line));
}

async function main() {
  const folder = makeSandbox();
  try {
    world.types = (await load(path.join(folder, 'schemas', 'index.js'))).schemaTypes;
    world.config = (await load(path.join(folder, 'sanity.config.js'))).default;
    world.cli = (await load(path.join(folder, 'sanity.cli.js'))).default;
    world.structure = await load(path.join(folder, 'structure.js'));
    world.dashboard = await load(path.join(dashboardFolder, 'config.js'));
    world.registry = await load(path.join(dashboardFolder, 'registry.js'));
    world.themeRegistry = await load(path.join(dashboardFolder, 'themes', 'registry.js'));
    world.overlayRegistry = await load(path.join(dashboardFolder, 'themes', 'overlays', 'registry.js'));
    world.studioThemes = await load(path.join(folder, 'themes.js'));
    world.demoRegistry = await load(path.join(dashboardFolder, 'core', 'demo-screens.js'));
    world.studioDemoScreens = await load(path.join(folder, 'demo-screens.js'));
    world.hiddenRegistry = await load(path.join(dashboardFolder, 'core', 'hidden-transitions.js'));
    world.studioHidden = await load(path.join(folder, 'hidden-transitions.js'));
    world.publishAll = await load(path.join(folder, 'publish-all.js'));
    world.publishAllTool = await load(path.join(folder, 'publish-all-tool.js'));
    world.sample = JSON.parse(fs.readFileSync(path.join(dashboardFolder, 'data', 'sample', 'content.json'), 'utf8'));
    world.seed = fs.readFileSync(path.join(here, '..', 'docs', 'seed', 'extra-events.ndjson'), 'utf8');
    world.placeSeed = fs.readFileSync(path.join(here, '..', 'docs', 'seed', 'places.ndjson'), 'utf8');
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }

  check('every type has a name and a title', checkNamesAndTitles);
  check('field names, kinds and limits match what the dashboard reads', checkShape);
  check('every field has a title and a one line description', checkDescriptions);
  check('every validation rule runs', checkValidations);
  check('every item has Show on screen and Hide after', checkItemFields);
  check('previews are readable and say when an item is hidden or expired', checkPreviews);
  check('lists can be ordered', checkOrderings);
  check('choice lists offer the right values', checkChoices);
  check('the panels editors can pick match dashboard/registry.js', checkPanelIds);
  check('the rules for announcement days and calendar codes work', checkRules);
  check('the Speed setting offers the speeds the dashboard has', checkSpeed);
  check('frame metal, glint, seconds per page and the name effect agree with dashboard/config.js', checkLookAndTiming);
  check('the Transitions tab agrees with dashboard/config.js', checkTransitionsTab);
  check('the Night mode tab agrees with dashboard/config.js', checkNightTab);
  check('the Hidden tab agrees with dashboard/config.js and the dashboard registry, and the Play buttons work', checkHiddenTab);
  check('Play announcements has its hidden field, its button and its Demo step', checkPlayAnnouncements);
  check('Content source and the switch back time agree with dashboard/config.js, and the two buttons work', checkContentSource);
  check('Show connection status is a switch that starts off, in the Connection tab', checkConnectionStatus);
  check('a subteam has an optional list of first names, up to 24 of 12 characters, with no repeats', checkSubteamMembers);
  check('a person has an optional photo and a switch that starts on, as in dashboard/config.js', checkPersonPhoto);
  check('a photo has a picture, a short caption and a first name credit, and the Photos tab agrees with dashboard/config.js', checkPhotos);
  check('the themes and overlays in studio/themes.js are the ones in the dashboard registries', checkThemeLists);
  check('the Theme page agrees with dashboard/config.js, needs a start and an end for each rule, and checks the time zone', checkTheme);
  check('the demo screens in studio/demo-screens.js are the ones in the dashboard registry', checkDemoScreens);
  check('the Demo page agrees with dashboard/config.js, and Run demo and Stop demo do what they say', checkDemo);
  check('an Events Calendar entry needs a title and a start date, and the seed file can be imported', checkExtraEvents);
  check('a place has a name and a switch, a task has an optional contact and place, and the places seed file can be imported', checkPlaces);
  results.push({ name: 'two places cannot have the same name, capitals ignored', problems: await checkPlaceNames().catch(error => ['the check stopped: ' + error.message]) });
  check('starting values match dashboard/config.js', checkStartingValues);
  check('every name in config.js and the sample content has a field', checkDashboardNames);
  check('every document type has a line in the sidebar, and each line opens the right list or page', checkSidebar);
  check('Dashboard Settings, Theme and Demo exist once and the project files agree', checkSettingsPage);
  check('the Publish all tool is in the top bar and keeps the pages that exist once on their fixed ids', checkPublishAll);
  check('every theme and overlay is complete and readable (tools/check-themes.mjs)', checkThemeGuard);

  process.exitCode = report() > 0 ? 1 : 0;
}

main().catch(error => {
  console.error('Could not load the Studio files: ' + error.message);
  process.exitCode = 1;
});
