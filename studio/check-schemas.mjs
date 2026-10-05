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
  task: withFlags({ title: text(22), subteam: { kind: 'reference', to: 'subteam' }, status: 'string', finishedOn: 'datetime', order: 'number' }),
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
    spotlight: 'boolean',
    spotlightHeadline: text(40),
    spotlightText: text(100),
    order: 'number',
  }),
  person: withFlags({ role: 'string', name: text(17), photo: 'image', showPhoto: 'boolean', order: 'number' }),
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
    nameTransform: 'boolean',
    nameEvery: number(0, 900),
    nameDuration: number(0.5, 10),
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
  headingBlock: { text: text(30) },
  textBlock: { text: text(100) },
  statBlock: { value: text(6), label: text(24) },
  listBlock: { items: strings(34, 5) },
  imageBlock: { address: 'url' },
  progressBlock: { label: text(30), percent: number(0, 100) },
  countdownBlock: { label: text(24), target: 'datetime' },
};

const itemTypes = ['task', 'plan', 'sponsor', 'tipOrNews', 'subteam', 'person', 'customPanel'];

const choices = {
  'task.status': ['blocked', 'in-progress', 'up-next', 'done'],
  'tipOrNews.kind': ['tip', 'news', 'reminder'],
  'person.role': ['Coach', 'Captain', 'Mentor'],
  'dashboardSettings.motion': ['full', 'calm'],
  'dashboardSettings.speed': ['very-slow', 'slow', 'normal', 'fast'],
  'dashboardSettings.frameMetal': ['gold', 'silver'],
  'dashboardSettings.contentSource': ['production', 'sample'],
};

// The panels that can be put in each area of the screen. The Studio lists and
// defaultSettings in config.js must offer the same panels as registry.js.
const rotationAreas = ['grid1', 'grid2'];

// The pages that exist once, after the lists: [title, type]. Each is one document whose id is its type.
const singletonPages = [
  ['Dashboard Settings', 'dashboardSettings'],
  ['Theme', 'theme'],
];

const sidebar = [
  ['Tasks', 'task', 'order'],
  ["Tonight's Plan", 'plan', 'date'],
  ['Extra events', 'extraEvent', 'startDate'],
  ['Sponsors', 'sponsor', 'order'],
  ['Tips and News', 'tipOrNews', 'order'],
  ['Subteams', 'subteam', 'order'],
  ['Leadership', 'person', 'order'],
  ['Custom Panels', 'customPanel', 'order'],
];

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
    ].join('\n'),
  },
};

