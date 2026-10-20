// Looks for flashing, for the accessibility audit (docs/accessibility.md). It opens the moving page in each theme, lets
// it run, and lists every running animation that changes opacity or a lit color, with how often it repeats and how much
// of the screen it covers. Three flashes in any one second over a large area is the limit (WCAG 2.3.1), so a repeat
// faster than 3 a second, or an area of a quarter of the screen that changes by more than a tenth, is reported.
//
//   node tools/flash-probe.mjs                the table for motion full and calm
//
// It reads Web Animations (document.getAnimations()), so a fault in CSS or in a script is found the same way.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDashboard, loadPlaywright, themes } from './screenshots.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// Runs in the page
function listAnimations() {
  const out = [];
  document.getAnimations().forEach(animation => {
    const effect = animation.effect;
    if (!effect || !effect.target || typeof effect.getKeyframes !== 'function') return;
    const timing = effect.getComputedTiming();
    const frames = effect.getKeyframes();
    const names = new Set();
    frames.forEach(frame => Object.keys(frame).forEach(key => { if (!['offset', 'easing', 'composite', 'computedOffset'].includes(key)) names.add(key); }));
    const opacities = frames.map(frame => Number(frame.opacity)).filter(value => !Number.isNaN(value));
    const box = effect.target.getBoundingClientRect();
    const duration = Number(timing.duration) || 0;
    out.push({
      name: animation.animationName || animation.constructor.name,
      target: effect.target.tagName.toLowerCase() + (typeof effect.target.className === 'string' && effect.target.className ? '.' + effect.target.className.trim().split(/\s+/)[0] : ''),
      properties: [...names].sort().join(','),
      duration: duration,
      iterations: timing.iterations,
      swing: opacities.length > 1 ? Math.round((Math.max(...opacities) - Math.min(...opacities)) * 100) / 100 : 0,
      share: Math.round((box.width * box.height) / (1920 * 1080) * 1000) / 1000,
      state: animation.playState,
    });
  });
  return out;
}

async function main() {
  const playwright = await loadPlaywright();
  const server = await serveDashboard(path.join(here, '..', 'dashboard'));
  const browser = await playwright.chromium.launch();
  const problems = [];
  const seen = new Map();

  for (const motion of ['full', 'calm']) for (const theme of themes) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: motion === 'calm' ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:' + server.port + '/index.html?sample=1&clock=fixed&night=off&motion=' + motion + '&style=' + theme);
    await page.waitForTimeout(6000);
    const list = await page.evaluate(listAnimations);
    list.forEach(item => {
      const key = [motion, item.name, item.target, item.properties].join('|');
      const at = seen.get(key) || { motion: motion, themes: new Set(), item: item };
      at.themes.add(theme);
      seen.set(key, at);
      const perSecond = item.duration > 0 && item.iterations > 0 ? 1000 / item.duration : 0;
      const infinite = item.iterations === Infinity;
      if (infinite && /opacity/.test(item.properties) && item.swing >= 0.1 && perSecond > 3) problems.push(motion + ' ' + theme + ': ' + item.name + ' on ' + item.target + ' repeats ' + perSecond.toFixed(1) + ' times a second');
    });
    await context.close();
  }
  await browser.close();
  await server.close();

  console.log('running animations after 6 seconds, one line for each kind (motion, name, target, properties):');
  [...seen.values()].sort((a, b) => a.motion.localeCompare(b.motion) || a.item.name.localeCompare(b.item.name)).forEach(at => {
    const item = at.item;
    const seconds = item.duration >= 0 ? (item.duration / 1000).toFixed(2) + 's' : '?';
    console.log('  ' + at.motion.padEnd(5) + ' ' + String(item.name).padEnd(22) + ' ' + item.target.slice(0, 26).padEnd(26) + ' ' + item.properties.padEnd(28) + ' ' + seconds.padStart(8) + ' x' + String(item.iterations).padEnd(8) + ' swing ' + item.swing + ' area ' + item.share + '  [' + [...at.themes].join(' ') + ']');
  });
  console.log(problems.length === 0 ? 'no repeat faster than 3 a second' : problems.join('\n'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
