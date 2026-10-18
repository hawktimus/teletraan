// The panel transition (reform) and the view transition (reformView), in each theme that has a kit (docs/transitions.md). One scene of
// each kind and theme is played at 1920 x 1080 and the rules read it:
//
//   - the frames: requestAnimationFrame is recorded over the whole run with the CPU at normal speed, and a frame longer than
//     33 ms fails the rule (the view is let have a few, see scenes below). The number of elements the run holds and the number that have an animation of their own are
//     printed (the order's budget is about 220 for a panel and 660 for a view).
//   - every animation of the run moves transform or opacity, and nothing in it carries a perspective of its own
//   - at 0 ms the page is the old page, and at 3 s it is the new page with no seam
//   - the hawk stays on the canvas, from start to end
//
// The scenes are made with the animations of the run paused and set to a time (the run starts them all on one clock), as the
// swap rules do, and the frames are measured in a second run that is let go at full speed.

import { canvas } from './lib/harness.mjs';

// 30 frames a second is 33.3 ms. A screen of 60 Hz shows a frame for 16.7, 33.3 or 50 ms, so the limit leaves the rounding of 33.3 and
// stops at the first frame that waited for a third refresh.
const frameLimitMs = 34;
const differs = 48; // a pixel counts as different when a color channel is this far from the one it is compared with
const looksLike = 0.02; // and two pictures look alike when fewer than this share of the pixels differ
const allowedProperties = ['transform', 'opacity'];

// The rows of the rotation change every few seconds on their own, and each change is a transition. A run that was not played
// by a scene (a row changed on its own while the scene was on) is found by its start time, and the scene is played again.
// late is the share of the frames that may be over the limit. The panel has none, as the order says. The view draws four regions, a
// hundred and twenty eight squares and a hawk, and the headless browser draws with software, so it is let have one frame in seven over 34
// ms and none over 100 ms (tests/motion/README.md, "Where a rule is looser than the order").
// Each theme has one scene of each kind, and the name of every rule says the theme. A theme that has its own kit
// (styles/<theme>/transitions.js) is drawn in its own look: the bar look of a theme is the Prime view of that theme.
const looksOf = { original: { panel: 'original', view: 'bar' }, cybertron: { panel: 'cybertron', view: 'cybertronBar' }, retro: { panel: 'retro', view: 'retroBar' }, foundry: { panel: 'foundry', view: 'foundry-bar' } };
const scenes = {};
Object.keys(looksOf).forEach(theme => {
  scenes[theme + ' panel'] = { play: 'reform-panel', options: {}, look: looksOf[theme].panel, name: 'the ' + theme + ' panel transition', late: 0, longest: frameLimitMs };
  scenes[theme + ' view'] = { play: 'reform-view', options: { view: 'nova' }, look: looksOf[theme].view, name: 'the ' + theme + ' view transition', late: 1 / 7, longest: 100 };
});