function makeSandbox() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-studio-'));
  ['schemas', 'structure.js', 'project.js', 'actions.js', 'themes.js', 'sanity.config.js', 'sanity.cli.js'].forEach(name => {
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
    const wanted = name === 'plan' ? 'date' : 'order';
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

  ['glint', 'nameTransform'].forEach(name => {
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
  [['nameEvery', 'nameEvery'], ['crt.everySeconds', 'crtEvery']].forEach(entry => {
    const field = at(entry[0]);
    const custom = field ? constraintNamed(constraintsOf(field), 'custom') : null;
    const limit = config.limits[entry[1]];

    need(problems, limit && limit.min === 0 && limit.shortest === 30, 'limits.' + entry[1] + ' in config.js should have min 0 and shortest 30');
    need(problems, field && /0 to never|never/.test(field.description || ''), entry[0] + ' description should say that 0 means never');
    if (!custom) return problems.push(entry[0] + ' should refuse 1 to 29 with a custom rule (0 or at least 30)');

    const check = custom.args[0];
    need(problems, check(0) === true && check(30) === true && check(900) === true && check(undefined) === true, entry[0] + ' should accept 0, 30 and above, and empty');
    need(problems, typeof check(1) === 'string' && typeof check(29) === 'string', entry[0] + ' should refuse 1 and 29 with a message');
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

  // The tabs: the look settings sit beside Motion and Speed, the page time with the lists, and
  // the name effect and the screen glitch together in Logo and effects
  ['motion', 'speed', 'frameMetal', 'glint'].forEach(name => {
    need(problems, at(name) && at(name).group === 'screen', name + ' should be in the Screen tab');
  });
  const effectsTab = typeByName('dashboardSettings').groups.filter(group => group.name === 'effects')[0];
  need(problems, effectsTab && effectsTab.title === 'Logo and effects', 'Dashboard Settings should have a tab named Logo and effects (group effects)');
  ['nameTransform', 'nameEvery', 'nameDuration', 'crt'].forEach(name => {
    need(problems, at(name) && at(name).group === 'effects', name + ' should be in the Logo and effects tab');
  });
  need(problems, at('crt') && at('crt').title === 'Screen glitch', 'crt should be titled Screen glitch');
  need(problems, at('pageSeconds') && at('pageSeconds').group === 'panels', 'pageSeconds should be in the Panels tab');

  // The sample content carries the new settings, with values the dashboard accepts
  const sample = world.sample.settings;
  need(problems, config.metals.indexOf(sample.frameMetal) !== -1, 'the sample settings need a frameMetal of ' + config.metals.join(' or '));
  need(problems, typeof sample.glint === 'boolean', 'the sample settings need glint, true or false');
  need(problems, typeof sample.nameTransform === 'boolean', 'the sample settings need nameTransform, true or false');
  need(problems, config.contentSources.indexOf(sample.contentSource) !== -1, 'the sample settings need a contentSource of ' + config.contentSources.join(' or '));
  need(problems, typeof sample.switchBackAt === 'string', 'the sample settings need switchBackAt, empty or a time');
  ['pageSeconds', 'nameEvery', 'nameDuration'].forEach(name => {
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
  const buttons = world.config.document.actions([], { schemaType: 'dashboardSettings' });
  const elsewhere = world.config.document.actions([], { schemaType: 'task' });
  need(problems, elsewhere.length === 0, 'only the settings page should get the content source buttons');
  if (buttons.length !== 2 || !buttons.every(button => typeof button === 'function')) {
    return problems.concat('the settings page should add two actions, written as plain functions');
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
  expect('pageSeconds', settings.pageSeconds);
  expect('nameTransform', settings.nameTransform);
  expect('nameEvery', settings.nameEvery);
  expect('nameDuration', settings.nameDuration);
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
  };
}

function checkSidebar() {
  const problems = [];
  const items = world.structure.structure(fakeBuilder()).made.items.map(item => item.made);
  const titles = sidebar.map(entry => entry[0]).concat(singletonPages.map(page => page[0]));
  if (items.map(item => item.title).join() !== titles.join()) problems.push('the sidebar should read, in order: ' + titles.join(', '));

  sidebar.forEach((entry, index) => {
    const list = items[index] && items[index].child && items[index].child.made;
    if (!list || list.type !== entry[1]) return problems.push(entry[0] + ' should open the ' + entry[1] + ' list');
    if (list.defaultOrdering[0].field !== entry[2]) problems.push(entry[0] + ' should be listed by ' + entry[2]);
  });

  singletonPages.forEach((entry, index) => {
    const item = items[sidebar.length + index];
    const page = item && item.child && item.child.made;
    const pageOk = page && page.schemaType === entry[1] && page.documentId === entry[1];
    need(problems, pageOk, entry[0] + ' should open the one document with id ' + entry[1]);
  });
  return problems;
}

function checkSettingsPage() {
  const problems = [];
  // The content source buttons are added to the settings page after the ones Studio keeps
  const actions = ['publish', 'discardChanges', 'delete', 'duplicate', 'unpublish'].map(action => ({ action: action }));
  const kept = world.config.document.actions(actions, { schemaType: 'dashboardSettings' }).map(item => item.action).join();
  const others = world.config.document.actions(actions, { schemaType: 'task' }).length;
  const wanted = 'publish,discardChanges,useSampleContent,useProductionContent';
  if (kept !== wanted) problems.push('the settings page should have these actions: ' + wanted + '. It has: ' + kept);
  if (others !== actions.length) problems.push('other types should keep every action');

  // The Theme page is made the same way: nothing that copies it or takes it away, and no buttons of its own
  const themeActions = world.config.document.actions(actions, { schemaType: 'theme' }).map(item => item.action).join();
  if (themeActions !== 'publish,discardChanges') problems.push('the Theme page should have these actions: publish,discardChanges. It has: ' + themeActions);

  const templates = [{ templateId: 'task' }, { templateId: 'dashboardSettings' }, { templateId: 'theme' }];
  const offered = world.config.document.newDocumentOptions(templates, {}).map(item => item.templateId).join();
  if (offered !== 'task') problems.push('the New menu should not offer Dashboard Settings or Theme');

  const named = world.structure.settingsType === 'dashboardSettings' && world.structure.settingsId === 'dashboardSettings';
  need(problems, named, 'structure.js should name the settings type and id dashboardSettings');
  const themeNamed = world.structure.themeType === 'theme' && world.structure.themeId === 'theme';
  need(problems, themeNamed, 'structure.js should name the theme type and id theme');
  need(problems, world.structure.singletonTypes.join() === 'dashboardSettings,theme', 'structure.js should list the pages that exist once: dashboardSettings, theme');
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

// Extra events: events that are not on BAND. The title, start date and
// show switch are asked for, the rest is optional, the end date may not come
// before the start date, and an end time needs a start time. The seed file in
// docs/seed has to be something `sanity dataset import --missing` can load
// twice with no change: fixed ids, real fields and values the Studio accepts.
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
    world.sample = JSON.parse(fs.readFileSync(path.join(dashboardFolder, 'data', 'sample', 'content.json'), 'utf8'));
    world.seed = fs.readFileSync(path.join(here, '..', 'docs', 'seed', 'extra-events.ndjson'), 'utf8');
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
  check('Content source and the switch back time agree with dashboard/config.js, and the two buttons work', checkContentSource);
  check('a person has an optional photo and a switch that starts on, as in dashboard/config.js', checkPersonPhoto);
  check('the themes and overlays in studio/themes.js are the ones in the dashboard registries', checkThemeLists);
  check('the Theme page agrees with dashboard/config.js, needs a start and an end for each rule, and checks the time zone', checkTheme);
  check('an extra event needs a title and a start date, and the seed file can be imported', checkExtraEvents);
  check('starting values match dashboard/config.js', checkStartingValues);
  check('every name in config.js and the sample content has a field', checkDashboardNames);
  check('the sidebar is in the right order', checkSidebar);
  check('Dashboard Settings and Theme exist once and the project files agree', checkSettingsPage);
  check('every theme and overlay is complete and readable (tools/check-themes.mjs)', checkThemeGuard);

  process.exitCode = report() > 0 ? 1 : 0;
}

main().catch(error => {
  console.error('Could not load the Studio files: ' + error.message);
  process.exitCode = 1;
});
