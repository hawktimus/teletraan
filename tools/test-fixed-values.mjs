// Tests that the screen ignores four stored settings and uses fixed values instead
// (dashboard/core/constants.js): when night mode starts and ends, how long the title
// card waits for the speaker, and how long a talk may run past its slot. Dashboard
// Settings still keeps a hidden field for each, so a page saved with other values
// opens and publishes, but the values on it must change nothing. The hidden fields
// themselves are checked in studio/check-schemas.mjs. Nothing is drawn and nothing
// touches the network.
//
//   node tools/test-fixed-values.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const docsFolder = fileURLToPath(new URL('../docs/', import.meta.url));

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-fixed-values-'));
fs.mkdirSync(path.join(workFolder, 'dashboard/core'), { recursive: true });
fs.mkdirSync(path.join(workFolder, 'dashboard/themes/overlays'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(workFolder, 'dashboard', file));
});
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, 'core', file), path.join(workFolder, 'dashboard/core', file));
});
const base = pathToFileURL(path.join(workFolder, 'dashboard')).href + '/';
const config = await import(base + 'config.js');
const constants = await import(base + 'core/constants.js');
const night = await import(base + 'core/night.js');
const presentation = await import(base + 'core/presentation.js');
const { normalizeContent, normalizeSample } = await import(base + 'core/sanity.js');
const { withDefaults } = await import(base + 'core/content.js');

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const names = ['nightStart', 'nightEnd', 'noShowMinutes', 'graceMinutes'];
const eastern = 'America/New_York';
const at = text => new Date(text); // always written with a Z, so it means the same on every computer

// What a page might hold in the four hidden fields: other numbers and times, nothing, and things that are not either
const oddStored = [
  { nightStart: '12:00', nightEnd: '13:00', noShowMinutes: 1, graceMinutes: 0 },
  { nightStart: '09:00', nightEnd: '17:00', noShowMinutes: 15, graceMinutes: 10 },
  { nightStart: '00:00', nightEnd: '00:00', noShowMinutes: 0, graceMinutes: -3 },
  { nightStart: 'late', nightEnd: 'soon', noShowMinutes: 'soon', graceMinutes: 'ten' },
  { nightStart: 2330, nightEnd: 1130, noShowMinutes: NaN, graceMinutes: Infinity },
  { nightStart: null, nightEnd: null, noShowMinutes: null, graceMinutes: null },
  { nightStart: undefined, nightEnd: undefined, noShowMinutes: undefined, graceMinutes: undefined },
  {},
];

// The fixed values -------------------------------------------------------------

test('constants.js holds the four values with the numbers the Studio fields start as, and nothing else', () => {
  assert.deepEqual(Object.keys(constants).sort(), names.slice().sort());
  assert.equal(constants.nightStart, '23:30');
  assert.equal(constants.nightEnd, '11:30');
  assert.equal(constants.noShowMinutes, 5);
  assert.equal(constants.graceMinutes, 5);
});

test('config.js has no default and no limit for the four any more', () => {
  names.forEach(name => {
    assert.equal(name in config.defaultSettings, false, name + ' in defaultSettings');
    assert.equal(name in config.limits, false, name + ' in limits');
  });
  names.forEach(name => assert.equal(name in withDefaults({}).settings, false, name + ' in a page with no settings'));
});

// Night mode ----------------------------------------------------------------------

