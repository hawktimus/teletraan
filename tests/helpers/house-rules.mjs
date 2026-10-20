// Small tools for the tests that guard the house rules (tests/house-rules.test.mjs and its neighbours).
// Every failure is written the same way, so a student reads it the same way every time:
//
//   FAIL  <the rule, in a few words>
//         <file> line <number>: <what is wrong>
//         ...
//         Why: <the house rule>
//         Do instead: <what to do>
//
// A test file makes a checker with makeChecker(), calls check() once for each rule and ends with finish().
// tests/run.mjs sets TELETRAAN_RUNNER, and then only the first few problems of a rule are written.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const repo = fileURLToPath(new URL('../../', import.meta.url));
export const dashboard = path.join(repo, 'dashboard');

// How many problems of one rule are written out. tests/run.mjs shows only the last lines of a failing test,
// so a long list is cut. Run the test file by itself (node tests/house-rules.test.mjs) and every problem is written.
const shownInSummary = 5;

export const read = file => fs.readFileSync(file, 'utf8');
export const relative = file => path.relative(repo, file).split(path.sep).join('/');

// Every file under a folder that the test keeps, in a steady order. Fonts and node_modules are never looked at.
export function filesUnder(folder, keep) {
  const found = [];
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'fonts' && entry.name !== 'node_modules' && !entry.name.startsWith('.')) found.push(...filesUnder(full, keep));
    } else if (!keep || keep(full)) {
      found.push(full);
    }
  }
  return found.sort();
}

// The text with its comments cut out. The comments keep their line breaks, so a line number found in the
// result is the line number in the file. Comments say things like "no blur", so a rule must not read them.
export function withoutComments(file, text) {
  const blank = match => match.replace(/[^\n]/g, '');
  if (file.endsWith('.css')) return text.replace(/\/\*[\s\S]*?\*\//g, blank);
  if (file.endsWith('.html')) return text.replace(/<!--[\s\S]*?-->/g, blank).replace(/\/\*[\s\S]*?\*\//g, blank);
  return text.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|\s)\/\/.*$/gm, '$1');
}

export const lineOf = (text, index) => text.slice(0, index).split('\n').length;

// The files git tracks or would track (not ignored ones), as paths from the top folder. Empty when this is not a git folder.
export function trackedFiles() {
  const result = spawnSync('git', ['-C', repo, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) return [];
  return result.stdout.split('\0').filter(Boolean);
}

// file is the test's own path, such as tests/house-rules.test.mjs, which the summary names
export function makeChecker(file) {
  const results = [];

  // rule:    { name, why, instead }
  // run:     returns a list of problems (or a promise of one), each { file, line, what } (line may be left out)
  function check(rule, run) {
    const done = Promise.resolve().then(run).catch(error => [
      { file: '(the check itself)', what: 'stopped with: ' + error.message + '. Tell a mentor: this is a fault in the test and not in your change' },
    ]);
    results.push({ rule: rule, done: done });
  }

  async function finish() {
    const wholeList = !process.env.TELETRAAN_RUNNER;
    let failed = 0;

    for (const result of results) {
      const problems = await result.done;
      if (problems.length === 0) {
        console.log('ok    ' + result.rule.name);
        continue;
      }
      failed += 1;
      console.log('FAIL  ' + result.rule.name);
      const shown = wholeList ? problems : problems.slice(0, shownInSummary);
      for (const problem of shown) {
        console.log('      ' + problem.file + (problem.line ? ' line ' + problem.line : '') + ': ' + problem.what);
      }
      if (shown.length < problems.length) console.log('      and ' + (problems.length - shown.length) + ' more. Run node ' + file + ' by itself to see them all.');
      console.log('      Why: ' + result.rule.why);
      console.log('      Do instead: ' + result.rule.instead);
    }

    console.log('\n' + (results.length - failed) + ' of ' + results.length + ' ' + path.basename(file, '.test.mjs') + ' checks passed.');
    process.exitCode = failed > 0 ? 1 : 0;
  }

  return { check: check, finish: finish };
}
