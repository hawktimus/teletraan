// Draws a contact sheet of a reform transition (docs/transitions.md): the run is held, set to eight times and
// photographed, and the pictures are joined into one PNG.
//
//   node tools/anim-strip.mjs                     every theme, panel and view, into _outputs/anim/<label>/
//   node tools/anim-strip.mjs --label after       the folder name (default: now)
//   node tools/anim-strip.mjs --only original     only the sheets whose name has this text
//   node tools/anim-strip.mjs --times 100,200,...  eight times in milliseconds of the skeleton, in place of the usual ones
//   node tools/anim-strip.mjs --motion light      the Light transitions: played at a tenth of the speed and photographed on a timer
//
// Needs Playwright (tools/package.json). Never runs on the Teletraan computer.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serveDashboard } from './screenshots.mjs';
import { makeContext } from '../tests/motion/lib/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..');
const timesOf = { panel: [0, 600, 1150, 1300, 1450, 1650, 1900, 2400], view: [0, 350, 700, 1050, 1400, 1800, 2300, 2950] };
const looks = { original: ['original', 'bar'], cybertron: ['cybertron', 'cybertronBar'], retro: ['retro', 'retroBar'], foundry: ['foundry', 'foundry-bar'] };

const args = process.argv.slice(2);
const argOf = name => (args.indexOf(name) >= 0 ? args[args.indexOf(name) + 1] : '');
const label = argOf('--label') || new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const only = argOf('--only');
const light = argOf('--motion') === 'light';
const ownTimes = argOf('--times') ? argOf('--times').split(',').map(Number) : null;

async function sheet(ctx, name, look, play, options, times) {
  const page = await ctx.open({}, undefined, { look: look, settleMs: 3500 });
  try {
    await page.waitForFunction(() => { const layer = document.getElementById('reform'); return !layer || layer.hidden; }, null, { timeout: 60000, polling: 250 });
    await page.waitForTimeout(2500);
    await page.evaluate(([what, extra]) => {
      window.__reformHold = true;
      window.__motion.collecting = true;
      window.__motion.created = [];
      window.teletraanTest.play(what, extra);
    }, [play, options]);
    await page.waitForFunction(() => { const layer = document.getElementById('reform'); return layer && layer.dataset.ready === '1'; }, null, { timeout: 40000, polling: 100 });
    // a view draws its parts after the layer says it is ready, so the list is taken when it has stopped growing
    for (let last = -1, same = 0; same < 3;) {
      await page.waitForTimeout(400);
      const count = await page.evaluate(() => document.getAnimations().filter(animation => animation.id === 'reform').length);
      same = count > 0 && count === last ? same + 1 : 0;
      last = count;
    }
    await page.evaluate(() => {
      // a view is built after a page change, which the collecting wrapper of the probe misses, so the page is asked for its animations
      window.__reformHeld = document.getAnimations().filter(animation => animation.id === 'reform');
      window.__reformHeld.forEach(animation => animation.pause());
    });
    // a panel is photographed close up: the rectangle of its region
    const clip = play === 'reform-panel' ? await page.evaluate(() => JSON.parse(document.getElementById('reform').dataset.regions)[0].from) : null;
    const pictures = [];
    for (const ms of times) {
      await page.evaluate(time => window.__reformHeld.forEach(animation => { animation.currentTime = time; }), ms);
      await page.waitForTimeout(250);
      pictures.push((await page.screenshot(clip ? { clip: { x: clip.x, y: clip.y, width: clip.w, height: clip.h } } : {})).toString('base64'));
    }
    await page.evaluate(() => { window.__reformHold = false; });
    return pictures;
  } finally {
    await page.close();
  }
}

// The Light transitions have no held clock: they are played slowly (a tenth of the speed) and photographed every 450 ms
async function lightSheet(ctx, look, play, options) {
  const page = await ctx.open({ motion: 'light' }, undefined, { look: look, settleMs: 3500 });
  try {
    await page.waitForFunction(() => { const layer = document.getElementById('reform'); return !layer || layer.hidden; }, null, { timeout: 60000, polling: 250 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (...args) {
        const animation = animate.apply(this, args);
        animation.updatePlaybackRate(0.1);
        return animation;
      };
    });
    await page.evaluate(([what, extra]) => window.teletraanTest.play(what, extra), [play, options]);
    await page.waitForFunction(() => { const layer = document.getElementById('reform'); return layer && layer.dataset.ready === '1'; }, null, { timeout: 40000, polling: 50 });
    const pictures = [];
    for (let index = 0; index < 8; index += 1) {
      pictures.push((await page.screenshot()).toString('base64'));
      await page.waitForTimeout(450);
    }
    return pictures;
  } finally {
    await page.close();
  }
}

async function join(browser, pictures, times) {
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  try {
    const png = await page.evaluate(async ([list, ms]) => {
      const cell = { w: 640, h: 360 };
      const probe = new Image();
      await new Promise(resolve => { probe.onload = resolve; probe.src = 'data:image/png;base64,' + list[0]; });
      cell.h = Math.round(cell.w * probe.height / probe.width);
      const canvas = document.createElement('canvas');
      canvas.width = cell.w * 4;
      canvas.height = cell.h * 2;
      const context = canvas.getContext('2d');
      for (let index = 0; index < list.length; index += 1) {
        const image = new Image();
        await new Promise(resolve => { image.onload = resolve; image.src = 'data:image/png;base64,' + list[index]; });
        const x = (index % 4) * cell.w;
        const y = Math.floor(index / 4) * cell.h;
        context.drawImage(image, x, y, cell.w, cell.h);
        context.fillStyle = '#000';
        context.fillRect(x, y, 90, 26);
        context.fillStyle = '#fff';
        context.font = '20px monospace';
        context.fillText(ms[index] + ' ms', x + 6, y + 20);
      }
      return canvas.toDataURL('image/png').split(',')[1];
    }, [pictures, times]);
    return Buffer.from(png, 'base64');
  } finally {
    await page.close();
  }
}

async function main() {
  const playwright = await loadPlaywright();
  if (!playwright) {
    console.log('Playwright is not installed here.');
    return 0;
  }
  const server = await serveDashboard(path.join(repoRoot, 'dashboard'));
  const browser = await playwright.chromium.launch();
  const ctx = makeContext(browser, 'http://127.0.0.1:' + server.port);
  const folder = path.join(repoRoot, '_outputs', 'anim', label);
  fs.mkdirSync(folder, { recursive: true });

  try {
    for (const theme of Object.keys(looks)) {
      for (const kind of ['panel', 'view']) {
        const name = theme + '-' + kind;
        if (only && !name.includes(only)) continue;
        const look = looks[theme][kind === 'panel' ? 0 : 1];
        const options = kind === 'view' ? { view: 'nova' } : {};
        const pictures = light ? await lightSheet(ctx, look, 'reform-' + kind, options) : await sheet(ctx, name, look, 'reform-' + kind, options, ownTimes || timesOf[kind]);
        const labels = light ? [0, 450, 900, 1350, 1800, 2250, 2700, 3150] : ownTimes || timesOf[kind];
        fs.writeFileSync(path.join(folder, name + '.png'), await join(browser, pictures, labels));
        console.log('wrote ' + path.relative(repoRoot, path.join(folder, name + '.png')));
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
  return 0;
}

process.exit(await main());
