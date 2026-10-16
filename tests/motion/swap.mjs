// The pull-apart swap (docs/layouts.md, "The swap"), for a change of view and for a change of team.
// Each rule reads one run. The run asks the page to swap, and the page (lib/probe.js) pauses the
// animations at the exact times and reads where everything is.

import { canvas, drawing } from './lib/harness.mjs';

const times = [0, 200, 350];
const landing = 1250; // swapTimes.reformEndMs in dashboard/core/swap-plan.js
const tolerance = 1; // pixels

const round = value => Math.round(value * 10) / 10;

async function runSwap(ctx, play, options = {}) {
  const page = await ctx.open({ reform: 'off' }); // the older swap, which the view change used to play
  try {
    await page.evaluate(([name, extra, at]) => {
      window.__motion.armSwap(at);
      window.teletraanTest.play(name, extra);
    }, [play, options, times]);
    try {
      await page.waitForFunction(() => window.__motion.swapDone(), null, { timeout: 40000 });
    } catch (error) {
      return { error: 'no swap ran within 40 seconds after the ' + play + ' play (phase ' + await page.evaluate(() => window.__motion.swap.phase) + ')' };
    }
    const swap = await page.evaluate(() => window.__motion.swap);
    swap.mirrored = await page.evaluate(() => document.documentElement.classList.contains('mirrored'));
    swap.pageErrors = page.pageErrors;
    return swap;
  } finally {
    await page.close();
  }
}

function sampleAt(swap, time) {
  return swap.pull.samples.find(sample => sample.time === time).view;
}

function onlyPieces(list) {
  return list.filter(piece => piece.kind !== 'bolt');
}

// A piece is outside the canvas by this much on its worst side
function overshoot(piece) {
  return Math.max(0, -piece.left, -piece.top, piece.left + piece.width - canvas.width, piece.top + piece.height - canvas.height);
}

function picture(name, view, bad) {
  const blocks = view.blocks.map(block => Object.assign({ kind: 'text' }, block));
  return { name: name, drawing: drawing(name, view.pieces.concat(blocks), bad) };
}

function inPlaceAtStart(ctx, rule, swap) {
  const failures = [];
  const natural = onlyPieces(swap.pull.natural.pieces);
  const start = onlyPieces(sampleAt(swap, 0).pieces);
  const bad = [];

  if (start.length !== natural.length) failures.push('swap at 0 ms: ' + start.length + ' pieces on the screen, ' + natural.length + ' where they belong');
  start.forEach((piece, index) => {
    const home = natural[index];
    if (!home) return;
    const off = Math.max(Math.abs(piece.left - home.left), Math.abs(piece.top - home.top), Math.abs(piece.width - home.width), Math.abs(piece.height - home.height));
    if (off > tolerance) {
      failures.push(piece.name + ' at 0 ms: ' + round(off) + 'px from its place (limit ' + tolerance + 'px)');
      bad.push(piece.name);
    }
  });
  if (failures.length > 0) ctx.keep(rule, picture('at-0ms', sampleAt(swap, 0), bad));
  return failures;
}

function apartFrames(ctx, rule, swap) {
  const failures = [];

  [200, 350].forEach(time => {
    const view = sampleAt(swap, time);
    const bad = [];

    view.pieces.forEach(piece => {
      const out = overshoot(piece);
      const size = Math.max(piece.width, piece.height);
      if (out > size) {
        failures.push(piece.name + ' at ' + time + ' ms: ' + round(out) + 'px outside the canvas, more than its own size of ' + round(size) + 'px');
        bad.push(piece.name);
      }
    });
    view.overlaps.forEach(overlap => {
      failures.push(overlap.first + ' and ' + overlap.second + ' at ' + time + ' ms: the text overlaps by ' + round(overlap.across) + ' x ' + round(overlap.down) + 'px');
      bad.push(overlap.first.split(' "')[0], overlap.second.split(' "')[0]);
    });
    if (bad.length > 0) ctx.keep(rule, picture('at-' + time + 'ms', view, bad));
  });
  return failures;
}

