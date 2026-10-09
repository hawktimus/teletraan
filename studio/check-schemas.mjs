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
//   hexColor   a string written as # and six hex characters, such as #6C18B6
const text = max => ({ kind: 'text', max: max });
const number = (min, max) => ({ kind: 'number', min: min, max: max });
const object = fields => ({ kind: 'object', fields: fields });
const rows = (fields, maxItems) => ({ kind: 'rows', fields: fields, maxItems: maxItems });
const strings = (max, maxItems) => ({ kind: 'strings', max: max, maxItems: maxItems });
const teamRef = { kind: 'reference', to: 'team' };
const hexColor = { kind: 'hex' };

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
    team: teamRef,
    order: 'number',
  }),
  place: { name: text(16), show: 'boolean' },
  plan: withFlags({
    heading: text(26),
    date: 'date',
    location: text(30),
    rows: rows({ time: text(9), text: text(18), lead: text(10) }, 5),
    team: teamRef,
  }),
  presentationDay: {
    firstSlotAt: 'datetime',
    lastSlotAt: 'datetime',
    slotMinutes: number(5, 30),
    closeMinutesBefore: number(0, 240),
    open: 'boolean',
    team: teamRef,
  },
  presentation: {
    name: text(12),
    subteam: 'string',
    topic: text(40),
    start: 'datetime',
    minutes: number(5, 30),
    deckLink: 'url',
    status: 'string',
    team: teamRef,
  },
  extraEvent: { title: text(30), startDate: 'date', endDate: 'date', startTime: 'time', endTime: 'time', location: text(24), team: teamRef, show: 'boolean' },
  calendarFilter: {
    name: text(40),
    action: 'string',
    words: strings(30, 5),
    days: { kind: 'weekdays', startsOn: 1 },
    calendar: text(20),
    fromDate: 'date',
    toDate: 'date',
    show: 'boolean',
    expires: 'datetime',
  },
  sponsor: withFlags({ name: text(19), tier: text(12), blurb: text(80), thankYou: text(54), logoAddress: 'url', team: teamRef, order: 'number' }),
  tipOrNews: withFlags({ kind: 'string', text: text(52), team: teamRef, order: 'number' }),
  subteam: withFlags({
    name: text(11),
    lead: text(17),
    members: strings(12, 24),
    spotlight: 'boolean',
    spotlightHeadline: text(40),
    spotlightText: text(100),
    team: teamRef,
    order: 'number',
  }),
  person: withFlags({ role: 'string', name: text(17), title: text(22), photo: 'image', showPhoto: 'boolean', team: teamRef, order: 'number' }),
  team: {
    name: text(20),
    shortName: text(8),
    number: text(6),
    code: text(10),
    logo: 'image',
    colors: object({ primary: hexColor, plate: hexColor, accent: hexColor, neon: hexColor, pink: hexColor, background: hexColor, text: hexColor }),
    mirror: 'boolean',
    active: 'boolean',
    order: 'number',
  },
  photo: withFlags({ image: 'image', caption: text(36), credit: text(14) }),
  customPanel: withFlags({ title: text(7), blocks: { kind: 'blocks', max: 6 }, team: teamRef, order: 'number' }),
  dashboardSettings: {
    team: object({ name: text(16), number: text(5), school: text(30) }),
    motion: 'string',
    speed: 'string',
    frameMetal: 'string',
    contentSource: 'string',
    switchBackAt: 'datetime',
    glint: 'boolean',
    look: 'string',
    style: 'string',
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
    portraitScale: number(60, 100),
    photoScale: number(60, 100),
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
    presentationsEnabled: 'boolean',
    noShowMinutes: number(1, 15),
    graceMinutes: number(0, 10),
    presentationTestRequest: object({ requestedAt: 'datetime' }),
    teamMode: 'string',
    alternateMinutes: number(1, 30),
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
    seasonOverPanels: 'boolean',
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
  'calendarFilter.action': ['hide', 'show'],
  'presentation.subteam': ['Build', 'Programming', 'Design', 'Electrical', 'Outreach', 'Business', 'Other'],
  'presentation.status': ['scheduled', 'cancelled', 'done', 'skipped'],
  'person.role': ['Coach', 'Captain', 'Mentor'],
  'dashboardSettings.motion': ['full', 'calm'],
  'dashboardSettings.speed': ['very-slow', 'slow', 'normal', 'fast'],
  'dashboardSettings.frameMetal': ['gold', 'silver'],
  'dashboardSettings.look': ['polished', 'flat', 'plain'],
  'dashboardSettings.style': ['original', 'cybertron', 'minimal'],
  'dashboardSettings.pageChangeStyle': ['alternate', 'slat', 'mechanical'],
  'dashboardSettings.frameFinish': ['mostly-gold', 'alternate', 'gold', 'silver'],
  'dashboardSettings.photoOrder': ['random', 'newest-first'],
  'dashboardSettings.nightStyle': ['bounce', 'black'],
  'dashboardSettings.nightSpeed': ['slow', 'normal', 'fast'],
  'dashboardSettings.contentSource': ['production', 'sample'],
  'dashboardSettings.teamMode': ['prime', 'nova', 'alternate'],
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
  calendarFilter: 'name',
  sponsor: 'order',
  tipOrNews: 'order',
  subteam: 'order',
  person: 'order',
  team: 'order',
  photo: '_createdAt',
  customPanel: 'order',
  place: 'name',
  presentationDay: 'firstSlotAt',
  presentation: 'start',
};

// The pages that exist once. Each is one document whose id is its type.
const pageTypes = ['dashboardSettings', 'theme', 'demo'];

// Document types that have no line in structure.js, with the reason for each.
// Types that are only objects inside another document are not documents and
// are left out of the check without being listed here.
const notInSidebar = {};