test('night mode runs from 23:30 to 11:30 in the Look page zone, whatever start and end the settings hold', () => {
  // 15 January 2027: New York is UTC-5, so 04:30Z is 23:30 and 16:30Z is 11:30
  const moments = [
    ['2027-01-15T04:29:00Z', false, '23:29'],
    ['2027-01-15T04:30:00Z', true, '23:30'],
    ['2027-01-15T05:00:00Z', true, 'midnight'],
    ['2027-01-15T09:00:00Z', true, '04:00'],
    ['2027-01-15T16:29:00Z', true, '11:29'],
    ['2027-01-15T16:30:00Z', false, '11:30'],
    ['2027-01-15T17:30:00Z', false, '12:30'],
    ['2027-01-15T22:00:00Z', false, '17:00'],
  ];

  oddStored.forEach(stored => {
    const settings = Object.assign({ nightEnabled: true, nightPreview: false }, stored);
    moments.forEach(([when, wanted, label]) => {
      assert.equal(night.nightWanted(settings, eastern, at(when), ''), wanted, label + ' with ' + JSON.stringify(stored));
    });
  });
});

test('the switch, the preview and the address still decide as before, with odd times stored', () => {
  const noon = at('2027-01-15T17:00:00Z');
  const midnight = at('2027-01-15T05:00:00Z');
  const stored = { nightStart: '12:00', nightEnd: '13:00' };

  assert.equal(night.nightWanted(Object.assign({ nightEnabled: false }, stored), eastern, midnight, ''), false);
  assert.equal(night.nightWanted(Object.assign({ nightEnabled: false, nightPreview: true }, stored), eastern, noon, ''), true);
  assert.equal(night.nightWanted(Object.assign({ nightEnabled: true }, stored), eastern, noon, 'on'), true);
  assert.equal(night.nightWanted(Object.assign({ nightEnabled: true }, stored), eastern, midnight, 'off'), false);
});

// Presentations --------------------------------------------------------------------

const second = 1000;
const minute = 60 * second;
const start = new Date('2026-10-08T19:00:00Z');
const after = offset => new Date(start.getTime() + offset);
const talk = { id: 'presentation-a1', name: 'Alex', subteam: 'Programming', topic: '[Swerve drive]', start: start, minutes: 15, status: 'scheduled' };
const manifest = { ok: true, pages: ['001.jpg', '002.jpg', '003.jpg'], fetchedAt: '2026-10-08T18:00:00Z', refreshed: false };

function inputAt(now, stored) {
  return { now: now, talks: [talk], settings: Object.assign({ presentationsEnabled: true }, stored), skipped: new Set(), announcing: false, slides: manifest };
}

test('a talk is due until its minutes and five more are used up, whatever overrun the settings hold', () => {
  oddStored.forEach(stored => {
    const settings = Object.assign({ presentationsEnabled: true }, stored);
    const label = JSON.stringify(stored);

    assert.equal(presentation.dueTalk([talk], after(17 * minute), settings, new Set()), talk, 'at 3:17 with ' + label);
    assert.equal(presentation.dueTalk([talk], after(20 * minute - 1), settings, new Set()), talk, 'just before 3:20 with ' + label);
    assert.equal(presentation.dueTalk([talk], after(20 * minute), settings, new Set()), null, 'at 3:20 with ' + label);
  });
});

test('a talk on its slides ends five minutes after its slot, on whatever slide, whatever overrun the settings hold', () => {
  const state = { name: 'presenting', talk: talk, count: 3, slide: 1, black: false, keyAt: null, escapedAt: null };

  oddStored.forEach(stored => {
    const label = JSON.stringify(stored);

    assert.equal(presentation.nextState(state, inputAt(after(20 * minute - 1), stored)), state, 'just before 3:20 with ' + label);
    assert.equal(presentation.nextState(state, inputAt(after(20 * minute), stored)).name, 'thanks', 'at 3:20 with ' + label);
  });
});

test('the title card waits five minutes for the speaker, whatever wait the settings hold', () => {
  oddStored.forEach(stored => {
    const label = JSON.stringify(stored);
    const title = presentation.nextState(presentation.idleState(), inputAt(after(0), stored));
    assert.equal(title.name, 'title', label);

    const waiting = presentation.nextState(title, inputAt(after(5 * minute - 1), stored));
    assert.equal(waiting.name, 'title', 'just before five minutes with ' + label);
    const skipped = presentation.nextState(waiting, inputAt(after(5 * minute), stored));
    assert.equal(skipped.name, 'skipped', 'at five minutes with ' + label);
    assert.equal(skipped.reason, 'no-show', label);
  });
});

