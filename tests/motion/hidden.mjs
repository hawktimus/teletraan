// The two hidden transitions that drop the frames into a pile: the blue screen (the desktop reveal) and the red
// eyes (docs/hidden-transitions.md). Each plays once, and the rules read what the page did.

import { canvas, drawing } from './lib/harness.mjs';
import { pileExtraMs, pileLimitMs, pileShape, pileTimes } from '../../dashboard/core/transitions.js';

const tolerance = 1; // pixels, for a piece that has returned
const round = value => Math.round(value * 10) / 10;

const kinds = {
  'blue-screen': { tint: 'blue', picture: 'blue screen' },
  'red-eyes': { tint: 'red', picture: 'red eyes' },
};

async function runHidden(ctx, play) {
  const page = await ctx.open();
  try {
    await page.evaluate(name => {
      window.__motion.armHidden();
      window.teletraanTest.play(name);
    }, play);

    // The pile lies and the effect plays: a picture of it for the frames of a failure
    try {
      await page.waitForFunction(() => window.__motion.hidden.apart && window.__motion.hidden.events.some(event => event.picture.endsWith('1.00')), null, { timeout: 60000 });
      ctx.keep(play + '/collapse-leaves-no-piece-visible', { name: 'pile-and-effect', png: await page.screenshot() });
    } catch (error) {
      return { error: 'no pile came down within 60 seconds after the ' + play + ' play' };
    }
    try {
      await page.waitForFunction(() => window.__motion.hidden.ended, null, { timeout: 60000 });
    } catch (error) {
      return { error: 'the ' + play + ' transition did not end within 60 seconds' };
    }
    const hidden = await page.evaluate(() => window.__motion.hidden);
    hidden.natural = await page.evaluate(() => window.__motion.rest());
    return hidden;
  } finally {
    await page.close();
  }
}

function piecesPicture(name, pieces, bad) {
  return { name: name, drawing: drawing(name, pieces, bad) };
}

function collapse(ctx, rule, hidden) {
  const failures = [];
  const bad = [];
  const apart = hidden.apart;
  if (!apart) return ['pile at the end of the collapse: the page never reached the pile'];

  const at = round(apart.at);
  apart.contentShown.filter(node => node.opacity > 0.01).forEach(node => failures.push(node.name + ' at ' + at + ' ms: still shows, opacity ' + round(node.opacity * 100) / 100));

  const top = canvas.height - pileShape.bandHeight - 8;
  apart.view.pieces.filter(piece => piece.kind !== 'content').forEach(piece => {
    if (piece.top < top || piece.top + piece.height > canvas.height + 8) {
      failures.push(piece.name + ' at ' + at + ' ms: lies at top ' + round(piece.top) + ', bottom ' + round(piece.top + piece.height) + ' and not in the bottom ' + pileShape.bandHeight + 'px of the screen');
      bad.push(piece.name);
    }
  });
  if (failures.length > 0) ctx.keep(rule, piecesPicture('pile', apart.view.pieces, bad));
  return failures;
}

function effect(ctx, rule, hidden, kind) {
  const failures = [];
  const glitched = hidden.events.some(event => event.tint === kind.tint);
  const backdrop = hidden.events.some(event => event.backdrop && event.hidden === 'apart');
  const shown = hidden.events.some(event => event.hidden === 'apart' && event.picture.endsWith(' 1.00'));

  if (!glitched) failures.push('screen at 0 ms: no ' + kind.tint + ' glitch played before the collapse');
  if (!backdrop) failures.push('screen at ' + round(hidden.apart ? hidden.apart.at : 0) + ' ms: the backdrop is not shown over the pile');
  if (!shown) failures.push('screen at ' + round(hidden.apart ? hidden.apart.at : 0) + ' ms: the picture of the ' + kind.picture + ' never reached full opacity over the pile');
  return failures;
}