// The sidebar titles that people look for by name
const sidebarTitles = { extraEvent: 'Events Calendar', calendarFilter: 'Calendar filters', place: 'Places', presentationDay: 'Meeting days', team: 'Teams' };

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
      // only the names the team input (team-input.js) imports besides useClient: the two patches it writes
      "export const set = value => ({ type: 'set', value: value });",
      "export const unset = () => ({ type: 'unset' });",
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
  ['schemas', 'structure.js', 'project.js', 'actions.js', 'themes.js', 'demo-screens.js', 'hidden-transitions.js', 'publish-all.js', 'publish-all-tool.js', 'team-input.js', 'sanity.config.js', 'sanity.cli.js'].forEach(name => {
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
  hex: checkHex,
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

  // the week starts on Sunday unless the contract says startsOn
  const first = want.startsOn || 0;
  const order = weekdayNames.map((name, index) => (index + first) % 7);
  const list = (field.options && field.options.list) || [];
  const wanted = order.map(day => day + ':' + weekdayNames[day]);
  if (list.map(item => item.value + ':' + item.title).join() !== wanted.join()) say('should be a checkbox list of 0 to 6 titled ' + weekdayNames[first] + ' to ' + weekdayNames[(first + 6) % 7]);
}

// A picture field: images only, with the crop and hotspot tools on, so an
// editor can keep a face in the middle of the square the screen cuts
function checkImage(field, want, say) {
  const options = field.options || {};

  if (field.type !== 'image') say('should be an image');
  if (options.hotspot !== true) say('should have the crop and hotspot tools on (options.hotspot)');
  if (options.accept !== 'image/*') say('should accept images only (options.accept should be "image/*")');
}

// A color field: a string written as # and six characters from 0 to 9 and A to F,
// refused with a message in plain words that gives an example
function checkHex(field, want, say) {
  const rules = constraintsOf(field);
  const pattern = constraintNamed(rules, 'regex');
  if (field.type !== 'string') say('should be a string');
  if (!pattern) return say('should be checked with a pattern');

  ['#6C18B6', '#6c18b6', '#000000', '#FFFFFF', '#09060F'].forEach(good => {
    if (!pattern.args[0].test(good)) say('the pattern refuses ' + good);
  });
  ['6C18B6', '#6C18B', '#6C18B6F', '#GGGGGG', '#12345', 'purple', '#6C18B6 ', ' #6C18B6', '#6C18B6\n', ''].forEach(bad => {
    if (pattern.args[0].test(bad)) say('the pattern accepts "' + bad + '"');
  });

  const message = messageAfter(rules, 'regex');
  if (message.indexOf('#6C18B6') === -1 || /regex|hexadecimal|pattern/i.test(message)) say('the error for a color that is not written right should say what to write in plain words, with an example such as #6C18B6');
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
const photoNames = ['photoOrder', 'photoSeconds', 'portraitScale', 'photoScale'];
const nightNames = ['nightEnabled', 'nightStyle', 'nightStart', 'nightEnd', 'nightLogoWidth', 'nightSpeed', 'nightPreview'];
const hiddenNames = ['hiddenEnabled', 'desktopChance', 'redEyesChance', 'hiddenRequest'];
const presentationNames = ['presentationsEnabled', 'noShowMinutes', 'graceMinutes'];

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
    ['portraitScale', 'portraitScale', 100, true],
    ['photoScale', 'photoScale', 100, true],
    ['nightLogoWidth', 'nightLogoWidth', 300, true],
    ['desktopChance', 'desktopChance', 1, true],
    ['redEyesChance', 'redEyesChance', 1, true],
    ['noShowMinutes', 'noShowMinutes', 5, true],
    ['graceMinutes', 'graceMinutes', 5, true],
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

// Look, in the Screen tab. The Studio list is the dashboard's list (the looks in
// config.js), in the same order, the starting value is Polished, which changes
// nothing on the screen, and the sample content has a look the dashboard accepts.
function checkLookSetting() {
  const problems = [];
  const config = world.dashboard;
  const look = fieldAt('dashboardSettings.look');
  const rules = look ? constraintsOf(look) : [];
  const allowed = constraintNamed(rules, 'valid');
  const offered = choicesOf('dashboardSettings.look');
  const titles = { polished: 'Polished (as now)', flat: 'Flat', plain: 'Plain' };

  need(problems, config.looks.join() === 'polished,flat,plain', 'looks in config.js should be polished, flat and plain, not ' + config.looks.join());
  need(problems, config.defaultSettings.look === 'polished', 'the default look in config.js should be polished');
  need(problems, look && look.initialValue === 'polished', 'look should start as polished');
  need(problems, look && look.group === 'screen', 'look should be in the Screen tab');
  need(problems, look && look.title === 'Look', 'look should be titled Look');
  need(problems, look && look.options && look.options.layout === 'radio', 'look should be a radio list');
  need(problems, offered.map(item => item.value).join() === config.looks.join(), 'look should offer the same names, in the same order, as looks in config.js: ' + config.looks.join(', '));
  offered.forEach(item => need(problems, item.title === titles[item.value], 'the look ' + item.value + ' should be titled ' + titles[item.value]));
  need(problems, allowed && allowed.args[0].join() === config.looks.join(), 'look should only allow: ' + config.looks.join(', '));
  // Dashboard Settings published before Look existed has no look, and the screen reads that as Polished.
  // A required field would stop that page being published until someone picked one.
  need(problems, !constraintNamed(rules, 'required'), 'look should not be required: an empty look is Polished, and the page must still publish');

  // The description says what each look does, and which one is the default
  const words = look ? look.description || '' : '';
  need(problems, /Polished is the default/.test(words) && /Flat/.test(words) && /Plain/.test(words) && /Mini/.test(words), 'the look description should say that Polished is the default, what Flat and Plain do, and that the Mini is lighter with them');

  need(problems, config.looks.indexOf(world.sample.settings.look) !== -1, 'the sample settings need a look of ' + config.looks.join(', '));
  return problems;
}

// Style, in the Screen tab. The Studio list is the dashboard's list (the styles in
// config.js), in the same order, the starting value is Original, which changes
// nothing on the screen, and the sample content has a style the dashboard accepts.
// The dashboard has a layout for the two styles that force one, and the Theme page
// says that the style and the team set the base values.
function checkStyleSetting() {
  const problems = [];
  const config = world.dashboard;
  const style = fieldAt('dashboardSettings.style');
  const rules = style ? constraintsOf(style) : [];
  const allowed = constraintNamed(rules, 'valid');
  const offered = choicesOf('dashboardSettings.style');
  const titles = { original: 'Original', cybertron: 'Cybertron', minimal: 'Minimal' };

  need(problems, config.styles.join() === 'original,cybertron,minimal', 'styles in config.js should be original, cybertron and minimal, not ' + config.styles.join());
  need(problems, config.defaultSettings.style === 'original', 'the default style in config.js should be original');
  need(problems, style && style.initialValue === 'original', 'style should start as original');
  need(problems, style && style.group === 'screen', 'style should be in the Screen tab');
  need(problems, style && style.title === 'Style', 'style should be titled Style');
  need(problems, style && style.type === 'string' && style.options && style.options.layout === 'radio', 'style should be a radio list');
  need(problems, offered.map(item => item.value).join() === config.styles.join(), 'style should offer the same names, in the same order, as styles in config.js: ' + config.styles.join(', '));
  offered.forEach(item => need(problems, item.title === titles[item.value], 'the style ' + item.value + ' should be titled ' + titles[item.value]));
  need(problems, allowed && allowed.args[0].join() === config.styles.join(), 'style should only allow: ' + config.styles.join(', '));
  // Dashboard Settings published before Style existed has no style, and the screen reads that as Original.
  // A required field would stop that page being published until someone picked one.
  need(problems, !constraintNamed(rules, 'required'), 'style should not be required: an empty style is Original, and the page must still publish');

  // The description says what each style is, and that the theme does not decide the layout of two of them
  const words = style ? style.description || '' : '';
  need(problems, /Original/.test(words) && /Cybertron/.test(words) && /Minimal/.test(words) && /whatever the theme/.test(words), 'the style description should say what Original is, what Cybertron and Minimal have, and that the theme does not change that');

  need(problems, config.styles.indexOf(world.sample.settings.style) !== -1, 'the sample settings need a style of ' + config.styles.join(', '));
  need(problems, world.layoutModule.layouts.indexOf('bar') !== -1, 'the dashboard needs the bar layout, which Cybertron and Minimal have');

  const theme = fieldAt('theme.defaultTheme');
  need(problems, theme && /Style and team set the base values/.test(theme.description || ''), 'the Theme page should say that the style and the team set the base values');
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
  // Play announcements and Run presentation test come after them (checkPlayAnnouncements, checkRunPresentationTest).
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

// The Presentations tab: the switch and the two minutes, all in
// schemas/settingsPresentations.js. The limits and starting values are also
// compared in checkLookAndTiming and checkStartingValues.
function checkPresentationsTab() {
  const problems = [];
  const config = world.dashboard;
  const settings = typeByName('dashboardSettings');
  const at = name => fieldAt('dashboardSettings.' + name);

  need(problems, settings.groups.filter(group => group.title === 'Presentations').length === 1, 'Dashboard Settings should have exactly one tab named Presentations');
  need(problems, settings.groups.filter(group => group.name === 'presentations' && group.title === 'Presentations').length === 1, 'the Presentations tab should be the group presentations');

  // Nothing else is in the tab, so deleting settingsPresentations.js removes the whole section. The last field is
  // the hidden one that Run presentation test fills in (checkRunPresentationTest).
  const inTab = fieldsIn(settings).filter(field => field.group === 'presentations').map(field => field.name);
  const wanted = presentationNames.concat('presentationTestRequest');
  need(problems, inTab.join() === wanted.join(), 'the Presentations tab should hold, in this order: ' + wanted.join(', ') + ', not ' + inTab.join(', '));

  const titles = { presentationsEnabled: 'Run presentations', noShowMinutes: 'Wait for the speaker (minutes)', graceMinutes: 'Overrun allowed (minutes)' };
  Object.keys(titles).forEach(name => need(problems, at(name) && at(name).title === titles[name], name + ' should be titled ' + titles[name]));

  // The switch starts on, here and in config.js
  const switchField = at('presentationsEnabled');
  need(problems, switchField && switchField.type === 'boolean' && switchField.initialValue === true && config.defaultSettings.presentationsEnabled === true, 'presentationsEnabled should be a switch that starts on, and so should its default in config.js');

  // The two minutes are whole numbers, 1 to 15 and 0 to 10, and the description gives the range
  need(problems, sameData(config.limits.noShowMinutes, { min: 1, max: 15 }), 'limits.noShowMinutes in config.js should be 1 to 15');
  need(problems, sameData(config.limits.graceMinutes, { min: 0, max: 10 }), 'limits.graceMinutes in config.js should be 0 to 10');
  need(problems, at('noShowMinutes') && /from 1 to 15/.test(at('noShowMinutes').description || ''), 'the noShowMinutes description should give the range, from 1 to 15');
  need(problems, at('graceMinutes') && /from 0 to 10/.test(at('graceMinutes').description || ''), 'the graceMinutes description should give the range, from 0 to 10');

  // The sample content carries the settings, with values the dashboard accepts
  const sample = world.sample.settings;
  need(problems, typeof sample.presentationsEnabled === 'boolean', 'the sample settings need presentationsEnabled, true or false');
  ['noShowMinutes', 'graceMinutes'].forEach(name => {
    const limit = config.limits[name];
    need(problems, sample[name] >= limit.min && sample[name] <= limit.max, 'the sample settings need ' + name + ' from ' + limit.min + ' to ' + limit.max);
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

  // The button comes after the Play buttons of the hidden transitions, and nowhere else. Run presentation test is the one after it.
  const played = Object.keys(world.hiddenRegistry.hiddenTransitions).length;
  const buttons = world.config.document.actions([], { schemaType: 'dashboardSettings' });
  const button = buttons[2 + played];
  if (buttons.length !== 4 + played || typeof button !== 'function') {
    return problems.concat('the settings page should have the Play announcements button, a plain function, after the Play buttons of the hidden transitions, and then Run presentation test');
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

// Run presentation test: the hidden presentationTestRequest field in the Presentations tab
// (schemas/settingsPresentations.js), its starting value in config.js and the button that
// fills it in (actions.js). It is the last button on the settings page.
function checkRunPresentationTest() {
  const problems = [];
  const config = world.dashboard;
  const request = fieldAt('dashboardSettings.presentationTestRequest');
  const time = fieldAt('dashboardSettings.presentationTestRequest.requestedAt');

  // The field: an object with one read only time, hidden from editors, with no starting value of its own
  need(problems, request && request.type === 'object', 'presentationTestRequest should be an object');
  need(problems, request && request.group === 'presentations', 'presentationTestRequest should be in the Presentations tab');
  need(problems, request && request.hidden === true, 'presentationTestRequest should be hidden from editors (hidden: true)');
  need(problems, request && request.initialValue === undefined, 'presentationTestRequest should have no starting value in the Studio');
  need(problems, request && /Run presentation test/.test(request.description || ''), 'the presentationTestRequest description should name the button Run presentation test');
  need(problems, time && time.type === 'datetime' && time.readOnly === true, 'presentationTestRequest.requestedAt should be a read only datetime');
  need(problems, time && !constraintNamed(constraintsOf(time), 'required'), 'presentationTestRequest.requestedAt should be optional');

  // The starting value is a request with no time, and the sample content never carries a request
  need(problems, sameData(config.defaultSettings.presentationTestRequest, { requestedAt: '' }), 'the default presentationTestRequest in config.js should be a time that is empty');
  need(problems, !('presentationTestRequest' in world.sample.settings), 'the sample settings should not carry a presentationTestRequest');

  // The button is the last one on the settings page, and nowhere else
  const played = Object.keys(world.hiddenRegistry.hiddenTransitions).length;
  const buttons = world.config.document.actions([], { schemaType: 'dashboardSettings' });
  const button = buttons[3 + played];
  if (buttons.length !== 4 + played || typeof button !== 'function') {
    return problems.concat('the settings page should end with the Run presentation test button, a plain function, after Play announcements');
  }
  need(problems, world.config.document.actions([], { schemaType: 'demo' }).every(item => item.action !== 'runPresentationTest'), 'only the settings page should get the Run presentation test button');

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
  const written = set && set.presentationTestRequest;

  need(problems, pressed.state.label === 'Run presentation test', 'the button should be labelled Run presentation test');
  need(problems, button.action === 'runPresentationTest', 'the button should be called runPresentationTest');
  need(problems, pressed.calls.length === 2 && pressed.calls[0].patch.length === 1 && Object.keys(set).join() === 'presentationTestRequest' && pressed.calls[1].publish === true, 'Run presentation test should set presentationTestRequest and then publish');
  need(problems, written && Object.keys(written).join() === 'requestedAt', 'Run presentation test should write only requestedAt');
  need(problems, written && typeof written.requestedAt === 'string' && new Date(written.requestedAt).toISOString() === written.requestedAt && Date.parse(written.requestedAt) >= before && Date.parse(written.requestedAt) <= after, 'Run presentation test should write the time now, as new Date().toISOString() writes it');
  need(problems, press({ presentationTestRequest: { requestedAt: '2026-06-01T12:00:00.000Z' } }).state.disabled === false, 'Run presentation test should be on when a request is already published, so it can be run again');
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
  expect('look', settings.look);
  expect('style', settings.style);
  expect('showConnectionStatus', settings.showConnectionStatus);
  expect('pageSeconds', settings.pageSeconds);
  logoSwitches.concat(logoNumbers, transitionNames, photoNames, nightNames, hiddenNames.slice(0, 3), presentationNames, teamNames).forEach(name => expect(name, settings[name]));
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

  const lists = { tasks: 'task', sponsors: 'sponsor', tipsAndNews: 'tipOrNews', subteams: 'subteam', people: 'person', extraEvents: 'extraEvent', calendarFilters: 'calendarFilter', presentationDays: 'presentationDay', presentations: 'presentation' };
  Object.keys(lists).forEach(key => {
    // a talk has its Sanity id under the plain name id, the way the query sends it
    sample[key].forEach(item => add(unknownKeys(without(item, 'id'), fieldsIn(typeByName(lists[key])), 'sample ' + key)));
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
  const methods = ['title', 'id', 'child', 'items', 'schemaType', 'documentId', 'defaultOrdering', 'apiVersion', 'filter', 'params'];
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
// line, or editors could not reach it. A group holds lists, and its lines count
// like the others. The order of the lines is not checked.

// Every line of the sidebar, the lines inside each group too
function allLines(entries) {
  return entries.reduce((lines, entry) => lines.concat(entry.kind === 'group' ? [entry].concat(entry.entries || []) : [entry]), []);
}

function checkSidebarLines(problems) {
  const entries = world.structure.sidebarEntries;
  const typeNames = world.types.map(type => type.name);
  const named = [];
  const ids = [];

  // The id of a line is how Studio tells the lines of one list apart
  function checkId(entry, where) {
    const id = entry.id || entry.type;
    need(problems, ids.indexOf(id) === -1, where + ' has the id "' + id + '", which another line in the sidebar has too. Remove the repeated line, or, for lists of one type with a filter, give each line an id of its own.');
    ids.push(id);
  }

  function checkLine(entry, line) {
    const where = line + ' ("' + entry.title + '")';
    if (!entry.title) problems.push(line + ' has no title');
    if (typeNames.indexOf(entry.type) === -1) return problems.push(where + ' names the type "' + entry.type + '", and schemas/index.js has no type with that name. Fix the spelling or remove the line.');

    checkId(entry, where);
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

    if (entry.filter !== undefined) {
      need(problems, typeof entry.filter === 'string' && entry.filter.indexOf('$since') !== -1, where + ' has a filter that should use $since, the time a day ago that structure.js works out when the sidebar opens');
      need(problems, !/now\s*\(/.test(String(entry.filter)), where + ' has a filter that uses now(). Studio keeps lists live and a live filter cannot use it. Use $since.');
    }
  }

  entries.forEach((entry, index) => {
    const line = 'structure.js line ' + (index + 1) + ' of sidebarEntries';
    if (entry.kind === 'divider') return;

    if (entry.kind === 'group') {
      const where = line + ' ("' + entry.title + '")';
      if (!entry.title) problems.push(line + ' has no title');
      need(problems, typeof entry.id === 'string' && entry.id !== '', where + ' needs an id');
      checkId(entry, where);
      if (!Array.isArray(entry.entries) || entry.entries.length === 0) return problems.push(where + ' has no lines under entries');

      entry.entries.forEach((inner, position) => {
        const innerLine = where + ', line ' + (position + 1);
        if (inner.kind !== 'list') return problems.push(innerLine + ' has the kind "' + inner.kind + '". A group holds lists only.');
        checkLine(inner, innerLine);
      });
      return;
    }

    if (entry.kind !== 'list' && entry.kind !== 'page') return problems.push(line + ' has the kind "' + entry.kind + '". Use list, page, group or divider.');
    checkLine(entry, line);
  });

  world.types.filter(type => type.type === 'document').forEach(type => {
    const reason = notInSidebar[type.name];
    if (reason) return need(problems, named.indexOf(type.name) === -1, type.name + ' is listed in notInSidebar in check-schemas.mjs ("' + reason + '") and also has a line in structure.js. Remove one of the two.');
    need(problems, named.indexOf(type.name) !== -1, 'the document type "' + type.name + '" (' + type.title + ') has no line in the sidebar. Add a line for it to sidebarEntries in studio/structure.js, or, if editors should not see it there, list it in notInSidebar in studio/check-schemas.mjs with the reason.');
  });

  Object.keys(sidebarTitles).forEach(typeName => {
    const entry = allLines(entries).filter(item => item.type === typeName)[0];
    need(problems, !entry || entry.title === sidebarTitles[typeName], 'the sidebar line for ' + typeName + ' should be titled ' + sidebarTitles[typeName] + ', not ' + (entry && entry.title));
  });
}

// What structure() built for one line has to match the line. For a group, its lines are checked the same way.
function checkBuiltItem(entry, item, what, problems) {
  const child = item.child && item.child.made;

  if (entry.kind === 'divider') return need(problems, item.divider === true, what + ' should be a divider');
  if (item.title !== entry.title) return problems.push(what + ' should be titled ' + entry.title + ', it is ' + item.title);

  if (entry.kind === 'group') {
    const inside = ((child && child.items) || []).map(inner => inner.made);
    need(problems, child && child.id === entry.id && child.title === entry.title, what + ' should open a list titled ' + entry.title + ' with the id ' + entry.id);
    if (inside.length !== entry.entries.length) return problems.push(what + ' should open ' + entry.entries.length + ' lines, it opens ' + inside.length);
    entry.entries.forEach((inner, index) => checkBuiltItem(inner, inside[index], what + ', line ' + (index + 1) + ' ("' + inner.title + '")', problems));
  } else if (entry.kind === 'list') {
    const listOk = child && child.type === entry.type && child.title === entry.title && child.defaultOrdering[0].field === entry.sort.field;
    need(problems, listOk, what + ' should open the ' + entry.type + ' list, titled ' + entry.title + ', sorted by ' + entry.sort.field);
    need(problems, item.id === (entry.id || entry.type), what + ' should have the id ' + (entry.id || entry.type) + ', it has ' + item.id);

    if (entry.filter && child) {
      const aDay = 24 * 60 * 60 * 1000;
      const since = child.params && child.params.since;
      need(problems, typeof child.filter === 'string' && child.filter.indexOf(entry.filter) !== -1 && child.params && child.params.type === entry.type, what + ' should filter the ' + entry.type + ' list with: ' + entry.filter);
      need(problems, typeof since === 'string' && Math.abs(Date.now() - aDay - Date.parse(since)) < 60 * 1000, what + ' should pass $since as the time a day ago, worked out when the sidebar opens');
      need(problems, child.id === (entry.id || entry.type) && typeof child.apiVersion === 'string', what + ' should give the filtered list its id and an apiVersion');
    }
  } else {
    const pageOk = child && child.schemaType === entry.type && child.documentId === entry.id;
    need(problems, pageOk, what + ' should open the one document with id ' + entry.id);
  }
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
    checkBuiltItem(entry, items[index], 'sidebar line ' + (index + 1) + ' ("' + (entry.title || entry.kind) + '")', problems);
  });
  return problems;
}

function checkSettingsPage() {
  const problems = [];
  // The content source buttons are added to the settings page after the ones Studio keeps
  const actions = ['publish', 'discardChanges', 'delete', 'duplicate', 'unpublish'].map(action => ({ action: action }));
  const kept = world.config.document.actions(actions, { schemaType: 'dashboardSettings' }).map(item => item.action).join();
  const others = world.config.document.actions(actions, { schemaType: 'task' }).length;
  const wanted = 'publish,discardChanges,useSampleContent,useProductionContent,playDesktop,playRedEyes,playAnnouncements,runPresentationTest';
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
  need(problems, setting('portraitScale') && setting('portraitScale').title === 'Portrait size, percent', 'portraitScale should be titled Portrait size, percent');
  need(problems, setting('photoScale') && setting('photoScale').title === 'Photo size, percent', 'photoScale should be titled Photo size, percent');

  // The two sizes: a whole percent from 60 to 100 that starts at 100, with a one line description that says what 100 is
  ['portraitScale', 'photoScale'].forEach(name => {
    const words = setting(name) ? setting(name).description || '' : '';
    need(problems, words.length > 0 && words.indexOf('\n') === -1, name + ' needs a one-line description');
    need(problems, /100 is the full size/.test(words) && /largest that fits/.test(words), name + ' description should say that 100 is the full size and the largest that fits the frame');
    need(problems, /from 60 to 100/.test(words), name + ' description should give the range, from 60 to 100');
    need(problems, config.limits[name] && config.limits[name].min === 60 && config.limits[name].max === 100, 'limits.' + name + ' in config.js should be 60 to 100');
    need(problems, config.defaultSettings[name] === 100, 'the default ' + name + ' in config.js should be 100');
    need(problems, world.sample.settings[name] === 100, 'the sample settings need ' + name + ' of 100');
  });

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

    // decorations is on the overlays only: whether the pack has a file in dashboard/seasons/
    const keys = ['id', 'name', 'description'].concat(name === 'overlays' ? ['decorations'] : []);
    keys.forEach(key => {
      if (copy[key] !== entry[key]) problems.push('the ' + name + ' number ' + (index + 1) + ' has ' + key + ' "' + copy[key] + '" in studio/themes.js but "' + entry[key] + '" in the dashboard registry');
    });

    // layout is on the themes only, and a theme that says nothing has the standard layout (dashboard/core/layout.js)
    if (name === 'themes') {
      const layoutOf = item => (item.layout === undefined ? world.layoutModule.defaultLayout : item.layout);
      if (layoutOf(copy) !== layoutOf(entry)) problems.push('the themes number ' + (index + 1) + ' has layout "' + layoutOf(copy) + '" in studio/themes.js but "' + layoutOf(entry) + '" in the dashboard registry');
      need(problems, world.layoutModule.isLayout(layoutOf(entry)), 'the theme "' + entry.id + '" has the layout "' + layoutOf(entry) + '", which is not one of: ' + world.layoutModule.layouts.join(', '));
      if (layoutOf(entry) === 'sidebar') {
        need(problems, /sidebar/i.test(copy.description || '') && /no small frame/i.test(copy.description || ''), 'the Studio description of the theme "' + entry.id + '" should say it has a sidebar and no small frame, so editors know what they are picking');
      }
    }
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

  // The editors see an overlay as a seasonal pack, which also brings decorations. The stored values stay as they are.
  world.overlayRegistry.overlays.forEach(entry => need(problems, typeof entry.decorations === 'boolean', 'the overlay "' + entry.id + '" should say decorations: true or false in its registry entry'));
  const packKind = choicesOf('theme.schedule.kind').filter(item => item.value === 'overlay')[0];
  need(problems, packKind && packKind.title === 'Seasonal pack', 'the schedule kind stored as overlay should be shown as Seasonal pack');
  ['theme.schedule.kind', 'theme.schedule.overlay', 'theme.useNow.overlay'].forEach(name => {
    const field = fieldAt(name);
    need(problems, field && /decoration/i.test(field.description || ''), name + ' should say in its description that a seasonal pack also adds decorations');
  });
  need(problems, fieldAt('theme.schedule.overlay') && fieldAt('theme.schedule.overlay').title === 'Seasonal pack', 'theme.schedule.overlay should be titled Seasonal pack');
  need(problems, fieldAt('theme.useNow.overlay') && fieldAt('theme.useNow.overlay').title === 'Seasonal pack', 'theme.useNow.overlay should be titled Seasonal pack');
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
  need(problems, defaults.seasonOverPanels === true && at('seasonOverPanels') && at('seasonOverPanels').initialValue === true, 'theme.seasonOverPanels should start on (true), and so should seasonOverPanels in config.js');
  need(problems, at('seasonOverPanels') && at('seasonOverPanels').title === 'Seasonal pieces over the panels', 'theme.seasonOverPanels should be titled Seasonal pieces over the panels');
  need(problems, at('seasonOverPanels') && /off/i.test(at('seasonOverPanels').description || ''), 'the theme.seasonOverPanels description should say what Off does');
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

// Every field that has rules says what is wrong in plain words, so the message
// an editor reads is ours and not Sanity's
function checkPlainMessages(typeName, problems) {
  fieldsIn(typeByName(typeName)).forEach(field => {
    const rules = constraintsOf(field);
    const messages = rules.filter(rule => rule.name === 'error' && rule.args[0]);
    need(problems, rules.length === 0 || messages.length > 0, typeName + '.' + field.name + ' has rules and no error message in plain words');
  });
}

// Calendar filters: only the name is asked for in the fields. The action starts
// on Hide, the days start from Monday, the calendar code has the pattern of the
// calendars in Dashboard Settings, and the to date may not come before the from
// date. The rule as a whole needs at least one of words, days, a calendar or a
// date, which is a check on the document and not on a field.
function checkCalendarFilters() {
  const problems = [];
  const at = name => fieldAt('calendarFilter.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);
  const type = typeByName('calendarFilter');
  if (!type) return ['calendarFilter is missing from schemas/index.js'];

  need(problems, type.title === 'Calendar filters', 'the calendarFilter type should have the title Calendar filters');
  const titles = { name: 'Rule name', action: 'Action', words: 'Title words', days: 'Days', calendar: 'Calendar', fromDate: 'From date', toDate: 'To date', show: 'Rule on', expires: 'Hide after' };
  Object.keys(titles).forEach(name => need(problems, at(name) && at(name).title === titles[name], 'calendarFilter.' + name + ' should be titled ' + titles[name]));

  need(problems, constraintNamed(rulesOf(at('name')), 'required'), 'calendarFilter.name should be required');
  need(problems, at('name') && /screen/.test(at('name').description || ''), 'the calendarFilter.name description should say the name does not show on the screen');
  ['words', 'days', 'calendar', 'fromDate', 'toDate', 'expires'].forEach(name => {
    need(problems, at(name) && !constraintNamed(rulesOf(at(name)), 'required'), 'calendarFilter.' + name + ' should be optional');
    need(problems, at(name) && /optional/i.test(at(name).description || ''), 'the calendarFilter.' + name + ' description should say it is optional');
  });

  // Hide or Always show, and Hide to start with
  const action = at('action');
  const allowed = action ? constraintNamed(rulesOf(action), 'valid') : null;
  need(problems, action && action.options && action.options.layout === 'radio' && action.initialValue === 'hide', 'calendarFilter.action should be a radio list that starts as hide');
  need(problems, constraintNamed(rulesOf(action), 'required'), 'calendarFilter.action should be required');
  need(problems, allowed && allowed.args[0].join() === choices['calendarFilter.action'].join(), 'calendarFilter.action should only allow: ' + choices['calendarFilter.action'].join(', '));
  need(problems, choicesOf('calendarFilter.action').map(item => item.title).join() === 'Hide,Always show', 'calendarFilter.action should be shown as Hide and Always show');

  // A word of spaces is inside every title, so it is refused
  const words = at('words');
  const wordRules = words && words.of && words.of[0] ? constraintsOf(words.of[0]) : [];
  const wordCheck = constraintNamed(wordRules, 'custom');
  need(problems, constraintNamed(wordRules, 'required'), 'each calendarFilter word should be required, so a line cannot be left empty');
  if (!wordCheck) {
    problems.push('calendarFilter.words should refuse a word that is only spaces');
  } else {
    ['Pre-Season', 'kickoff', 'a'].forEach(good => need(problems, wordCheck.args[0](good) === true, 'the word check refuses "' + good + '"'));
    ['', '   '].forEach(bad => need(problems, typeof wordCheck.args[0](bad) === 'string', 'the word check accepts "' + bad + '"'));
  }

  const days = at('days');
  need(problems, days && days.initialValue === undefined, 'calendarFilter.days should start with no day ticked');

  // The same pattern as the calendar codes in Dashboard Settings, so a code that is typed here can match
  const code = constraintNamed(rulesOf(at('calendar')), 'regex');
  const settingsCode = constraintNamed(rulesOf(fieldAt('dashboardSettings.calendars.id')), 'regex');
  if (!code || !settingsCode) {
    problems.push('calendarFilter.calendar should be checked with the code pattern of the calendars in Dashboard Settings');
  } else {
    need(problems, code.args[0].source === settingsCode.args[0].source, 'calendarFilter.calendar should use the same code pattern as the calendars in Dashboard Settings');
    ['team', 'group', 'build_season'].forEach(good => need(problems, code.args[0].test(good), 'the calendar code pattern refuses ' + good));
    ['Team', 'build-season', 'build season', 'team.ics', ''].forEach(bad => need(problems, !code.args[0].test(bad), 'the calendar code pattern accepts "' + bad + '"'));
  }
  const where = at('calendar') ? at('calendar').description || '' : '';
  need(problems, /Dashboard Settings/.test(where) && /Calendars/.test(where), 'the calendarFilter.calendar description should point to Calendars in Dashboard Settings');
  need(problems, /every calendar/i.test(where), 'the calendarFilter.calendar description should say that empty means every calendar');

  // Both dates are limited to 2020 to 2099, like the dates in the Theme schedule
  ['fromDate', 'toDate'].forEach(name => {
    const rules = rulesOf(at(name));
    const low = constraintNamed(rules, 'min');
    const high = constraintNamed(rules, 'max');
    need(problems, at(name) && at(name).type === 'date', 'calendarFilter.' + name + ' should be a date');
    need(problems, low && high && low.args[0] === '2020-01-01' && high.args[0] === '2099-12-31', 'calendarFilter.' + name + ' should allow 2020-01-01 to 2099-12-31');
  });

  // The to date is not before the from date, and either may be empty
  const toDate = constraintNamed(rulesOf(at('toDate')), 'custom');
  if (!toDate) {
    problems.push('calendarFilter.toDate should be checked so that it is not before the from date');
  } else {
    const run = (value, from) => toDate.args[0](value, { document: { fromDate: from } });
    need(problems, typeof run('2027-04-01', '2027-04-02') === 'string', 'a to date before the from date should be refused');
    need(problems, run('2027-04-02', '2027-04-02') === true && run('2027-04-04', '2027-04-02') === true, 'a to date on or after the from date should be accepted');
    need(problems, run(undefined, '2027-04-02') === true && run('2027-04-04', undefined) === true, 'an empty to date, or a to date with no from date, should be accepted');
  }

  const show = at('show');
  need(problems, show && show.type === 'boolean' && show.initialValue === true, 'calendarFilter.show should be a switch that starts on');
  need(problems, at('expires') && at('expires').type === 'datetime', 'calendarFilter.expires should be a datetime');

  // The rule as a whole needs at least one condition, or it would match every event
  const whole = constraintNamed(constraintsOf(type), 'custom');
  if (!whole) {
    problems.push('calendarFilter should be checked as a whole: a rule needs at least one of words, days, a calendar or a date');
  } else {
    const run = rule => whole.args[0](rule);
    [
      ['a word', { words: ['Pre-Season'] }],
      ['a day', { days: [1] }],
      ['Sunday, which is day 0', { days: [0] }],
      ['a calendar', { calendar: 'group' }],
      ['a from date', { fromDate: '2027-01-01' }],
      ['a to date', { toDate: '2027-01-01' }],
      ['a word and a day', { words: ['Pre-Season'], days: [1, 4] }],
    ].forEach(entry => need(problems, run(entry[1]) === true, 'a rule with ' + entry[0] + ' should be accepted'));
    [
      ['nothing', {}],
      ['a name and an action only', { name: '[Rule]', action: 'hide' }],
      ['empty lists', { words: [], days: [] }],
      ['words that are only spaces', { words: ['  '] }],
      ['a calendar of spaces', { calendar: '  ' }],
      ['an empty calendar', { calendar: '' }],
    ].forEach(entry => need(problems, typeof run(entry[1]) === 'string', 'a rule with ' + entry[0] + ' should be refused'));
    need(problems, /at least one/.test(run({})), 'the message for a rule with no condition should say that at least one is needed');
    need(problems, run(undefined) === true, 'a missing document is left to the other checks');
  }

  need(problems, (type.orderings || []).some(item => item.by && item.by[0].field === 'name' && item.by[0].direction === 'asc'), 'calendarFilter needs an ordering by name, A to Z');
  checkPlainMessages('calendarFilter', problems);

  // The list line: the name, then Off or Expired, the action and each condition the rule has
  const line = fields => type.preview.prepare(Object.assign({ title: '[Rule]' }, fields));
  [
    [line({ action: 'hide', words: ['Pre-Season'], days: [4, 1] }).subtitle, 'Hide · Pre-Season · Mon, Thu'],
    [line({ action: 'show', words: ['Kickoff'] }).subtitle, 'Always show · Kickoff'],
    [line({ action: 'hide', words: ['Pre-Season', 'Practice'], days: [4, 1], calendar: 'group', from: '2027-01-01', to: '2027-02-01' }).subtitle, 'Hide · Pre-Season or Practice · Mon, Thu · group · 2027-01-01 to 2027-02-01'],
    [line({ action: 'hide', days: [0, 6] }).subtitle, 'Hide · Sat, Sun'],
    [line({ action: 'hide', from: '2027-01-01' }).subtitle, 'Hide · from 2027-01-01'],
    [line({ action: 'hide', to: '2027-02-01' }).subtitle, 'Hide · until 2027-02-01'],
    [line({ action: 'hide', words: ['', 'Kickoff'] }).subtitle, 'Hide · Kickoff'],
    [line({ action: 'hide', words: ['Pre-Season'], show: false }).subtitle, 'Off · Hide · Pre-Season'],
    [line({ action: 'hide', words: ['Pre-Season'], expires: '2000-01-01T00:00:00.000Z' }).subtitle, 'Expired · Hide · Pre-Season'],
    [line({ action: 'hide', words: ['Pre-Season'], expires: '2999-01-01T00:00:00.000Z' }).subtitle, 'Hide · Pre-Season'],
    [type.preview.prepare({}).title, 'Rule with no name'],
  ].forEach(entry => need(problems, entry[0] === entry[1], 'the calendar filter list should read "' + entry[1] + '", it reads "' + entry[0] + '"'));
  return problems;
}

// Meeting days: the first and last talk are needed, the length of a talk and the
// time booking closes have a starting value and a range, and the list reads each
// day on one line. The last talk is checked against the first in
// checkMeetingDayTimes.
function checkMeetingDays() {
  const problems = [];
  const at = name => fieldAt('presentationDay.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);
  const type = typeByName('presentationDay');
  if (!type) return ['presentationDay is missing from schemas/index.js'];

  need(problems, type.title === 'Meeting days', 'the presentationDay type should have the title Meeting days');
  const titles = {
    firstSlotAt: 'First talk starts',
    lastSlotAt: 'Last talk starts',
    slotMinutes: 'Length of each talk',
    closeMinutesBefore: 'Booking closes this long before a slot',
    open: 'Open for booking',
  };
  Object.keys(titles).forEach(name => need(problems, at(name) && at(name).title === titles[name], 'presentationDay.' + name + ' should be titled ' + titles[name]));

  ['firstSlotAt', 'lastSlotAt'].forEach(name => {
    need(problems, at(name) && at(name).type === 'datetime' && constraintNamed(rulesOf(at(name)), 'required'), 'presentationDay.' + name + ' should be a required datetime');
  });
  const gap = at('firstSlotAt') ? at('firstSlotAt').description || '' : '';
  need(problems, /gap/.test(gap) && /announcement/.test(gap), 'the presentationDay.firstSlotAt description should tell coaches to leave a gap for the announcement');

  // Whole minutes in a range, with a starting value: [field, starting value, smallest, largest]
  [['slotMinutes', 15, 5, 30], ['closeMinutesBefore', 30, 0, 240]].forEach(entry => {
    const field = at(entry[0]);
    const rules = rulesOf(field);
    const low = constraintNamed(rules, 'min');
    const high = constraintNamed(rules, 'max');
    const name = 'presentationDay.' + entry[0];

    need(problems, field && field.type === 'number' && field.initialValue === entry[1], name + ' should be a number that starts as ' + entry[1]);
    need(problems, low && high && low.args[0] === entry[2] && high.args[0] === entry[3], name + ' should allow ' + entry[2] + ' to ' + entry[3]);
    need(problems, constraintNamed(rules, 'required') && constraintNamed(rules, 'integer'), name + ' should be required and a whole number');
    need(problems, field && (field.description || '').indexOf('from ' + entry[2] + ' to ' + entry[3]) !== -1, 'the ' + name + ' description should give the range, from ' + entry[2] + ' to ' + entry[3]);
  });

  const open = at('open');
  need(problems, open && open.type === 'boolean' && open.initialValue === true, 'presentationDay.open should be a switch that starts on');
  need(problems, (type.orderings || []).some(item => item.by && item.by[0].field === 'firstSlotAt' && item.by[0].direction === 'asc'), 'presentationDay needs an ordering by firstSlotAt, soonest first');
  checkPlainMessages('presentationDay', problems);

  // The list line, in New York time: the day, the first and last talk, and how many slots fit from one to the other
  const line = (firstAt, lastAt, minutes, open) => type.preview.prepare({ first: firstAt, last: lastAt, minutes: minutes, open: open });
  const first = '2026-10-08T18:45:00.000Z';
  const last = '2026-10-08T20:45:00.000Z';
  [
    [line(first, last, 15).title, 'Thu Oct 8, 2:45 PM to 4:45 PM - 9 talks'],
    [line(first, last, undefined).title, 'Thu Oct 8, 2:45 PM to 4:45 PM - 9 talks'],
    [line(first, last, 20).title, 'Thu Oct 8, 2:45 PM to 4:45 PM - 7 talks'],
    [line(first, '2026-10-08T20:50:00.000Z', 15).title, 'Thu Oct 8, 2:45 PM to 4:50 PM - 9 talks'],
    [line(first, first, 15).title, 'Thu Oct 8, 2:45 PM to 2:45 PM - 1 talk'],
    [line(first, '2026-10-08T17:45:00.000Z', 15).title, 'Thu Oct 8, 2:45 PM to 1:45 PM'],
    [line(first, undefined, 15).title, 'Thu Oct 8, 2:45 PM'],
    [line('2026-10-08T16:30:00.000Z', undefined, 15).title, 'Thu Oct 8, 12:30 PM'],
    [line('2026-10-08T04:05:00.000Z', undefined, 15).title, 'Thu Oct 8, 12:05 AM'],
    [line(undefined, last, 15).title, 'Meeting day with no times'],
  ].forEach(entry => need(problems, entry[0] === entry[1], 'the meeting day list should read "' + entry[1] + '", it reads "' + entry[0] + '"'));

  need(problems, line(first, last, 15, false).subtitle === 'Closed for booking', 'the meeting day list should say Closed for booking when the day is not open');
  need(problems, line(first, last, 15, true).subtitle === '' && line(first, last, 15, undefined).subtitle === '', 'the meeting day list should say nothing more when the day is open');
  return problems;
}

// The last talk is a slot of the same meeting: not before the first talk, and on
// the same calendar day on the kiosk's clock. The kiosk's time zone is the one on
// the Theme page, which the check asks Sanity for, so it waits for an answer. A
// stand-in client gives the answer here and writes down what it was asked.
async function checkMeetingDayTimes() {
  const problems = [];
  const custom = constraintNamed(constraintsOf(fieldAt('presentationDay.lastSlotAt')), 'custom');
  if (!custom) return ['presentationDay.lastSlotAt should be checked against the first talk'];

  // answer is the time zone Sanity gives back, or an Error for a question that fails
  async function ask(lastAt, firstAt, answer) {
    const asked = [];
    const getClient = () => ({
      fetch: async (query, params, options) => {
        asked.push({ query: query, options: options });
        if (answer instanceof Error) throw answer;
        return answer;
      },
    });
    const result = await custom.args[0](lastAt, { document: { firstSlotAt: firstAt }, getClient: getClient });
    return { answer: result, asked: asked[0] };
  }

  const newYork = 'America/New_York';
  const first = '2026-10-08T18:45:00.000Z';
  const accepted = [
    ['two hours after the first talk', '2026-10-08T20:45:00.000Z', first],
    ['the same time as the first talk', first, first],
    ['6 PM then 9 PM, which is the next day in UTC and the same day in New York', '2026-10-09T01:00:00.000Z', '2026-10-08T22:00:00.000Z'],
    ['no last talk yet', undefined, first],
    ['no first talk yet', '2026-10-08T20:45:00.000Z', undefined],
  ];
  const refused = [
    ['an hour before the first talk', '2026-10-08T17:45:00.000Z', first],
    ['the next day', '2026-10-09T18:45:00.000Z', first],
    ['past midnight in New York', '2026-10-09T05:00:00.000Z', first],
  ];
  for (const entry of accepted) need(problems, (await ask(entry[1], entry[2], newYork)).answer === true, 'a last talk ' + entry[0] + ' should be accepted');
  for (const entry of refused) need(problems, typeof (await ask(entry[1], entry[2], newYork)).answer === 'string', 'a last talk ' + entry[0] + ' should be refused');

  // The Theme page's zone decides the day, so the same two times can be on different days
  const evening = ['2026-10-09T01:00:00.000Z', '2026-10-08T22:00:00.000Z'];
  need(problems, typeof (await ask(evening[0], evening[1], 'UTC')).answer === 'string', 'with the Theme page time zone UTC, 22:00 and 01:00 UTC are on different days and should be refused');

  // No usable answer from Sanity means America/New_York
  const noAnswer = [['no Theme page', null], ['an empty zone', ''], ['a zone Intl does not know', 'Nowhere/Land'], ['a question that fails', new Error('offline')]];
  for (const entry of noAnswer) {
    need(problems, (await ask(evening[0], evening[1], entry[1])).answer === true, 'with ' + entry[0] + ', the zone should be America/New_York, where those times are on the same day');
  }

  const question = (await ask('2026-10-08T20:45:00.000Z', first, newYork)).asked;
  need(problems, question && question.query.indexOf('"theme"') !== -1 && question.query.indexOf('timeZone') !== -1, 'the lookup should ask for the timeZone of the Theme page, which has the id theme');
  need(problems, question && question.options && question.options.perspective === 'published', 'the lookup should read the published Theme page (perspective published), as the screen does');
  return problems;
}

// Presentations: a first name, a title for the TV, a start, a length, a Google Slides
// link and a status. The slides link has to match the pattern the booking form and
// the slide fetcher on the Mini use, so a link that is not a Google Slides deck never gets in.
function checkPresentations() {
  const problems = [];
  const at = name => fieldAt('presentation.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);
  const type = typeByName('presentation');
  if (!type) return ['presentation is missing from schemas/index.js'];

  need(problems, type.title === 'Presentations', 'the presentation type should have the title Presentations');
  const titles = { name: 'First name', subteam: 'Subteam', topic: 'Title shown on the TV', start: 'Starts at', minutes: 'Length of the talk', deckLink: 'Slides link', status: 'Status' };
  Object.keys(titles).forEach(name => need(problems, at(name) && at(name).title === titles[name], 'presentation.' + name + ' should be titled ' + titles[name]));

  ['name', 'topic', 'start', 'minutes', 'deckLink', 'status'].forEach(name => {
    need(problems, at(name) && constraintNamed(rulesOf(at(name)), 'required'), 'presentation.' + name + ' should be required');
  });
  need(problems, at('subteam') && !constraintNamed(rulesOf(at('subteam')), 'required') && /optional/i.test(at('subteam').description || ''), 'presentation.subteam should be optional, and its description should say so');
  need(problems, at('start') && at('start').type === 'datetime', 'presentation.start should be a datetime');

  // The name is a first name: a space or a digit is refused with a message, a hyphen is fine
  const firstName = constraintNamed(rulesOf(at('name')), 'custom');
  if (!firstName) {
    problems.push('presentation.name should be checked so that it is a first name only');
  } else {
    const run = firstName.args[0];
    ['Alex', 'Mary-Anne', "O'Neil", '', undefined].forEach(good => need(problems, run(good) === true, 'the name check refuses "' + good + '"'));
    ['Alex K', 'Alex2', ' Alex'].forEach(bad => need(problems, typeof run(bad) === 'string' && run(bad).length > 0, 'the name check accepts "' + bad + '"'));
  }
  need(problems, at('name') && /first name/i.test(at('name').description || ''), 'the presentation.name description should say first name');

  // The subteam is picked from a list and nothing else
  const subteam = at('subteam');
  const allowed = subteam ? constraintNamed(rulesOf(subteam), 'valid') : null;
  need(problems, allowed && allowed.args[0].join() === choices['presentation.subteam'].join(), 'presentation.subteam should only allow: ' + choices['presentation.subteam'].join(', '));

  // The length is whole minutes from 5 to 30 and starts at 15
  const minutes = at('minutes');
  const minutesRules = rulesOf(minutes);
  need(problems, minutes && minutes.type === 'number' && minutes.initialValue === 15, 'presentation.minutes should be a number that starts as 15');
  need(problems, constraintNamed(minutesRules, 'integer') && constraintNamed(minutesRules, 'min') && constraintNamed(minutesRules, 'max'), 'presentation.minutes should be a whole number with a smallest and a largest');
  need(problems, minutes && (minutes.description || '').indexOf('from 5 to 30') !== -1, 'the presentation.minutes description should give the range, from 5 to 30');

  // The dashboard cleans a talk with the same length, statuses and starting values (config.js)
  const config = world.dashboard;
  const least = constraintNamed(minutesRules, 'min');
  const most = constraintNamed(minutesRules, 'max');
  need(problems, least && most && least.args[0] === config.limits.talkMinutes.min && most.args[0] === config.limits.talkMinutes.max, 'presentation.minutes should have the limits in config.js, ' + JSON.stringify(config.limits.talkMinutes));
  need(problems, minutes && minutes.initialValue === config.defaultTalk.minutes, 'defaultTalk.minutes in config.js should be the starting length, ' + (minutes && minutes.initialValue));
  need(problems, config.talkStatuses.join() === choices['presentation.status'].join(), 'talkStatuses in config.js should be: ' + choices['presentation.status'].join(', '));
  need(problems, at('status') && at('status').initialValue === config.defaultTalk.status, 'defaultTalk.status in config.js should be the starting status, ' + (at('status') && at('status').initialValue));

  // The slides link: the pattern is the one the booking form uses, and only a Google Slides deck matches it
  const link = at('deckLink');
  const linkRule = constraintNamed(rulesOf(link), 'regex');
  need(problems, link && link.type === 'url', 'presentation.deckLink should be a url');
  if (!linkRule) {
    problems.push('presentation.deckLink should be checked with a pattern');
  } else {
    const pattern = linkRule.args[0];
    need(problems, pattern.source === new RegExp('^https://docs\\.google\\.com/presentation/d/[A-Za-z0-9_-]+').source, 'the presentation.deckLink pattern should be ^https://docs\\.google\\.com/presentation/d/[A-Za-z0-9_-]+');
    [
      'https://docs.google.com/presentation/d/1AbC-d_Ef',
      'https://docs.google.com/presentation/d/1AbC-d_Ef/edit?usp=sharing',
    ].forEach(good => need(problems, pattern.test(good), 'the slides link pattern refuses ' + good));
    [
      'http://docs.google.com/presentation/d/1AbC-d_Ef',
      'https://docs.google.com/document/d/1AbC-d_Ef',
      'https://docs.google.com/presentation/d/',
      'https://docs.google.com/presentation/d/%20',
      'https://docs.google.com.example.net/presentation/d/1AbC-d_Ef',
      'https://docsXgoogle.com/presentation/d/1AbC-d_Ef',
      ' https://docs.google.com/presentation/d/1AbC-d_Ef',
      'see https://docs.google.com/presentation/d/1AbC-d_Ef',
    ].forEach(bad => need(problems, !pattern.test(bad), 'the slides link pattern accepts ' + bad));
  }

  // The status is a radio list of four, scheduled to start with, and nothing else is allowed
  const status = at('status');
  const statusAllowed = status ? constraintNamed(rulesOf(status), 'valid') : null;
  need(problems, status && status.options && status.options.layout === 'radio' && status.initialValue === 'scheduled', 'presentation.status should be a radio list that starts as scheduled');
  need(problems, statusAllowed && statusAllowed.args[0].join() === choices['presentation.status'].join(), 'presentation.status should only allow: ' + choices['presentation.status'].join(', '));

  need(problems, (type.orderings || []).some(item => item.by && item.by[0].field === 'start' && item.by[0].direction === 'asc'), 'presentation needs an ordering by start, soonest first');
  checkPlainMessages('presentation', problems);

  // The list line, in New York time: Thu 2:45 PM - Alex - the title. A talk that is not scheduled says so under it.
  const talk = fields => type.preview.prepare(Object.assign({ start: '2026-10-08T18:45:00.000Z', name: 'Alex', topic: '[Talk title]' }, fields));
  [
    [talk({}).title, 'Thu 2:45 PM - Alex - [Talk title]'],
    [talk({ start: '2026-10-08T16:30:00.000Z' }).title, 'Thu 12:30 PM - Alex - [Talk title]'],
    [talk({ start: '2026-10-08T04:05:00.000Z' }).title, 'Thu 12:05 AM - Alex - [Talk title]'],
    [talk({ start: undefined }).title, 'Alex - [Talk title]'],
    [talk({ topic: undefined }).title, 'Thu 2:45 PM - Alex'],
    [talk({ status: 'scheduled' }).subtitle, ''],
    [talk({ subteam: 'Build' }).subtitle, 'Build'],
    [talk({ status: 'cancelled', subteam: 'Build' }).subtitle, 'Cancelled · Build'],
    [talk({ status: 'done' }).subtitle, 'Done'],
    [talk({ status: 'skipped' }).subtitle, 'Skipped'],
  ].forEach(entry => need(problems, entry[0] === entry[1], 'the presentation list should read "' + entry[1] + '", it reads "' + entry[0] + '"'));
  return problems;
}

// The Team type: a name, a short name, a number and a code, an optional logo, seven
// colors, the mirror switch, the active switch and the order. The starting colors are
// the Prime ones, which are the colors of the screen today (themes/hawktimus.css). The
// seed file docs/seed/teams.ndjson holds the two teams, and the Teams list comes right
// after Leadership in the sidebar.
const teamColorNames = ['primary', 'plate', 'accent', 'neon', 'pink', 'background', 'text'];

function checkTeams() {
  const problems = [];
  const at = name => fieldAt('team.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);
  const type = typeByName('team');
  if (!type) return ['team is missing from schemas/index.js'];

  need(problems, type.title === 'Teams', 'the team type should have the title Teams');
  const titles = { name: 'Team name', shortName: 'Short name', number: 'Team number', code: 'Team code', logo: 'Logo', colors: 'Colors', mirror: 'Mirror the layout', active: 'Active', order: 'Order' };
  Object.keys(titles).forEach(name => need(problems, at(name) && at(name).title === titles[name], 'team.' + name + ' should be titled ' + titles[name]));
  need(problems, fieldsIn(type).map(field => field.name).join() === Object.keys(titles).join(), 'the team fields should be, in this order: ' + Object.keys(titles).join(', '));

  ['name', 'shortName', 'code'].forEach(name => need(problems, constraintNamed(rulesOf(at(name)), 'required'), 'team.' + name + ' should be required'));
  ['number', 'logo'].forEach(name => {
    need(problems, at(name) && !constraintNamed(rulesOf(at(name)), 'required'), 'team.' + name + ' should be optional');
    need(problems, at(name) && /optional/i.test(at(name).description || ''), 'the team.' + name + ' description should say it is optional');
  });
  need(problems, at('logo') && /shared Hawktimus bird/.test(at('logo').description || ''), 'the team.logo description should say that empty means the shared Hawktimus bird');

  // The code is lowercase letters and digits, because the data and the screen use it
  const code = constraintNamed(rulesOf(at('code')), 'regex');
  if (!code) {
    problems.push('team.code should be checked so that it is lowercase');
  } else {
    ['prime', 'nova', 'team2'].forEach(good => need(problems, code.args[0].test(good), 'the team code pattern refuses ' + good));
    ['Prime', 'my team', 'team-2', 'team_2', 'prime\n', ''].forEach(bad => need(problems, !code.args[0].test(bad), 'the team code pattern accepts "' + bad + '"'));
  }

  // The seven colors, in this order, each needed and starting at the Prime value
  const seeded = {};
  world.teamSeed.split('\n').filter(line => line.trim() !== '').forEach(line => {
    try {
      const doc = JSON.parse(line);
      seeded[doc._id] = doc;
    } catch (error) {
      // checked with the seed file below
    }
  });
  const prime = seeded['team-prime'] || { colors: {} };

  need(problems, at('colors') && at('colors').type === 'object', 'team.colors should be an object');
  need(problems, fieldsIn(at('colors') || {}).map(field => field.name).join() === teamColorNames.join(), 'team.colors should hold, in this order: ' + teamColorNames.join(', '));
  teamColorNames.forEach(name => {
    const field = fieldAt('team.colors.' + name);
    need(problems, field && constraintNamed(rulesOf(field), 'required'), 'team.colors.' + name + ' should be required');
    need(problems, field && field.initialValue === prime.colors[name], 'team.colors.' + name + ' should start as ' + prime.colors[name] + ', the Prime value in the seed file, and it starts as ' + (field && field.initialValue));
  });

  // The switches and the order
  const mirror = at('mirror');
  need(problems, mirror && mirror.type === 'boolean' && mirror.initialValue === false, 'team.mirror should be a switch that starts off');
  const active = at('active');
  need(problems, active && active.type === 'boolean' && active.initialValue === true, 'team.active should be a switch that starts on');
  const order = at('order');
  need(problems, order && order.type === 'number' && order.initialValue === 10, 'team.order should be a number that starts as 10');
  need(problems, constraintNamed(rulesOf(order), 'integer'), 'team.order should be a whole number');
  need(problems, order && /10/.test(order.description || ''), 'the team.order description should say that it starts at 10');

  need(problems, (type.orderings || []).some(item => item.by && item.by[0].field === 'order' && item.by[0].direction === 'asc'), 'team needs an ordering by order');
  need(problems, (type.orderings || []).some(item => item.by && item.by[0].field === 'name' && item.by[0].direction === 'asc'), 'team needs an ordering by name, A to Z');
  checkPlainMessages('team', problems);

  // The list line: the name, then Not active, the code and the number
  const line = fields => type.preview.prepare(Object.assign({ title: 'Hawktimus Prime', code: 'prime', number: '3229' }, fields));
  [
    [line({}).subtitle, 'prime · 3229'],
    [line({ active: true }).subtitle, 'prime · 3229'],
    [line({ active: false }).subtitle, 'Not active · prime · 3229'],
    [line({ number: undefined }).subtitle, 'prime'],
    [type.preview.prepare({}).title, 'Team with no name'],
  ].forEach(entry => need(problems, entry[0] === entry[1], 'the team list should read "' + entry[1] + '", it reads "' + entry[0] + '"'));
  need(problems, type.preview.select && type.preview.select.media === 'logo', 'the team list should show each logo (select media: logo)');

  // The Teams line is right after Leadership, and is a list sorted by order
  const entries = world.structure.sidebarEntries;
  const after = entries[entries.map(entry => entry.title).indexOf('Leadership') + 1];
  need(problems, after && after.kind === 'list' && after.type === 'team' && after.title === 'Teams', 'the Teams line should come right after Leadership in structure.js');

  return problems.concat(checkTeamSeed(type));
}

// The seed file: one JSON document a line, fixed ids, only fields the Studio has. The
// values of the two teams are the ones in the work order, and the Prime ones that the
// order leaves out (the background and the text) are the colors of the screen today.
function checkTeamSeed(type) {
  const problems = [];
  const names = fieldsIn(type).map(field => field.name);
  const lines = world.teamSeed.split('\n').filter(line => line.trim() !== '');
  const docs = {};
  const hex = /^#[0-9A-Fa-f]{6}$/;

  const wanted = {
    'team-prime': { number: '3229', code: 'prime', mirror: false, colors: { primary: '#6C18B6', plate: '#3B2A7A', accent: '#FACA2A', neon: '#35F0FF', pink: '#FF2E8C' } },
    'team-nova': { number: '3230', code: 'nova', mirror: true, colors: { primary: '#1F7AE0', plate: '#1E3A6E', accent: '#9BF0FF', neon: '#FF2E8C', pink: '#35F0FF' } },
  };
  need(problems, lines.length === 2, 'docs/seed/teams.ndjson should have two teams, Prime and Nova, it has ' + lines.length);

  lines.forEach((line, index) => {
    const where = 'docs/seed/teams.ndjson line ' + (index + 1);
    let doc;
    try {
      doc = JSON.parse(line);
    } catch (error) {
      return problems.push(where + ' is not JSON');
    }

    docs[doc._id] = doc;
    need(problems, doc._type === 'team', where + ' should have _type team');
    need(problems, typeof doc._id === 'string' && doc._id === 'team-' + doc.code, where + ' should have a fixed _id that is team- and the code, such as team-prime');
    Object.keys(doc).forEach(key => need(problems, key.charAt(0) === '_' || names.indexOf(key) !== -1, where + ': ' + key + ' is not a field of team'));
    need(problems, typeof doc.name === 'string' && doc.name.length > 0 && doc.name.length <= 20, where + ' needs a name of 1 to 20 characters');
    need(problems, typeof doc.shortName === 'string' && doc.shortName.length > 0 && doc.shortName.length <= 8, where + ' needs a shortName of 1 to 8 characters');
    need(problems, typeof doc.number === 'string' && doc.number.length > 0 && doc.number.length <= 6, where + ' needs a number of 1 to 6 characters');
    need(problems, typeof doc.code === 'string' && /^[a-z0-9]{1,10}$/.test(doc.code), where + ' needs a code of 1 to 10 lowercase letters and digits');
    need(problems, doc.colors && Object.keys(doc.colors).join() === teamColorNames.join(), where + ' should have the colors ' + teamColorNames.join(', ') + ', in this order');
    teamColorNames.forEach(name => need(problems, doc.colors && hex.test(doc.colors[name]), where + ': colors.' + name + ' should be # and six hex characters'));
    need(problems, typeof doc.mirror === 'boolean', where + ' should have mirror true or false');
    need(problems, doc.active === true, where + ' should have active true');
    need(problems, Number.isInteger(doc.order), where + ' should have a whole number for order');
  });

  Object.keys(wanted).forEach(id => {
    const doc = docs[id];
    if (!doc) return problems.push('docs/seed/teams.ndjson should have the team ' + id);
    const want = wanted[id];
    need(problems, doc.number === want.number && doc.code === want.code && doc.mirror === want.mirror, id + ' should have number ' + want.number + ', code ' + want.code + ' and mirror ' + want.mirror);
    Object.keys(want.colors).forEach(name => need(problems, doc.colors && doc.colors[name] === want.colors[name], id + ' should have colors.' + name + ' ' + want.colors[name]));
  });

  // Prime is the screen as it is today: its main color, accent, background and text are the Hawktimus theme's
  const themeColor = name => {
    const found = new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})').exec(world.hawktimusCss);
    return found ? found[1].toUpperCase() : '';
  };
  const prime = docs['team-prime'];
  if (prime && prime.colors) {
    [['primary', 'purple'], ['accent', 'yellow'], ['background', 'ground'], ['text', 'white']].forEach(entry => {
      need(problems, prime.colors[entry[0]] && prime.colors[entry[0]].toUpperCase() === themeColor(entry[1]), 'team-prime colors.' + entry[0] + ' should be the --' + entry[1] + ' of themes/hawktimus.css, ' + themeColor(entry[1]));
    });
  }
  const nova = docs['team-nova'];
  need(problems, !prime || !nova || prime.order < nova.order, 'Prime should come before Nova in order');
  return problems;
}

// The Team field: the same on every kind of content that can be for one team. It is
// optional and has no starting value, so empty means Both, and every item that exists
// keeps showing with no change. It uses the radio in team-input.js.
const teamTypes = ['task', 'plan', 'subteam', 'person', 'sponsor', 'presentation', 'presentationDay', 'customPanel', 'tipOrNews', 'extraEvent'];

function checkTeamField() {
  const problems = [];

  teamTypes.forEach(name => {
    const field = fieldAt(name + '.team');
    const where = name + '.team';
    if (!field) return problems.push(name + ' should have a team field');

    const words = field.description || '';
    need(problems, field.type === 'reference' && field.to && field.to.length === 1 && field.to[0].type === 'team', where + ' should be a reference to team');
    need(problems, field.title === 'Team', where + ' should be titled Team');
    need(problems, !constraintNamed(constraintsOf(field), 'required'), where + ' should be optional, because empty means Both');
    need(problems, field.initialValue === undefined, where + ' should have no starting value, so it starts on Both');
    need(problems, /optional/i.test(words) && /Both/.test(words), 'the ' + where + ' description should say that it is optional and that Both shows it always');
    need(problems, field.components && field.components.input === world.teamInput.TeamInput, where + ' should use the radio input, TeamInput in studio/team-input.js (components.input)');
    need(problems, !(field.options && (field.options.disableNew || field.options.filter)), where + ' should be an ordinary reference to a team');
  });

  // No other kind of content points to a team, so the list above is the whole list
  world.types.forEach(type => {
    const field = fieldAt(type.name + '.team');
    const reference = field && field.type === 'reference';
    need(problems, !reference || teamTypes.indexOf(type.name) !== -1, type.name + ' has a team reference that is not in teamTypes in check-schemas.mjs');
  });
  return problems;
}

// The radio. The names and the choices come from the team documents, a team that cannot
// be read leaves Both, and the patches are the ones Studio gives (set and unset).
async function checkTeamInput() {
  const problems = [];
  const input = world.teamInput;
  const prime = { _id: 'team-prime', name: 'Hawktimus Prime', active: true };
  const nova = { _id: 'team-nova', name: 'Hawktimus Nova' };
  const listed = (teams, current) => input.teamChoices(teams, current).map(choice => choice.id + '=' + choice.label).join();

  // the choices
  const onlyBoth = '=Both';
  need(problems, listed([], '') === onlyBoth, 'with no teams the radio should show only Both, it shows ' + listed([], ''));
  [undefined, null, 'text', 5, {}, [null, {}, { _id: 5 }, 'text']].forEach(odd => need(problems, listed(odd, '') === onlyBoth, 'teams that are not a list of teams (' + JSON.stringify(odd) + ') should leave only Both'));
  need(problems, listed([prime, nova], '') === '=Both,team-prime=Hawktimus Prime,team-nova=Hawktimus Nova', 'Both and then each active team, in the order they are given, it shows ' + listed([prime, nova], ''));
  need(problems, listed([prime, Object.assign({}, nova, { active: false })], '') === '=Both,team-prime=Hawktimus Prime', 'a team that is not active should be left out');
  need(problems, listed([prime, Object.assign({}, nova, { active: false })], 'team-nova') === '=Both,team-prime=Hawktimus Prime,team-nova=Hawktimus Nova (not active)', 'a team that is not active but is picked should stay on the list, marked');
  need(problems, listed([prime], 'team-gone') === '=Both,team-prime=Hawktimus Prime,team-gone=A team that could not be read', 'a picked team that is not in the list should still be shown');
  need(problems, listed([], 'team-nova') === '=Both,team-nova=A team that could not be read', 'with no teams read, the picked team should still be shown');
  need(problems, listed([{ _id: 'team-x' }], '') === '=Both,team-x=Team with no name', 'a team with no name should still be a line');

  // the patches: Both clears the field, a team writes a reference
  need(problems, JSON.stringify(input.teamPatch('')) === JSON.stringify({ type: 'unset' }), 'picking Both should clear the field (unset)');
  need(problems, JSON.stringify(input.teamPatch('team-nova')) === JSON.stringify({ type: 'set', value: { _type: 'reference', _ref: 'team-nova' } }), 'picking a team should write a reference to it (set)');

  // reading the teams: the published ones, in order, and nothing that throws
  function clientAnswering(answer) {
    const asked = [];
    return { asked: asked, fetch: async (query, params, options) => { asked.push({ query: query, options: options }); if (answer instanceof Error) throw answer; return answer; } };
  }
  const good = clientAnswering([prime, nova]);
  need(problems, JSON.stringify(await input.readTeams(good)) === JSON.stringify({ teams: [prime, nova], unreadable: false }), 'readTeams should give the teams it is given');
  need(problems, good.asked[0] && good.asked[0].options && good.asked[0].options.perspective === 'published', 'readTeams should read the published teams (perspective published)');
  need(problems, good.asked[0] && good.asked[0].query.indexOf('_type == "team"') !== -1 && /order\(order asc/.test(good.asked[0].query), 'readTeams should ask for the teams, by order');
  need(problems, JSON.stringify(await input.readTeams(clientAnswering(null))) === JSON.stringify({ teams: [], unreadable: false }), 'readTeams with no answer should give no teams');
  const failing = [
    ['a question that fails', clientAnswering(new Error('offline'))],
    ['a client that throws at once', { fetch: () => { throw new Error('no client'); } }],
    ['a client with no fetch', {}],
    ['no client', null],
  ];
  for (const entry of failing) {
    const result = await input.readTeams(entry[1]);
    need(problems, JSON.stringify(result) === JSON.stringify({ teams: [], unreadable: true }), 'readTeams with ' + entry[0] + ' should give no teams and say they could not be read');
  }

  // the screen of it: a radio group, Both first and picked when nothing is, and a team picked when it is the value
  function collect(node, test, found) {
    if (Array.isArray(node)) node.forEach(item => collect(item, test, found));
    else if (node && typeof node === 'object') {
      if (test(node)) found.push(node);
      collect(node.children || [], test, found);
    }
    return found;
  }
  const radios = view => collect(view, node => node.type === 'input' && node.props.type === 'radio', []);
  const patches = [];
  const show = (value, readOnly) => input.TeamInput({ id: 'team', value: value, readOnly: readOnly, onChange: patch => patches.push(patch) });

  const empty = show(undefined, false);
  need(problems, collect(empty, node => node.props && node.props.role === 'radiogroup', []).length === 1, 'the input should be one radio group');
  need(problems, radios(empty).length === 1 && radios(empty)[0].props.checked === true && radios(empty)[0].props.disabled === false, 'with no value and no teams read, the input should show Both, picked');
  radios(empty)[0].props.onChange();
  need(problems, JSON.stringify(patches) === JSON.stringify([{ type: 'unset' }]), 'picking Both in the input should clear the field');

  const picked = radios(show({ _type: 'reference', _ref: 'team-nova' }, false));
  need(problems, picked.length === 2 && picked[0].props.checked === false && picked[1].props.checked === true, 'with a team as the value, that team should be the one picked');
  picked[1].props.onChange();
  need(problems, JSON.stringify(patches[1]) === JSON.stringify({ type: 'set', value: { _type: 'reference', _ref: 'team-nova' } }), 'picking a team in the input should write a reference to it');
  need(problems, radios(show(undefined, true)).every(radio => radio.props.disabled === true), 'a field that is read only should have every line off');
  need(problems, radios(show({ _ref: 5 }, false)).length === 1, 'a value that is not a reference should be read as Both');
  return problems;
}

// The Teams tab of Dashboard Settings: the mode and the minutes of Alternate. The
// choices, the limits and the starting values are the ones in dashboard/config.js.
// Neither is required, because Dashboard Settings published before the tab existed has
// neither and must still publish, and the screen reads that as Prime only and 5 minutes.
const teamNames = ['teamMode', 'alternateMinutes'];

function checkTeamsTab() {
  const problems = [];
  const config = world.dashboard;
  const settings = typeByName('dashboardSettings');
  const at = name => fieldAt('dashboardSettings.' + name);
  const rulesOf = field => (field ? constraintsOf(field) : []);

  need(problems, settings.groups.filter(group => group.title === 'Teams').length === 1, 'Dashboard Settings should have exactly one tab named Teams');
  need(problems, settings.groups.filter(group => group.name === 'teams' && group.title === 'Teams').length === 1, 'the Teams tab should be the group teams');

  // Nothing else is in the tab, so deleting settingsTeams.js removes the whole section
  const inTab = fieldsIn(settings).filter(field => field.group === 'teams').map(field => field.name);
  need(problems, inTab.join() === teamNames.join(), 'the Teams tab should hold, in this order: ' + teamNames.join(', ') + ', not ' + inTab.join(', '));

  need(problems, at('teamMode') && at('teamMode').title === 'Team mode', 'teamMode should be titled Team mode');
  need(problems, at('alternateMinutes') && at('alternateMinutes').title === 'Minutes for each team', 'alternateMinutes should be titled Minutes for each team');

  // The mode is a radio list of the names in config.js, Prime only to start with
  const mode = at('teamMode');
  const modeRules = rulesOf(mode);
  const allowed = constraintNamed(modeRules, 'valid');
  const offered = choicesOf('dashboardSettings.teamMode');
  const modeTitles = { prime: 'Prime only', nova: 'Nova only', alternate: 'Alternate' };
  need(problems, config.teamModes.join() === 'prime,nova,alternate', 'teamModes in config.js should be prime, nova and alternate, not ' + config.teamModes.join());
  need(problems, mode && mode.type === 'string' && mode.options && mode.options.layout === 'radio', 'teamMode should be a radio list');
  need(problems, offered.map(item => item.value).join() === config.teamModes.join(), 'teamMode should offer the names in config.js, in the same order: ' + config.teamModes.join(', '));
  offered.forEach(item => need(problems, item.title === modeTitles[item.value], 'the team mode ' + item.value + ' should be titled ' + modeTitles[item.value]));
  need(problems, allowed && allowed.args[0].join() === config.teamModes.join(), 'teamMode should only allow: ' + config.teamModes.join(', '));
  need(problems, !constraintNamed(modeRules, 'required'), 'teamMode should not be required: an empty mode is Prime only, and the page must still publish');
  need(problems, mode && mode.initialValue === 'prime' && config.defaultSettings.teamMode === 'prime', 'teamMode should start as prime, and so should its default in config.js');
  need(problems, mode && /Alternate/.test(mode.description || '') && /Prime only/.test(mode.description || ''), 'the teamMode description should say what Prime only and Alternate do');

  // The minutes are whole, 1 to 30, 5 to start with, and the description gives the range
  const minutes = at('alternateMinutes');
  const minutesRules = rulesOf(minutes);
  const low = constraintNamed(minutesRules, 'min');
  const high = constraintNamed(minutesRules, 'max');
  need(problems, sameData(config.limits.alternateMinutes, { min: 1, max: 30 }), 'limits.alternateMinutes in config.js should be 1 to 30');
  need(problems, minutes && minutes.type === 'number' && minutes.initialValue === 5 && config.defaultSettings.alternateMinutes === 5, 'alternateMinutes should be a number that starts as 5, and so should its default in config.js');
  need(problems, low && high && low.args[0] === config.limits.alternateMinutes.min && high.args[0] === config.limits.alternateMinutes.max, 'alternateMinutes should have the limits in config.js, ' + JSON.stringify(config.limits.alternateMinutes));
  need(problems, constraintNamed(minutesRules, 'integer'), 'alternateMinutes should be a whole number');
  need(problems, !constraintNamed(minutesRules, 'required'), 'alternateMinutes should not be required: an empty one is 5, and the page must still publish');
  need(problems, minutes && /from 1 to 30/.test(minutes.description || ''), 'the alternateMinutes description should give the range, from 1 to 30');
  teamNames.forEach(name => need(problems, rulesOf(at(name)).some(rule => rule.name === 'error' && rule.args[0]), name + ' has rules and no error message in plain words'));

  // The sample content carries the settings, with values the dashboard accepts
  const sample = world.sample.settings;
  need(problems, config.teamModes.indexOf(sample.teamMode) !== -1, 'the sample settings need a teamMode of ' + config.teamModes.join(', '));
  need(problems, sample.alternateMinutes >= config.limits.alternateMinutes.min && sample.alternateMinutes <= config.limits.alternateMinutes.max, 'the sample settings need alternateMinutes from ' + config.limits.alternateMinutes.min + ' to ' + config.limits.alternateMinutes.max);
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

// The seasonal packs (decorations) are checked by their own script too, so a
// pack that is broken, or an overlay that says it has decorations and has no
// file, fails this run as well.
function checkSeasonGuard() {
  const script = path.join(here, '..', 'tools', 'check-seasons.mjs');
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  if (run.error) return ['the season check could not start: ' + run.error.message];
  if (run.status === 0) return [];
  const lines = (run.stdout + run.stderr).split('\n').filter(line => line.trim() !== '');
  return ['tools/check-seasons.mjs failed:'].concat(lines.map(line => '  ' + line));
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
    world.layoutModule = await load(path.join(dashboardFolder, 'core', 'layout.js'));
    world.overlayRegistry = await load(path.join(dashboardFolder, 'themes', 'overlays', 'registry.js'));
    world.studioThemes = await load(path.join(folder, 'themes.js'));
    world.demoRegistry = await load(path.join(dashboardFolder, 'core', 'demo-screens.js'));
    world.studioDemoScreens = await load(path.join(folder, 'demo-screens.js'));
    world.hiddenRegistry = await load(path.join(dashboardFolder, 'core', 'hidden-transitions.js'));
    world.studioHidden = await load(path.join(folder, 'hidden-transitions.js'));
    world.publishAll = await load(path.join(folder, 'publish-all.js'));
    world.publishAllTool = await load(path.join(folder, 'publish-all-tool.js'));
    world.teamInput = await load(path.join(folder, 'team-input.js'));
    world.sample = JSON.parse(fs.readFileSync(path.join(dashboardFolder, 'data', 'sample', 'content.json'), 'utf8'));
    world.seed = fs.readFileSync(path.join(here, '..', 'docs', 'seed', 'extra-events.ndjson'), 'utf8');
    world.placeSeed = fs.readFileSync(path.join(here, '..', 'docs', 'seed', 'places.ndjson'), 'utf8');
    world.teamSeed = fs.readFileSync(path.join(here, '..', 'docs', 'seed', 'teams.ndjson'), 'utf8');
    world.hawktimusCss = fs.readFileSync(path.join(dashboardFolder, 'themes', 'hawktimus.css'), 'utf8');
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
  check('the Look setting offers the looks in dashboard/config.js and starts on Polished', checkLookSetting);
  check('the Style setting offers the styles in dashboard/config.js and starts on Original, and the Theme page says the style and team set the base values', checkStyleSetting);
  check('the Transitions tab agrees with dashboard/config.js', checkTransitionsTab);
  check('the Night mode tab agrees with dashboard/config.js', checkNightTab);
  check('the Hidden tab agrees with dashboard/config.js and the dashboard registry, and the Play buttons work', checkHiddenTab);
  check('Play announcements has its hidden field, its button and its Demo step', checkPlayAnnouncements);
  check('Run presentation test has its hidden field and its button', checkRunPresentationTest);
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
  check('a calendar filter has a name, an action, title words, days, a calendar and dates, and needs at least one of them', checkCalendarFilters);
  check('a place has a name and a switch, a task has an optional contact and place, and the places seed file can be imported', checkPlaces);
  results.push({ name: 'two places cannot have the same name, capitals ignored', problems: await checkPlaceNames().catch(error => ['the check stopped: ' + error.message]) });
  check('the Presentations tab agrees with dashboard/config.js', checkPresentationsTab);
  check('the Teams tab agrees with dashboard/config.js', checkTeamsTab);
  check('a meeting day has a first and a last talk, a talk length, a booking close time and a one line list entry', checkMeetingDays);
  results.push({ name: 'the last talk of a meeting day is on the same day as the first, in the Theme page time zone', problems: await checkMeetingDayTimes().catch(error => ['the check stopped: ' + error.message]) });
  check('a presentation has a first name, a title, a start, a length, a Google Slides link and a status, and a one line list entry', checkPresentations);
  check('a team has a name, a short name, a number, a code, a logo and seven colors, the Teams line follows Leadership, and the seed file can be imported', checkTeams);
  check('every kind of content that can be for one team has an optional Team field that uses the radio', checkTeamField);
  results.push({ name: 'the Team radio shows Both and each active team, writes and clears the reference, and survives teams that cannot be read', problems: await checkTeamInput().catch(error => ['the check stopped: ' + error.message]) });
  check('starting values match dashboard/config.js', checkStartingValues);
  check('every name in config.js and the sample content has a field', checkDashboardNames);
  check('every document type has a line in the sidebar, and each line opens the right list or page', checkSidebar);
  check('Dashboard Settings, Theme and Demo exist once and the project files agree', checkSettingsPage);
  check('the Publish all tool is in the top bar and keeps the pages that exist once on their fixed ids', checkPublishAll);
  check('every theme and overlay is complete and readable (tools/check-themes.mjs)', checkThemeGuard);
  check('every seasonal pack is complete, and draws only in the empty places (tools/check-seasons.mjs)', checkSeasonGuard);

  process.exitCode = report() > 0 ? 1 : 0;
}

main().catch(error => {
  console.error('Could not load the Studio files: ' + error.message);
  process.exitCode = 1;
});