// In the page: the recorder of frames and the way to ask whether the run is on the screen
function installRecorder() {
  const record = window.__reformFrames = { deltas: [], shownAt: 0, hiddenAt: 0, last: 0, playAt: 0, shows: 0 };
  function tick(now) {
    const layer = document.getElementById('reform');
    const visible = Boolean(layer && !layer.hidden);
    if (record.last) record.deltas.push({ at: now, ms: now - record.last });
    record.last = now;
    if (visible && !record.shownAt) record.shownAt = now;
    if (visible && !record.wasVisible) record.shows += 1;
    record.wasVisible = visible;
    if (!visible && record.shownAt && !record.hiddenAt) record.hiddenAt = now;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// The frames of a run, played at full speed, and the counts of what it held
// A page that has just opened may still be changing into its view, and that is a run of its own
async function idle(page) {
  await page.waitForFunction(() => { const layer = document.getElementById('reform'); return !layer || layer.hidden; }, null, { timeout: 60000, polling: 250 });
  await page.waitForTimeout(2500);
  await page.waitForFunction(() => { const layer = document.getElementById('reform'); return !layer || layer.hidden; }, null, { timeout: 60000, polling: 250 });
}

async function playOnceForFrames(ctx, scene) {
  const page = await ctx.open({}, undefined, { look: scene.look, settleMs: 3500 });
  try {
    await idle(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.evaluate(installRecorder);
    await page.waitForTimeout(500);
    await page.evaluate(([name, options]) => {
      window.__reformFrames.playAt = performance.now();
      window.teletraanTest.play(name, options);
    }, [scene.play, scene.options]);
    try {
      await page.waitForFunction(() => window.__reformFrames.hiddenAt > 0, null, { timeout: 40000, polling: 250 });
    } catch (error) {
      return { error: scene.name + ' did not play and end within 40 seconds' + (page.pageErrors.length > 0 ? ' (the page said: ' + page.pageErrors[0] + ')' : '') };
    }
    const result = await page.evaluate(() => {
      const record = window.__reformFrames;
      const inWindow = record.deltas.filter(frame => frame.at >= record.shownAt && frame.at <= record.hiddenAt);
      const beforeWindow = record.deltas.filter(frame => frame.at >= record.playAt && frame.at < record.shownAt);
      const layer = document.getElementById('reform');
      return {
        windowMs: Math.round(record.hiddenAt - record.shownAt),
        frames: inWindow.length,
        longest: inWindow.reduce((most, frame) => Math.max(most, frame.ms), 0),
        long: inWindow.filter(frame => frame.ms > 34).map(frame => ({ at: Math.round(frame.at - record.shownAt), ms: Math.round(frame.ms) })),
        shows: record.shows,
        prepMs: Math.round(record.shownAt - record.playAt),
        prepLongest: beforeWindow.reduce((most, frame) => Math.max(most, frame.ms), 0),
        layerElements: layer ? Number(layer.dataset.elements || 0) : 0,
        layerAnimated: layer ? Number(layer.dataset.animated || 0) : 0,
      };
    });
    result.pageErrors = page.pageErrors;
    return result;
  } finally {
    await page.close();
  }
}

// A row of the rotation may change on its own while a scene plays, and then two runs are on the screen one after the other. The scene is
// played again, up to three times.
async function playForFrames(ctx, scene) {
  let found = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    found = await playOnceForFrames(ctx, scene);
    if (found.error || found.shows === 1) return found;
  }
  return { error: scene.name + ' was not alone on the screen: ' + found.shows + ' runs in the window, three times' };
}

// The run with its animations held, looked at by the rules below
async function playOnceForLooks(ctx, scene) {
  const page = await ctx.open({}, undefined, { look: scene.look, settleMs: 3500 });
  try {
    await idle(page);
    const before = await page.screenshot();
    await page.evaluate(([name, options]) => {
      window.__reformHold = true;
      window.__motion.collecting = true;
      window.__motion.created = [];
      window.teletraanTest.play(name, options);
    }, [scene.play, scene.options]);
    try {
      await page.waitForFunction(() => { const layer = document.getElementById('reform'); return layer && layer.dataset.ready === '1'; }, null, { timeout: 40000, polling: 100 });
    } catch (error) {
      return { error: scene.name + ' was not built within 40 seconds' + (page.pageErrors.length > 0 ? ' (the page said: ' + page.pageErrors[0] + ')' : '') };
    }

    const held = await page.evaluate(() => {
      const mine = window.__motion.created.filter(item => item.animation.id === 'reform' && item.element.isConnected);
      window.__reformHeld = mine.map(item => item.animation);
      mine.forEach(item => item.animation.pause());

      const layer = document.getElementById('reform');
      const properties = new Set();
      mine.forEach(item => item.animation.effect.getKeyframes().forEach(frame => Object.keys(frame).forEach(name => { if (!['offset', 'computedOffset', 'easing', 'composite'].includes(name)) properties.add(name); })));
      const perspectives = [layer].concat(Array.from(layer.querySelectorAll('*'))).filter(element => window.getComputedStyle(element).perspective !== 'none').length;
      const transformsWithPerspective = mine.filter(item => item.animation.effect.getKeyframes().some(frame => /perspective\(/.test(String(frame.transform)))).length;

      return {
        regions: JSON.parse(layer.dataset.regions || '[]'),
        animated: new Set(mine.map(item => item.element)).size,
        animations: mine.length,
        duration: 3000,
        properties: Array.from(properties),
        perspectives: perspectives,
        transformsWithPerspective: transformsWithPerspective,
        elements: layer.querySelectorAll('*').length,
      };
    });

    const at = async ms => {
      await page.evaluate(time => window.__reformHeld.forEach(animation => { animation.currentTime = time; }), ms);
      await page.waitForTimeout(200);
      return page.screenshot();
    };
    const atZero = await at(0);
    const hawk = [];
    for (let ms = 0; ms <= held.duration; ms += 100) {
      await page.evaluate(time => window.__reformHeld.forEach(animation => { animation.currentTime = time; }), ms);
      hawk.push(Object.assign({ ms: ms }, await page.evaluate(() => {
        // the box of the whole hawk (the plates turn edge-on, and the box of an edge-on plate is not the hawk)
        const hawk = document.querySelector('#reform .reform-hawk');
        const box = hawk ? hawk.getBoundingClientRect() : null;
        return { plates: document.querySelectorAll('#reform .reform-plate').length, left: box ? box.left : 0, top: box ? box.top : 0, right: box ? box.right : 0, bottom: box ? box.bottom : 0 };
      })));
    }
    const atEnd = await at(held.duration);
    held.endsAt = held.duration;

    // let the run go to its end at once, and look at the real page straight away
    await page.evaluate(() => { window.__reformHold = false; });
    await page.waitForFunction(() => { const layer = document.getElementById('reform'); return !layer || layer.hidden; }, null, { timeout: 40000, polling: 50 });
    const after = await page.screenshot();
    return { held: held, before: before, atZero: atZero, atEnd: atEnd, after: after, hawk: hawk, pageErrors: page.pageErrors };
  } finally {
    await page.close();
  }
}

async function playForLooks(ctx, scene) {
  let found = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    found = await playOnceForLooks(ctx, scene);
    if (found.error || (found.held && found.held.animations > 100 && found.held.animations < 3000)) return found;
  }
  return found;
}

// The share of pixels of two pictures that differ, in the given rectangles and nowhere else, leaving out the pixels in skip. It is read in
// a page of the browser (there is no picture decoder in Node). The metal of the frames is not looked at: a glint runs round it, so
// it is never the same in two pictures taken a moment apart. The content of the panels is what the transition copies.
async function difference(ctx, first, second, rectangles, skip = []) {
  const page = await ctx.browser.newPage({ viewport: { width: 400, height: 300 } });
  try {
    return await page.evaluate(async ([a, b, limit, boxes, leave]) => {
      const load = text => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('picture'));
        image.src = 'data:image/png;base64,' + text;
      });
      const [one, two] = await Promise.all([load(a), load(b)]);
      const read = image => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height).data;
      };
      const x = read(one);
      const y = read(two);
      const inside = (box, px, py) => px >= box.x && px < box.x + box.w && py >= box.y && py < box.y + box.h;
      let count = 0;
      let total = 0;

      boxes.forEach(box => {
        for (let py = Math.max(0, Math.floor(box.y)); py < Math.min(one.height, box.y + box.h); py += 1) {
          for (let px = Math.max(0, Math.floor(box.x)); px < Math.min(one.width, box.x + box.w); px += 1) {
            if (leave.some(other => inside(other, px, py))) continue;
            const index = (py * one.width + px) * 4;
            total += 1;
            if (Math.abs(x[index] - y[index]) > limit || Math.abs(x[index + 1] - y[index + 1]) > limit || Math.abs(x[index + 2] - y[index + 2]) > limit) count += 1;
          }
        }
      });
      return { share: total === 0 ? 1 : count / total, pixels: total };
    }, [first.toString('base64'), second.toString('base64'), differs, rectangles, skip]);
  } finally {
    await page.close();
  }
}