function cube(ctx, rule, hidden) {
  const failures = [];
  const series = hidden.cube;
  if (series.length === 0) return ['cube at ' + round(hidden.lift ? hidden.lift.at : 0) + ' ms: no cube was ever shown'];

  // It starts below the bottom edge, rises to the middle of the screen in pileTimes.cube.riseMs and shrinks to a point
  const first = series[0];
  const middle = box => box.top + box.height / 2;
  const risen = series.find(frame => frame.at - first.at >= pileTimes.cube.riseMs + 60);
  const last = series[series.length - 1];

  if (first.top < canvas.height) failures.push('cube at ' + round(first.at) + ' ms: it first shows at top ' + round(first.top) + ', not below the bottom edge of ' + canvas.height);
  if (!risen || Math.abs(middle(risen) - canvas.height / 2) > 2) {
    failures.push('cube at ' + round(risen ? risen.at : last.at) + ' ms: its middle is at y ' + round(risen ? middle(risen) : middle(last)) + ', not at the middle of the screen (' + canvas.height / 2 + ') after the rise');
  }
  series.filter(frame => risen && frame.at >= risen.at).forEach(frame => {
    const out = Math.max(0, -frame.left, -frame.top, frame.left + frame.width - canvas.width, frame.top + frame.height - canvas.height);
    if (out > 0) failures.push('cube at ' + round(frame.at) + ' ms: ' + round(out) + 'px outside the canvas');
  });
  if (last.width > 12) failures.push('cube at ' + round(last.at) + ' ms: it is still ' + round(last.width) + 'px wide when it ends, it should shrink to a point');
  if (failures.length > 0) ctx.keep(rule, piecesPicture('cube-path', series.map(frame => Object.assign({ kind: 'plate', name: 'cube' }, frame)), []));
  return failures;
}

function pieceReturn(ctx, rule, hidden) {
  const failures = [];
  const lift = hidden.lift;
  if (!lift) return ['pieces at the rise: the page never began to lift them'];

  const rest = hidden.natural.pieces.filter(piece => piece.kind !== 'bolt' && piece.kind !== 'content');
  const lifted = lift.view.pieces.filter(piece => piece.kind !== 'bolt' && piece.kind !== 'content');
  const at = round(lift.at + lift.end);
  const bad = [];

  if (lifted.length !== rest.length) failures.push('pieces at ' + at + ' ms: ' + lifted.length + ' are in the pile, ' + rest.length + ' belong in the frames');
  lifted.forEach((piece, index) => {
    const home = rest[index];
    if (!home) return;
    const off = Math.max(Math.abs(piece.left - home.left), Math.abs(piece.top - home.top), Math.abs(piece.width - home.width), Math.abs(piece.height - home.height));
    if (off > tolerance) {
      failures.push(piece.name + ' at ' + at + ' ms: ' + round(off) + 'px from its place (limit ' + tolerance + 'px)');
      bad.push(piece.name);
    }
  });

  // A bolt returns to the bolt it fell from
  lift.view.pieces.filter(piece => piece.kind === 'bolt').forEach(copy => {
    const x = copy.left + copy.width / 2;
    const y = copy.top + copy.height / 2;
    const nearest = Math.min(...hidden.natural.screws.map(screw => Math.hypot(screw.x - x, screw.y - y)));
    if (nearest > tolerance) {
      failures.push(copy.name + ' at ' + at + ' ms: ' + round(nearest) + 'px from the nearest bolt of a frame (limit ' + tolerance + 'px)');
      bad.push(copy.name);
    }
  });
  if (failures.length > 0) ctx.keep(rule, piecesPicture('rising-end', lift.view.pieces, bad));
  return failures;
}

function timeLimit(ctx, rule, hidden) {
  const events = hidden.events;
  const broke = events.find(event => event.hidden === 'break');
  const ended = events[events.length - 1];
  const cubeAt = hidden.cubeSeen ? hidden.cubeSeen.at : 0;
  if (!broke || !hidden.apart || !hidden.cubeSeen) return ['transition at 0 ms: the collapse, the effect or the cube is missing'];

  const extra = ended.at - broke.at - (cubeAt - hidden.apart.at);
  if (extra > pileLimitMs + 100) return ['transition at ' + round(ended.at) + ' ms: the collapse, the cube and the rebuild take ' + round(extra) + ' ms more than the effect, the limit is ' + pileLimitMs + ' ms'];
  if (pileExtraMs > pileLimitMs) return ['transition: pileExtraMs is ' + pileExtraMs + ' ms, over the limit of ' + pileLimitMs + ' ms'];
  return [];
}

function rule(play, name, check) {
  return {
    name: play + '/' + name,
    async run(ctx) {
      const hidden = await ctx.scenario(play, () => runHidden(ctx, play));
      if (hidden.error) return [hidden.error];
      if (hidden.hidden !== undefined && hidden.error) return [hidden.error];
      return check(ctx, play + '/' + name, hidden, kinds[play]);
    },
  };
}

export const tests = Object.keys(kinds).flatMap(play => [
  rule(play, 'collapse-leaves-no-piece-visible', collapse),
  rule(play, 'effect-plays', effect),
  rule(play, 'cube-rises', cube),
  rule(play, 'pieces-return', pieceReturn),
  rule(play, 'time-limit', timeLimit),
]);