test('talkEnd takes an overrun in minutes, which is the fixed one when none is given', () => {
  assert.equal(presentation.talkEnd(talk).toISOString(), '2026-10-08T19:20:00.000Z');
  assert.equal(presentation.talkEnd(talk, constants.graceMinutes).toISOString(), '2026-10-08T19:20:00.000Z');
  assert.equal(presentation.talkEnd(talk, 0).toISOString(), '2026-10-08T19:15:00.000Z', 'the Up Next panel asks for none');
});

// The reader -----------------------------------------------------------------------

test('the reader leaves the four stored values out of the settings, from Sanity and from the sample', () => {
  oddStored.forEach(stored => {
    const label = JSON.stringify(stored);
    const settings = Object.assign({ pageSeconds: 30 }, stored);

    [normalizeContent({ settings: settings }).settings, normalizeSample({ settings: settings }).settings].forEach(read => {
      names.forEach(name => assert.equal(name in read, false, name + ' with ' + label));
      assert.equal(read.pageSeconds, 30, 'the rest of the settings come through with ' + label);
    });
  });
});

test('nothing in the dashboard reads the four from the settings: they appear only in constants.js and where the reader leaves them out', () => {
  const found = [];
  const walk = folder => fs.readdirSync(path.join(dashboardFolder, folder), { withFileTypes: true }).forEach(entry => {
    const where = path.join(folder, entry.name);
    if (entry.isDirectory()) return entry.name === 'data' || entry.name === 'fonts' ? undefined : walk(where);
    if (!entry.name.endsWith('.js')) return;

    const code = fs.readFileSync(path.join(dashboardFolder, where), 'utf8').split('\n').map(line => line.replace(/\/\/.*$/, '')).join('\n');
    if (/\.(nightStart|nightEnd|noShowMinutes|graceMinutes)\b/.test(code)) found.push(where + ' reads one of them as a property');
    if (/\[\s*['"](nightStart|nightEnd|noShowMinutes|graceMinutes)['"]\s*\]/.test(code)) found.push(where + ' reads one of them by name');
    if (/['"](nightStart|nightEnd|noShowMinutes|graceMinutes)['"]/.test(code) && where !== path.join('core', 'sanity.js')) found.push(where + ' names one of them in quotes');
  });
  walk('.');

  assert.deepEqual(found, []);
});

test('the docs give the same fixed values as constants.js', () => {
  const nightDoc = fs.readFileSync(path.join(docsFolder, 'night-mode.md'), 'utf8');
  const talkDoc = fs.readFileSync(path.join(docsFolder, 'presentations.md'), 'utf8');

  assert.ok(nightDoc.includes(constants.nightStart) && nightDoc.includes(constants.nightEnd), 'docs/night-mode.md names ' + constants.nightStart + ' and ' + constants.nightEnd);
  assert.ok(nightDoc.includes('dashboard/core/constants.js'), 'docs/night-mode.md says where they are');
  assert.ok(new RegExp('waits ' + constants.noShowMinutes + '\\s+minutes').test(talkDoc), 'docs/presentations.md gives the wait for the speaker');
  assert.ok(new RegExp('run ' + constants.graceMinutes + '\\s+minutes past').test(talkDoc), 'docs/presentations.md gives the overrun');
  assert.ok(talkDoc.includes('dashboard/core/constants.js'), 'docs/presentations.md says where they are');
});

// Run them

let failures = 0;
try {
  for (const entry of tests) {
    try {
      await entry.run();
      console.log('ok    ' + entry.name);
    } catch (error) {
      failures += 1;
      console.log('FAIL  ' + entry.name);
      console.log(error);
    }
  }
} finally {
  fs.rmSync(workFolder, { recursive: true, force: true });
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
