// Plays each theme's panel and view transition with the CPU slowed down and prints the frame times and the animated element
// counts (docs/performance.md, "Transitions"). Playwright is a development dependency and is never on the Mini.
//
//   NODE_PATH=/path/to/node_modules node tools/perf/transitions.mjs --slow 4 --motion full
//   node tools/perf/transitions.mjs --slow 6 --motion light --only foundry --runs 2
//
// --slow is the CPU slowdown (1 is this computer), --motion is full or light, --runs is how many plays of each. A frame is the
// gap between two animation frames while a transition plays, so 34 ms is a frame that missed one refresh of a 60 Hz screen.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serveDashboard } from '../screenshots.mjs';
import { makeContext } from '../../tests/motion/lib/harness.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const argOf = (name, fallback) => (args.indexOf(name) >= 0 ? args[args.indexOf(name) + 1] : fallback);
const slow = Number(argOf('--slow', '4'));
const motion = argOf('--motion', 'full');
const only = argOf('--only', '');
const runs = Number(argOf('--runs', '2'));

const looks = { original: ['original', 'bar'], cybertron: ['cybertron', 'cybertronBar'], retro: ['retro', 'retroBar'], foundry: ['foundry', 'foundry-bar'] };

async function playOnce(page, client, what, options) {
  await page.evaluate(() => {
    window.__gaps = [];
    window.__seen = { animated: 0, elements: 0, biggest: 0 };
    let last = performance.now();
    const loop = now => {
      window.__gaps.push(now - last);
      last = now;
      const layer = document.getElementById('reform');
      if (layer && !layer.hidden) {
        window.__seen.animated = Math.max(window.__seen.animated, Number(layer.dataset.animated || 0));
        window.__seen.elements = Math.max(window.__seen.elements, Number(layer.dataset.elements || 0));
        window.__seen.layers = Math.max(window.__seen.layers || 0, layer.querySelectorAll('*').length);
      }
      if (!window.__stop) requestAnimationFrame(loop);
    };
    window.__stop = false;
    requestAnimationFrame(loop);
  });
  const before = (await client.send('Performance.getMetrics')).metrics;
  await page.evaluate(([name, extra]) => window.teletraanTest.play(name, extra), [what, options]);
  // the layer shows while it plays, and is hidden again after
  await page.waitForFunction(() => { const layer = document.getElementById('reform'); return layer && !layer.hidden; }, null, { timeout: 20000, polling: 20 }).catch(() => {});
  await page.waitForFunction(() => { const layer = document.getElementById('reform'); return !layer || layer.hidden; }, null, { timeout: 60000, polling: 100 });
  await page.evaluate(() => { window.__stop = true; });
  const after = (await client.send('Performance.getMetrics')).metrics;
  const delta = name => (after.find(item => item.name === name) || { value: 0 }).value - (before.find(item => item.name === name) || { value: 0 }).value;
  const result = await page.evaluate(() => ({ gaps: window.__gaps.slice(1), seen: window.__seen }));
  return { gaps: result.gaps, seen: result.seen, layouts: delta('LayoutCount'), styles: delta('RecalcStyleCount') };
}

async function main() {
  const playwright = await loadPlaywright();
  if (!playwright) {
    console.log('Playwright is not installed here.');
    return 0;
  }
  const server = await serveDashboard(path.join(root, 'dashboard'));
  const browser = await playwright.chromium.launch();
  const ctx = makeContext(browser, 'http://127.0.0.1:' + server.port);

  console.log('motion ' + motion + ', CPU ' + slow + 'x slower, ' + runs + ' plays of each');
  console.log('name'.padEnd(18) + 'frames  over34  over100  worst  animated  elements  layouts  restyles');

  try {
    for (const theme of Object.keys(looks)) {
      for (const kind of ['panel', 'view']) {
        const name = theme + '-' + kind;
        if (only && !name.includes(only)) continue;
        const page = await ctx.open({ motion: motion }, undefined, { look: looks[theme][kind === 'panel' ? 0 : 1], settleMs: 3500 });
        const client = await page.context().newCDPSession(page);
        await client.send('Performance.enable');
        if (slow > 1) await client.send('Emulation.setCPUThrottlingRate', { rate: slow });
        try {
          await page.waitForFunction(() => { const layer = document.getElementById('reform'); return !layer || layer.hidden; }, null, { timeout: 60000, polling: 250 });
          const total = { gaps: [], animated: 0, elements: 0, layouts: 0, styles: 0 };
          for (let run = 0; run < runs; run += 1) {
            await page.waitForTimeout(1500);
            const done = await playOnce(page, client, 'reform-' + kind, kind === 'view' ? { view: ['nova', 'general'][run % 2] } : {});
            total.gaps.push(...done.gaps);
            total.animated = Math.max(total.animated, done.seen.animated);
            total.elements = Math.max(total.elements, done.seen.layers || done.seen.elements);
            total.layouts += done.layouts;
            total.styles += done.styles;
          }
          const over = limit => total.gaps.filter(gap => gap > limit).length;
          const worst = Math.round(Math.max(...total.gaps));
          console.log(name.padEnd(18) + String(total.gaps.length).padStart(6) + String(over(34)).padStart(8) + String(over(100)).padStart(9) + String(worst).padStart(7) + String(total.animated).padStart(10) + String(total.elements).padStart(10) + String(Math.round(total.layouts / runs)).padStart(9) + String(Math.round(total.styles / runs)).padStart(10));
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
  return 0;
}

process.exit(await main());
