// Loads every schema without installing anything and checks it against what
// the dashboard reads. Run it in this folder with: node check-schemas.mjs

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
  person: withFlags({ role: 'string', name: text(17), order: 'number' }),
  customPanel: withFlags({ title: text(7), blocks: { kind: 'blocks', max: 6 }, order: 'number' }),
  dashboardSettings: {
    team: object({ name: text(16), number: text(5), school: text(30) }),
    motion: 'string',
    speed: 'string',
    countdown: object({ kickoffLabel: text(12), kickoff: 'datetime', rolloutLabel: text(12), rollout: 'datetime' }),
    alert: object({ on: 'boolean', headline: text(24), message: text(90), until: 'datetime' }),
    rotation: object({ grid1: rows(panelStep), grid2: rows(panelStep), tickerSeconds: number(6, 120) }),
    doneDays: 'number',
    safetyDaysSince: 'date',
    crt: object({ on: 'boolean', everyMinutes: 'number' }),
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
};

// The panels that can be put in each area of the screen. The Studio lists and
// defaultSettings in config.js must offer the same panels as registry.js.
const rotationAreas = ['grid1', 'grid2'];

const sidebar = [
  ['Tasks', 'task', 'order'],
  ["Tonight's Plan", 'plan', 'date'],
  ['Sponsors', 'sponsor', 'order'],
  ['Tips and News', 'tipOrNews', 'order'],
  ['Subteams', 'subteam', 'order'],
  ['Leadership', 'person', 'order'],
  ['Custom Panels', 'customPanel', 'order'],
];

// The real 'sanity' package is not installed, so a stand-in with the same
// function names sits next to a copy of the files that import it.
const standIn = {
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
  ].join('\n'),
  'structure.js': 'export const structureTool = options => ({ options: options });',
  'cli.js': 'export const defineCliConfig = config => config;',
};

function makeSandbox() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-studio-'));
  ['schemas', 'structure.js', 'project.js', 'sanity.config.js', 'sanity.cli.js'].forEach(name => {
    fs.cpSync(path.join(here, name), path.join(folder, name), { recursive: true });
  });
  fs.writeFileSync(path.join(folder, 'package.json'), JSON.stringify({ type: 'module' }));

  const stub = path.join(folder, 'node_modules', 'sanity');
  fs.mkdirSync(stub, { recursive: true });
  Object.keys(standIn).forEach(name => fs.writeFileSync(path.join(stub, name), standIn[name]));
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
  expect('motion', settings.motion);
  expect('speed', settings.speed);
  expect('countdown.kickoffLabel', settings.countdown.kickoffLabel);
  expect('countdown.rolloutLabel', settings.countdown.rolloutLabel);
  expect('alert.on', settings.alert.on);
  expect('rotation.grid1', settings.rotation.grid1);
  expect('rotation.grid2', settings.rotation.grid2);
  expect('rotation.tickerSeconds', settings.rotation.tickerSeconds);
  expect('doneDays', settings.doneDays);
  expect('crt.on', settings.crt.on);
  expect('crt.everyMinutes', settings.crt.everyMinutes);
  expect('calendars', settings.calendars);

  // A missing show means on. The Studio writes it out so its switch shows on.
  expect('announcements', settings.announcements.map(item => Object.assign({ show: true }, item)));

  const kickoff = fieldAt('dashboardSettings.countdown.kickoff').initialValue;
  const kickoffOk = kickoff && localTime(kickoff) === settings.countdown.kickoff;
  need(problems, kickoffOk, 'countdown.kickoff should start at ' + settings.countdown.kickoff + ' in Holly Springs');
  if (fieldAt('dashboardSettings.countdown.rollout').initialValue) problems.push('countdown.rollout should start empty');
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

  const lists = { tasks: 'task', sponsors: 'sponsor', tipsAndNews: 'tipOrNews', subteams: 'subteam', people: 'person' };
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
  const titles = sidebar.map(entry => entry[0]).concat('Dashboard Settings');
  if (items.map(item => item.title).join() !== titles.join()) problems.push('the sidebar should read, in order: ' + titles.join(', '));

  sidebar.forEach((entry, index) => {
    const list = items[index] && items[index].child && items[index].child.made;
    if (!list || list.type !== entry[1]) return problems.push(entry[0] + ' should open the ' + entry[1] + ' list');
    if (list.defaultOrdering[0].field !== entry[2]) problems.push(entry[0] + ' should be listed by ' + entry[2]);
  });

  const page = items[items.length - 1] && items[items.length - 1].child && items[items.length - 1].child.made;
  const pageOk = page && page.schemaType === 'dashboardSettings' && page.documentId === 'dashboardSettings';
  need(problems, pageOk, 'Dashboard Settings should open the one document with id dashboardSettings');
  return problems;
}

function checkSettingsPage() {
  const problems = [];
  const actions = ['publish', 'discardChanges', 'delete', 'duplicate', 'unpublish'].map(action => ({ action: action }));
  const kept = world.config.document.actions(actions, { schemaType: 'dashboardSettings' }).map(item => item.action).join();
  const others = world.config.document.actions(actions, { schemaType: 'task' }).length;
  if (kept !== 'publish,discardChanges') problems.push('the settings page should keep only publish and discardChanges, it keeps: ' + kept);
  if (others !== actions.length) problems.push('other types should keep every action');

  const templates = [{ templateId: 'task' }, { templateId: 'dashboardSettings' }];
  const offered = world.config.document.newDocumentOptions(templates, {}).map(item => item.templateId).join();
  if (offered !== 'task') problems.push('the New menu should not offer Dashboard Settings');

  const named = world.structure.settingsType === 'dashboardSettings' && world.structure.settingsId === 'dashboardSettings';
  need(problems, named, 'structure.js should name the settings type and id dashboardSettings');
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

async function main() {
  const folder = makeSandbox();
  try {
    world.types = (await load(path.join(folder, 'schemas', 'index.js'))).schemaTypes;
    world.config = (await load(path.join(folder, 'sanity.config.js'))).default;
    world.cli = (await load(path.join(folder, 'sanity.cli.js'))).default;
    world.structure = await load(path.join(folder, 'structure.js'));
    world.dashboard = await load(path.join(dashboardFolder, 'config.js'));
    world.registry = await load(path.join(dashboardFolder, 'registry.js'));
    world.sample = JSON.parse(fs.readFileSync(path.join(dashboardFolder, 'data', 'sample', 'content.json'), 'utf8'));
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
  check('starting values match dashboard/config.js', checkStartingValues);
  check('every name in config.js and the sample content has a field', checkDashboardNames);
  check('the sidebar is in the right order', checkSidebar);
  check('Dashboard Settings exists once and the project files agree', checkSettingsPage);

  process.exitCode = report() > 0 ? 1 : 0;
}

main().catch(error => {
  console.error('Could not load the Studio files: ' + error.message);
  process.exitCode = 1;
});