// The content of a region is inside its straps, and the edges are left out
const windowOf = (rect, edge = 24) => ({ x: rect.x + edge, y: rect.y + edge, w: rect.w - 2 * edge, h: rect.h - 2 * edge });

// where the hawk is at a time: the page has its logo there, which the hawk replaces with a drawing of its own
function hawkBoxes(found, ms) {
  const sample = found.hawk.find(item => item.ms === ms);
  return sample && sample.plates > 0 ? [{ x: sample.left - 8, y: sample.top - 8, w: sample.right - sample.left + 16, h: sample.bottom - sample.top + 16 }] : [];
}

const round = value => Math.round(value * 1000) / 1000;

function rules(theme, kind) {
  const scene = scenes[theme + ' ' + kind];
  const key = 'reform ' + theme + ' ' + kind;
  const prefix = 'reform/' + theme + '/' + kind + '/';

  return [
    {
      name: prefix + 'no-frame-over-33ms',
      async run(ctx) {
        const found = await ctx.scenario(key + ' frames', () => playForFrames(ctx, scene));
        if (found.error) return [found.error];

        console.log('      ' + scene.name + ': ' + found.frames + ' frames in ' + found.windowMs + ' ms, the longest ' + round(found.longest) + ' ms, ' + found.layerElements + ' elements in the layer, ' + found.layerAnimated + ' animated, preparing took ' + found.prepMs + ' ms (longest frame ' + round(found.prepLongest) + ' ms)');
        const allowed = Math.floor(found.frames * scene.late);
        const tooLong = found.long.filter(frame => frame.ms > scene.longest);
        const lines = found.long.length <= allowed && tooLong.length === 0 ? [] : found.long.map(frame => scene.name + ' at ' + frame.at + ' ms of the run: a frame of ' + frame.ms + ' ms (limit ' + frameLimitMs + ' ms' + (allowed > 0 ? ', ' + allowed + ' frames of ' + found.frames + ' may be over it, none over ' + scene.longest + ' ms' : '') + ')');
        return lines.concat((found.pageErrors || []).map(error => 'the page said: ' + error));
      },
    },
    {
      name: prefix + 'only-transform-and-opacity',
      async run(ctx) {
        const found = await ctx.scenario(key + ' looks', () => playForLooks(ctx, scene));
        if (found.error) return [found.error];
        const held = found.held;

        console.log('      ' + scene.name + ': ' + held.animated + ' animated elements (' + held.animations + ' animations), ' + held.elements + ' elements in the layer');
        const lines = held.properties.filter(name => !allowedProperties.includes(name)).map(name => scene.name + ': a part animates ' + name);
        if (held.animations < 100) lines.push(scene.name + ': only ' + held.animations + ' animations were made, the run did not draw its parts');
        if (held.perspectives !== 1) lines.push(scene.name + ': ' + held.perspectives + ' elements have a perspective, the stage has the only one');
        if (held.transformsWithPerspective > 0) lines.push(scene.name + ': ' + held.transformsWithPerspective + ' animations carry perspective() of their own');
        return lines.concat((found.pageErrors || []).map(error => 'the page said: ' + error));
      },
    },
    {
      name: prefix + 'at-0-ms-the-page-is-the-old-page',
      async run(ctx) {
        const found = await ctx.scenario(key + ' looks', () => playForLooks(ctx, scene));
        if (found.error) return [found.error];

        const result = await difference(ctx, found.before, found.atZero, found.held.regions.map(region => windowOf(region.from)), hawkBoxes(found, 0));
        if (result.share >= looksLike) ctx.keep(prefix + 'at-0-ms-the-page-is-the-old-page', { name: 'at-0ms', png: found.atZero });
        if (result.share >= looksLike) ctx.keep(prefix + 'at-0-ms-the-page-is-the-old-page', { name: 'before', png: found.before });
        return result.share < looksLike ? [] : [scene.name + ' at 0 ms: ' + round(result.share * 100) + ' percent of the pixels inside the frames differ from the page before it (limit ' + looksLike * 100 + ' percent)'];
      },
    },
    {
      name: prefix + 'at-3-s-the-page-is-the-new-page-with-no-seam',
      async run(ctx) {
        const found = await ctx.scenario(key + ' looks', () => playForLooks(ctx, scene));
        if (found.error) return [found.error];

        const result = await difference(ctx, found.atEnd, found.after, found.held.regions.map(region => windowOf(region.to)), hawkBoxes(found, found.held.duration));
        const name = prefix + 'at-3-s-the-page-is-the-new-page-with-no-seam';
        if (result.share >= looksLike) {
          ctx.keep(name, { name: 'at-3s', png: found.atEnd });
          ctx.keep(name, { name: 'the-page-after', png: found.after });
        }
        return result.share < looksLike ? [] : [scene.name + ' at its end: ' + round(result.share * 100) + ' percent of the pixels inside the frames differ from the real page (limit ' + looksLike * 100 + ' percent)'];
      },
    },
  ];
}

function hawkRule(theme) {
  return {
    name: 'reform/' + theme + '/view/the-hawk-stays-on-the-canvas',
    async run(ctx) {
      const found = await ctx.scenario('reform ' + theme + ' view looks', () => playForLooks(ctx, scenes[theme + ' view']));
      if (found.error) return [found.error];

      const lines = [];
      if (!found.hawk.some(sample => sample.plates === 4)) lines.push('the ' + theme + ' view transition drew no hawk of four plates');
      found.hawk.filter(sample => sample.plates > 0).forEach(sample => {
        const out = Math.max(0, -sample.left, -sample.top, sample.right - canvas.width, sample.bottom - canvas.height);
        if (out > 0) lines.push('the hawk at ' + sample.ms + ' ms: ' + Math.round(out) + 'px outside the canvas');
      });
      return lines;
    },
  };
}

export const tests = Object.keys(looksOf).reduce((all, theme) => all.concat(rules(theme, 'panel'), rules(theme, 'view'), [hawkRule(theme)]), []);
