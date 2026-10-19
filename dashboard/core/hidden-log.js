// What the wall remembers about the last hidden transition, so the control page can say what happened on
// the TV (core/now-report.js sends it, the Status tab of the control page shows it). Plain functions and one
// small record in memory: nothing from the page, so tests/hidden-run-log.test.mjs can run them.
//
// A run is { kind, at, steps, ignored, browser, imageTypes }:
//   kind        the hidden transition, 'desktop' or 'redEyes'
//   at          the time it began, as an ISO text
//   steps       short lines in the order they happened. The control page reads these, so the first words of
//               a line are fixed: 'pile', 'picture <file> loaded <w>x<h> after <n>ms',
//               'picture <file> FAILED: <why>', 'picture none', 'on screen', 'effect shown', 'rebuild ok',
//               'stopped', 'failed', 'total'
//   ignored     why a requested transition did not play, or '' when it did
//   browser     the browser, in a few words
//   imageTypes  whether the browser could read a PNG and a WebP (true, false, or null while not tested)
// The record holds the last run only. A transition that is ignored replaces it, so the page always shows the
// newest thing that happened.

const browserNames = [[/Edg\/(\d+)/, 'Edge'], [/Firefox\/(\d+)/, 'Firefox'], [/Chromium\/(\d+)/, 'Chromium'], [/Chrome\/(\d+)/, 'Chrome'], [/Version\/(\d+)[^]*Safari/, 'Safari']];
const systemNames = [[/Android/, 'Android'], [/Linux|X11/, 'Linux'], [/Mac OS X/, 'Mac'], [/Windows/, 'Windows']];

// The user agent in a few words: 'Chromium 109 Linux'. A text it cannot read is cut short.
export function shortBrowser(agent) {
  const text = typeof agent === 'string' ? agent : '';
  if (text === '') return '';

  const found = browserNames.map(pair => ({ match: pair[0].exec(text), name: pair[1] })).find(item => item.match);
  const system = systemNames.find(pair => pair[0].test(text));
  if (!found) return text.slice(0, 30);
  return found.name + ' ' + found.match[1] + (system ? ' ' + system[1] : '');
}

const memory = {
  run: null, // the run now or the last one
  types: { png: null, webp: null },
  browser: '',
  clock: () => Date.now(),
  began: 0,
};

export function setBrowser(agent) {
  memory.browser = shortBrowser(agent);
}

export function setImageTypes(types) {
  const source = types && typeof types === 'object' ? types : {};
  memory.types = { png: typeof source.png === 'boolean' ? source.png : null, webp: typeof source.webp === 'boolean' ? source.webp : null };
}

function tenths(milliseconds) {
  return (Math.round(milliseconds / 100) / 10).toFixed(1);
}

export function secondsText(milliseconds) {
  return tenths(milliseconds) + 's';
}

// A transition begins. clock gives milliseconds and is passed in only by the tests.
export function startRun(kind, now = new Date(), clock = () => Date.now()) {
  memory.clock = clock;
  memory.began = clock();
  memory.run = { kind: kind, at: now.toISOString(), steps: [], ignored: '' };
  return memory.run;
}

// One line for the run in progress. Nothing happens when no run has begun.
export function noteStep(text) {
  if (memory.run && memory.run.ignored === '') memory.run.steps.push(String(text));
}

export function runSeconds() {
  return memory.clock() - memory.began;
}

// The run ends with its total time
export function finishRun() {
  if (memory.run && memory.run.ignored === '') noteStep('total ' + secondsText(memory.clock() - memory.began));
}

// A transition was asked for and did not play, or began and never started
export function noteIgnored(kind, reason, now = new Date()) {
  memory.run = { kind: kind, at: now.toISOString(), steps: [], ignored: String(reason) };
}

// The last run for the report, always complete (a run that never happened is empty)
export function hiddenRunReport() {
  const run = memory.run || { kind: '', at: '', steps: [], ignored: '' };
  return {
    kind: run.kind,
    at: run.at,
    steps: run.steps.slice(),
    ignored: run.ignored,
    browser: memory.browser,
    imageTypes: { png: memory.types.png, webp: memory.types.webp },
  };
}

// For the tests: back to nothing
export function resetRunLog() {
  memory.run = null;
  memory.types = { png: null, webp: null };
  memory.browser = '';
}
