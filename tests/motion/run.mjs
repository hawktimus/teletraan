// The motion tests (tests/motion/README.md). They open the dashboard in a real browser, play each transition
// through the test hook and check rules, not pictures.
//
//   node tests/motion/run.mjs            every rule
//   node tests/motion/run.mjs swap       only the rules whose name has "swap" in it
//
// Playwright is a development dependency of tools/ and is not on the Mini. Without it this file says so and
// exits 0. tests/run.mjs runs it as its last step.

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPlaywright, serveDashboard } from '../../tools/screenshots.mjs';
import { makeContext, repoRoot, writeFrames } from './lib/harness.mjs';

const modules = ['swap.mjs', 'hidden.mjs', 'monday.mjs'];
const filter = process.argv[2] || '';
const show = 6; // lines of one failure that are printed. All of them are in the frames folder.

async function main() {
  const playwright = await loadPlaywright();
  if (!playwright) {
    console.log('Motion tests skipped: Playwright is not installed here (tests/motion/README.md says how to run them on a laptop).');
    return 0;
  }

  const tests = [];
  for (const file of modules) {
    const loaded = await import(pathToFileURL(path.join(repoRoot, 'tests', 'motion', file)).href);
    loaded.tests.forEach(test => tests.push(test));
  }
  const chosen = tests.filter(test => test.name.includes(filter));
  if (chosen.length === 0) {
    console.log('No motion rule has "' + filter + '" in its name.');
    return 2;
  }

  const server = await serveDashboard(path.join(repoRoot, 'dashboard'));
  const browser = await playwright.chromium.launch();
  const ctx = makeContext(browser, 'http://127.0.0.1:' + server.port);
  const wide = Math.max(...chosen.map(test => test.name.length));
  let failed = 0;
  const started = Date.now();

  try {
    for (const test of chosen) {
      const at = Date.now();
      let lines;
      try {
        lines = await test.run(ctx);
      } catch (error) {
        lines = ['the test itself failed: ' + (error && error.message ? error.message.split('\n')[0] : error)];
      }
      const seconds = ((Date.now() - at) / 1000).toFixed(1) + 's';
      if (lines.length === 0) {
        console.log('ok    ' + test.name.padEnd(wide) + '  ' + seconds);
        continue;
      }

      failed++;
      const folder = await writeFrames(ctx, test.name, lines);
      console.log('FAIL  ' + test.name.padEnd(wide) + '  ' + lines.length + ' found  ' + seconds);
      lines.slice(0, show).forEach(line => console.log('      ' + line));
      if (lines.length > show) console.log('      and ' + (lines.length - show) + ' more');
      console.log('      frames: ' + path.relative(repoRoot, folder));
    }
  } finally {
    await browser.close();
    await server.close();
  }

  console.log('');
  console.log(chosen.length + ' motion rules, ' + (chosen.length - failed) + ' passed, ' + failed + ' failed, ' + ((Date.now() - started) / 1000).toFixed(1) + 's');
  return failed > 0 ? 1 : 0;
}

process.exit(await main());
