// Animation uses only transform and opacity, and line drawing (the rules of the screen). Two views of it: the keyframes written
// in the stylesheets, and the animations that really run on the screen, with the computed style of what they move.

import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from './lib/harness.mjs';

const looks = ['original', 'cybertron', 'retro'];

// transform and its three single forms, opacity, and the two properties that draw a line
const allowed = ['transform', 'translate', 'scale', 'rotate', 'opacity', 'stroke-dashoffset', 'stroke-dasharray', 'strokeDashoffset', 'strokeDasharray'];

function cssFiles(folder, found = []) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    if (entry.name === 'fonts' || entry.name === 'node_modules') continue;
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) cssFiles(full, found);
    else if (entry.name.endsWith('.css')) found.push(full);
  }
  return found;
}

// The properties each @keyframes block of the stylesheets writes
function keyframeProperties() {
  const found = [];

  cssFiles(path.join(repoRoot, 'dashboard')).forEach(file => {
    const text = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const start = /@keyframes\s+([\w-]+)\s*\{/g;
    let match;

    while ((match = start.exec(text)) !== null) {
      let depth = 1;
      let index = start.lastIndex;
      while (depth > 0 && index < text.length) {
        if (text[index] === '{') depth++;
        if (text[index] === '}') depth--;
        index++;
      }
      const body = text.slice(start.lastIndex, index - 1).replace(/[^{};]*\{/g, '{');
      const line = text.slice(0, match.index).split('\n').length;
      const names = Array.from(body.matchAll(/([\w-]+)\s*:/g)).map(item => item[1]).filter(name => name !== 'animation-timing-function');
      found.push({ file: path.relative(repoRoot, file), line: line, name: match[1], properties: Array.from(new Set(names)) });
    }
  });
  return found;
}

// One look from the start: the effects due every second, the red eyes over the standard layout, then two changes of
// view, the first into the bar layout and the second into its mirror, with the effects playing in between
async function runLook(ctx, look) {
  const page = await ctx.open({ reform: 'off' }, undefined, { settleMs: 500, look: look }); // the swaps of the view are the older ones here (reform.mjs has the others)
  const swapped = () => page.waitForFunction(() => document.getElementById('world').hasAttribute('data-pieces'), null, { timeout: 60000 })
    .then(() => page.waitForFunction(() => !document.getElementById('world').hasAttribute('data-pieces'), null, { timeout: 20000 }));

  try {
    await page.evaluate(() => {
      window.__motion.collect();
      window.teletraanTest.play('name-glitch');
      window.teletraanTest.play('hawk-flap');
    });
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.teletraanTest.play('red-eyes'));
    await page.waitForFunction(() => document.getElementById('world').dataset.hidden === 'build', null, { timeout: 90000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.teletraanTest.play('view-swap'));
    await swapped();
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.teletraanTest.play('view-swap'));
    await swapped();
    await page.waitForTimeout(1500);
    return await page.evaluate(() => window.__motion.seen);
  } catch (error) {
    return { error: 'the run of ' + look + ' did not get through the red eyes and two changes of view: ' + String(error.message).split('\n')[0] };
  } finally {
    await page.close();
  }
}

export const tests = [
  {
    name: 'animated/keyframes-use-only-transform-and-opacity',
    async run() {
      const failures = [];
      keyframeProperties().forEach(block => {
        block.properties.filter(name => !allowed.includes(name)).forEach(name => failures.push(block.file + ':' + block.line + ' @keyframes ' + block.name + ' animates ' + name));
      });
      return failures;
    },
  },
].concat(looks.flatMap(look => [
  {
    name: 'animated/' + look + '/only-transform-and-opacity',
    async run(ctx) {
      const seen = await ctx.scenario('animated ' + look, () => runLook(ctx, look));
      if (seen.error) return [seen.error];
      const found = Object.values(seen.animations);
      if (found.length < 10) return ['screen at 0 ms: only ' + found.length + ' animations were seen, the run did not move the screen'];
      return found.flatMap(item => item.properties.filter(name => !allowed.includes(name)).map(name => item.name + ' at ' + item.at + ' ms: the ' + item.kind + ' animates ' + name));
    },
  },
  {
    name: 'animated/' + look + '/no-filter-shadow-or-size-change',
    async run(ctx) {
      const seen = await ctx.scenario('animated ' + look, () => runLook(ctx, look));
      if (seen.error) return [seen.error];
      return seen.changes.map(change => change.name + ' at ' + change.at + ' ms: the ' + change.kind + ' moves an element whose ' + change.what);
    },
  },
]));