function landedAtEnd(ctx, rule, swap) {
  const failures = [];
  const finishAt = swap.reform.startedAt + swap.reform.finish;
  const landed = onlyPieces(swap.reform.landed.pieces);
  const natural = onlyPieces(swap.reform.natural.pieces);
  const bad = [];

  if (finishAt > landing + 5) failures.push('swap at ' + round(finishAt) + ' ms: the last piece lands, later than ' + landing + ' ms');
  if (landed.length !== natural.length) failures.push('swap at ' + landing + ' ms: ' + landed.length + ' pieces landed, ' + natural.length + ' belong on the screen');
  landed.forEach((piece, index) => {
    const home = natural[index];
    if (!home) return;
    const off = Math.max(Math.abs(piece.left - home.left), Math.abs(piece.top - home.top), Math.abs(piece.width - home.width), Math.abs(piece.height - home.height));
    if (off > tolerance) {
      failures.push(piece.name + ' at ' + landing + ' ms: ' + round(off) + 'px from its place (limit ' + tolerance + 'px)');
      bad.push(piece.name);
    }
    if (Math.abs(piece.opacity - 1) > 0.001) {
      failures.push(piece.name + ' at ' + landing + ' ms: opacity ' + round(piece.opacity * 100) / 100 + ', it should be 1');
      bad.push(piece.name);
    }
  });
  if (failures.length > 0) ctx.keep(rule, picture('landed', swap.reform.landed, bad));
  return failures;
}

function hawkPath(ctx, rule, swap) {
  const failures = [];
  const path = swap.reform.path;
  const bad = [];

  path.forEach(step => {
    const out = overshoot(step);
    if (out > 0.5) {
      failures.push('hawk at ' + round(swap.reform.startedAt + step.time) + ' ms: ' + round(out) + 'px outside the canvas');
      bad.push('hawk');
    }
  });

  const end = path[path.length - 1];
  const slot = swap.reform.logo;
  if (!slot) {
    failures.push('hawk at ' + landing + ' ms: the new logo has no place on the screen');
  } else {
    const off = Math.max(Math.abs((end.left + end.width / 2) - (slot.left + slot.width / 2)), Math.abs((end.top + end.height / 2) - (slot.top + slot.height / 2)), Math.abs(end.width - slot.width));
    if (off > tolerance) {
      failures.push('hawk at ' + round(swap.reform.startedAt + end.time) + ' ms: ' + round(off) + 'px from the slot of the logo (limit ' + tolerance + 'px)');
      bad.push('hawk');
    }
  }
  if (failures.length > 0) {
    const steps = path.map(step => Object.assign({ kind: 'hawk', name: 'hawk' }, step));
    ctx.keep(rule, { name: 'hawk-path', drawing: drawing('hawk-path', steps.concat(slot ? [Object.assign({ kind: 'plate', name: 'slot' }, slot)] : []), bad) });
  }
  return failures;
}

// Nova is mirrored: each frame piece of the old look lands where its mirror image was
function mirroredLanding(ctx, rule, swap) {
  const failures = [];
  const bad = [];

  if (!swap.mirrored) failures.push('swap at ' + landing + ' ms: the page has no mirrored class after the change to Nova');
  // The frames of a page are cut to what it shows, so the areas of the screen are what must mirror
  const before = swap.pull.natural.regions;
  const after = swap.reform.natural.regions;
  const mirror = piece => ({ left: canvas.width - piece.left - piece.width, top: piece.top, width: piece.width, height: piece.height });

  before.forEach(piece => {
    const wanted = mirror(piece);
    const found = after.some(other => Math.abs(other.left - wanted.left) <= 2 && Math.abs(other.top - wanted.top) <= 2 && Math.abs(other.width - wanted.width) <= 2 && Math.abs(other.height - wanted.height) <= 2);
    if (!found) {
      failures.push(piece.name + ' at ' + landing + ' ms: nothing lands where its mirror image should be (left ' + round(wanted.left) + ', top ' + round(wanted.top) + ', ' + round(wanted.width) + ' wide)');
      bad.push(piece.name);
    }
  });
  if (failures.length > 0) {
    ctx.keep(rule, { name: 'before', drawing: drawing('before', before, bad) });
    ctx.keep(rule, { name: 'after', drawing: drawing('after', after, []) });
  }
  return failures;
}

function rule(group, name, check) {
  return {
    name: group + '/' + name,
    async run(ctx) {
      const swap = await ctx.scenario(group, () => runSwap(ctx, group === 'swap-view' ? 'view-swap' : 'team-swap'));
      if (swap.error) return [swap.error];
      if (swap.errors.length > 0) return ['swap probe: ' + swap.errors[0].split('\n')[0]];
      return check(ctx, group + '/' + name, swap);
    },
  };
}

export const tests = [
  rule('swap-view', 'pieces-in-place-at-0', inPlaceAtStart),
  rule('swap-view', 'apart-at-200-and-350', apartFrames),
  rule('swap-view', 'landed-at-1250', landedAtEnd),
  rule('swap-view', 'hawk-path', hawkPath),
  rule('swap-team', 'pieces-in-place-at-0', inPlaceAtStart),
  rule('swap-team', 'apart-at-200-and-350', apartFrames),
  rule('swap-team', 'landed-at-1250', landedAtEnd),
  rule('swap-team', 'hawk-path', hawkPath),
  rule('swap-team', 'mirrored-landing', mirroredLanding),
];
