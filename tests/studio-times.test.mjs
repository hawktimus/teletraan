// Dates and times in the Studio: every field a person types shows Eastern time and cannot be switched to the browser's zone,
// and a time between 22:00 and 06:00 gets a warning. A field the computer writes (read only, or a one line status field)
// is left as it is. docs/audit.md, item 17.
//
//   node tests/studio-times.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { datetimeOptions, hourIn, oddHour } from '../studio/schemas/presentationTimes.js';

const schemas = fileURLToPath(new URL('../studio/schemas/', import.meta.url));

test('the options say Eastern time and no switching', () => {
  assert.deepEqual(datetimeOptions, { displayTimeZone: 'America/New_York', allowTimeZoneSwitch: false });
});

test('the hour is the hour on the Eastern clock, in winter and in summer', () => {
  assert.equal(hourIn('2026-11-17T17:00:00Z', 'America/New_York'), 12, 'noon in November is 17:00 UTC');
  assert.equal(hourIn('2026-07-17T16:00:00Z', 'America/New_York'), 12, 'and 16:00 UTC in July');
  assert.equal(hourIn('2026-11-17T23:00:00Z', 'America/New_York'), 18);
  assert.equal(hourIn('not a time', 'America/New_York'), null);
  assert.equal(hourIn(undefined, 'America/New_York'), null);
});

test('a time from 06:00 to 21:59 is fine, an empty value is fine, and the rest is a warning that says the time', () => {
  assert.equal(oddHour(undefined), true);
  assert.equal(oddHour('2026-11-17T11:00:00Z'), true, '06:00 Eastern');
  assert.equal(oddHour('2026-11-18T02:59:00Z'), true, '21:59 Eastern');
  const late = oddHour('2026-11-18T04:00:00Z');
  assert.equal(typeof late, 'string');
  assert.match(late, /11:00 PM in Eastern time/);
  assert.equal(typeof oddHour('2026-11-17T10:59:00Z'), 'string', '05:59 Eastern');
  assert.match(oddHour('2026-11-17T04:00:00Z'), /11:00 PM/, 'the noon typed in the wrong zone lands here');
});

test('every datetime field a person types has the Eastern options', () => {
  const missing = [];
  fs.readdirSync(schemas).filter(name => name.endsWith('.js')).forEach(name => {
    const lines = fs.readFileSync(path.join(schemas, name), 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (!/type: 'datetime'/.test(line)) return;
      // A field on one line is a status field the computer writes
      if (/defineField\(\{ name:/.test(line)) return;
      const around = lines.slice(Math.max(0, index - 6), index + 8).join('\n');
      if (/readOnly: true/.test(around) || /options: datetimeOptions/.test(around)) return;
      missing.push(name + ':' + (index + 1));
    });
  });
  assert.deepEqual(missing, [], 'these datetime fields show the browser zone with no label');
});

test('the Studio has one apiVersion, the same as the screen, and no file repeats it', async () => {
  const { apiVersion } = await import('../studio/project.js');
  const { sanity } = await import('../dashboard/config.js');
  assert.equal(apiVersion, sanity.apiVersion);
  const studio = fileURLToPath(new URL('../studio/', import.meta.url));
  const repeats = [];
  const walk = folder => fs.readdirSync(folder, { withFileTypes: true }).forEach(entry => {
    if (entry.name === 'node_modules' || entry.name === 'dist') return;
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.m?js$/.test(entry.name) && file !== path.join(studio, 'project.js') && fs.readFileSync(file, 'utf8').includes(apiVersion)) repeats.push(path.relative(studio, file));
  });
  walk(studio);
  assert.deepEqual(repeats, [], 'import apiVersion from project.js instead');
});

test('@sanity/icons is declared, in the manifest and in the lockfile, because 37 files import it', () => {
  const studio = fileURLToPath(new URL('../studio/', import.meta.url));
  const manifest = JSON.parse(fs.readFileSync(path.join(studio, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(studio, 'package-lock.json'), 'utf8'));
  assert.ok(manifest.dependencies['@sanity/icons']);
  assert.equal(lock.packages[''].dependencies['@sanity/icons'], manifest.dependencies['@sanity/icons'], 'npm ci needs the two to agree');
  assert.ok(lock.packages['node_modules/@sanity/icons'], 'and the package is in the lockfile');
});

finish();
