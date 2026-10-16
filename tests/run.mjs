// Runs every test of the repository and prints one line for each file and a total.
//
//   node tests/run.mjs            every tests/**/*.test.mjs, the syntax of every shell file, and the motion tests
//   node tests/run.mjs calendar   only the files whose path holds "calendar"
//   node tests/run.mjs motion     only the motion tests (tests/motion/README.md)
//
// A test is a Node file that exits 0 when it passes. Files in tests/helpers and tests/data are
// not tests. At most three run at the same time. The exit code is 1 when anything failed.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testsFolder = path.join(root, 'tests');
const filter = process.argv[2] || '';
const most = 3;
const timeLimit = 600 * 1000;
const motionTimeLimit = 3600 * 1000; // a real browser plays every transition

function walk(folder, found, skip) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      if (!skip.includes(entry.name)) walk(full, found, skip);
    } else {
      found.push(full);
    }
  }
  return found;
}

// How many checks a test says passed. The tests print one of a few closing lines.
function passCount(text) {
  const lines = text.split('\n').filter(line => line.trim());
  const last = lines[lines.length - 1] || '';
  const closing = last.match(/(\d+) of \d+ [a-z ]*passed/) || last.match(/^all (\d+) passed/);
  if (closing) return Number(closing[1]);
  return lines.filter(line => /^(ok|PASS)\b/.test(line)).length;
}

function runTest(file, limit = timeLimit) {
  return new Promise(resolve => {
    const started = Date.now();
    const child = spawn(process.execPath, [file], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    const timer = setTimeout(() => {
      output += '\nStopped after ' + limit / 1000 + ' seconds.\n';
      child.kill('SIGKILL');
    }, limit);
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ name: path.relative(testsFolder, file), code: code, output: output, seconds: (Date.now() - started) / 1000 });
    });
  });
}

function runShell(command, args) {
  return new Promise(resolve => {
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('close', code => resolve({ code: code, output: output }));
  });
}

// Every shell file under computer/ and tools/, found by name or by the first line
function shellFiles() {
  const found = [];
  for (const top of ['computer', 'tools']) {
    const folder = path.join(root, top);
    if (!fs.existsSync(folder)) continue;
    for (const file of walk(folder, [], ['node_modules'])) {
      const name = path.basename(file);
      let shell = /\.(sh|command)$/.test(name);
      if (!shell && !path.extname(name)) shell = /^#!.*\b(ba)?sh\b/.test(fs.readFileSync(file, 'utf8').split('\n')[0]);
      if (shell) found.push(file);
    }
  }
  return found.sort();
}

async function checkShell() {
  const started = Date.now();
  const files = shellFiles();
  const problems = [];
  for (const file of files) {
    for (const shell of ['sh', 'bash']) {
      const result = await runShell(shell, ['-n', file]);
      if (result.code !== 0) problems.push(shell + ' -n ' + path.relative(root, file) + '\n' + result.output.trim());
    }
  }
  return { name: 'shell syntax (sh -n and bash -n)', count: files.length, problems: problems, seconds: (Date.now() - started) / 1000 };
}

// True when Playwright can be loaded here, in tools/node_modules or in a folder that NODE_PATH names. The Teletraan computer and a
// computer that never installed it skip the motion tests and stay green.
function playwrightIsHere() {
  try {
    createRequire(path.join(root, 'tools', 'x.js'))('playwright');
    return true;
  } catch (error) {
    return false;
  }
}

// The motion tests are one file that prints a line for each rule. A failure prints every line of it.
async function runMotion(wide) {
  if (!playwrightIsHere()) {
    console.log('skip  ' + 'motion tests'.padEnd(wide) + '  Playwright is not installed here (tests/motion/README.md)');
    return { failed: 0, checks: 0 };
  }

  const result = await runTest(path.join(testsFolder, 'motion', 'run.mjs'), motionTimeLimit);
  const lines = result.output.trim().split('\n');
  const rules = lines.filter(line => /^(ok|FAIL)\b/.test(line)).length;
  if (result.code === 0) {
    console.log('ok    ' + 'motion/run.mjs'.padEnd(wide) + '  ' + String(rules).padStart(5) + ' passed  ' + result.seconds.toFixed(1) + 's');
    return { failed: 0, checks: lines.filter(line => /^ok\b/.test(line)).length };
  }

  console.log('FAIL  ' + 'motion/run.mjs'.padEnd(wide) + '  exit ' + result.code + '  ' + result.seconds.toFixed(1) + 's');
  lines.filter(line => !/^ok\b/.test(line)).slice(0, 60).forEach(line => console.log('      ' + line));
  return { failed: 1, checks: lines.filter(line => /^ok\b/.test(line)).length };
}

async function main() {
  const motionOnly = filter === 'motion';
  const files = motionOnly ? [] : walk(testsFolder, [], ['helpers', 'data'])
    .filter(file => file.endsWith('.test.mjs') && path.relative(testsFolder, file).includes(filter))
    .sort();
  const wide = Math.max(...files.map(file => path.relative(testsFolder, file).length), 30);
  const queue = files.slice();
  const results = [];
  let failed = 0;
  let checks = 0;

  function report(result) {
    const name = result.name.padEnd(wide);
    if (result.code === 0) {
      const passed = passCount(result.output);
      checks += passed;
      console.log('ok    ' + name + '  ' + String(passed).padStart(5) + ' passed  ' + result.seconds.toFixed(1) + 's');
    } else {
      failed++;
      console.log('FAIL  ' + name + '  exit ' + result.code + '  ' + result.seconds.toFixed(1) + 's');
      const last = result.output.trim().split('\n').slice(-12);
      last.forEach(line => console.log('      ' + line));
    }
  }

  async function worker() {
    while (queue.length > 0) {
      const result = await runTest(queue.shift());
      results.push(result);
      report(result);
    }
  }

  const started = Date.now();
  await Promise.all(Array.from({ length: Math.min(most, files.length) }, worker));

  if (filter === '') {
    const shell = await checkShell();
    if (shell.problems.length === 0) {
      console.log('ok    ' + shell.name.padEnd(wide) + '  ' + String(shell.count).padStart(5) + ' files   ' + shell.seconds.toFixed(1) + 's');
    } else {
      failed++;
      console.log('FAIL  ' + shell.name);
      shell.problems.forEach(problem => console.log('      ' + problem.split('\n').join('\n      ')));
    }
  }

  if (filter === '' || motionOnly) {
    const motion = await runMotion(wide);
    failed += motion.failed;
    checks += motion.checks;
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log('');
  console.log(results.length + ' files, ' + checks + ' checks passed, ' + failed + ' failed, ' + seconds + 's');
  process.exit(failed > 0 ? 1 : 0);
}

main();
