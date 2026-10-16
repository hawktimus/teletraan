// The copies of the pieces and the hawk that flies over them (part of swap-run.js).

import * as frame from '../frame.js';
import { boltBox, boltCopy, boxOf, findBolts, findBoxes, findContent, findPlates } from './hidden-pile.js';
import { birdFades, flapFrames, hawkShape, hawkTransform, planHawk, swapTimes } from './swap-plan.js';

// Finding the pieces

// The part of the screen an element is in, which is how an old piece and a new one are matched
function regionOf(element) {
  const region = element.closest('[id^="region-"]');
  return region ? region.id : '';
}

const hawkColors = ['--logo-purple', '--logo-tail', '--logo-far'];

// Everything on the page that moves in a swap, measured on the 1920 x 1080 screen: the pieces of metal
// (swap-plan.js says what a piece is), the content that fades, and the logos. The areas whose frames
// are cut up are marked data-pile="pieces", so that frame.css shows their pieces.
export function capture(stage, place) {
  const plates = findPlates(stage);
  const boxes = findBoxes(stage);
  const content = findContent(stage, boxes);
  const bolts = findBolts(stage, plates);
  const counts = {};
  const pieces = [];

  const numberIn = (kind, region) => {
    const key = kind + '|' + region;
    counts[key] = (counts[key] || 0) + 1;
    return counts[key] - 1;
  };
  const add = (kind, id, element, parent) => {
    const box = boxOf(element, place);
    const region = regionOf(element);
    const piece = { id: id, kind: kind, region: region, index: numberIn(kind, region), parent: parent, left: box.left, top: box.top, width: box.width, height: box.height, element: element, zoom: box.zoom };
    pieces.push(piece);
    return piece;
  };

  plates.forEach((plate, index) => add('plate', 'plate-' + index, plate, ''));
  boxes.forEach((region, index) => add('box', 'box-' + index, region, ''));

  bolts.forEach((bolt, index) => {
    const plate = plates.indexOf(bolt.closest('svg.plate'));
    const box = boxOf(bolt, place);
    const size = boltBox * pieces[plate].zoom;
    const middle = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    const region = pieces[plate].region;

    pieces.push({ id: 'bolt-' + index, kind: 'bolt', region: region, index: numberIn('bolt', region), parent: 'plate-' + plate, left: middle.x - size / 2, top: middle.y - size / 2, width: size, height: size, element: null, bolt: bolt, middle: middle, zoom: 1 });
  });

  const logos = Array.from(stage.querySelectorAll('.logo'))
    .map(element => Object.assign({ element: element }, boxOf(element, place)))
    .filter(logo => logo.width > 0 && logo.height > 0);

  return { pieces: pieces, content: content, logos: logos };
}

// A bolt moves as a copy of its own in #pile, and the bolt on the frame is out of sight meanwhile
function makeCopy(piece, layer) {
  const size = piece.width;
  const copy = boltCopy(piece.bolt, piece.middle, size);

  piece.bolt.dataset.pile = 'released';
  layer.insertBefore(copy, document.getElementById('cube'));
  return copy;
}

// The element that moves for a piece
export function targetOf(piece, layer, copies) {
  if (piece.kind !== 'bolt') return piece.element;

  if (!copies[piece.id]) copies[piece.id] = makeCopy(piece, layer);
  return copies[piece.id];
}


// The icon

// The logo is copied into #pile, over everything, and the logo itself is out of sight until the copy lands. The copy
// stays where the logo was until the new place is known (flyHawk). It is a copy and not the logo that moves, because
// the banner is drawn again in the moment the look goes on, and a team's own picture is carried as it is.
export function startHawk(run, logos, layer) {
  const old = logos[0];
  if (!old) return;

  const original = old.element;
  const clone = original.cloneNode(true);
  const styles = window.getComputedStyle(original);

  clone.classList.add('swap-hawk');
  clone.style.cssText = 'position: absolute; left: ' + old.left + 'px; top: ' + old.top + 'px; width: ' + old.width + 'px; height: ' + old.height + 'px; margin: 0; transform-origin: 50% 50%;';
  const k = styles.getPropertyValue('--k');
  if (k) clone.style.setProperty('--k', k);
  hawkColors.forEach(name => clone.style.setProperty(name, styles.getPropertyValue(name))); // the old colors, until the middle of the travel

  layer.appendChild(clone);
  hideLogo(run, original);
  run.hawk = { clone: clone, old: old };
}

function hideLogo(run, logo) {
  logo.style.visibility = 'hidden';
  run.hiddenLogos.push(logo);
}

// The new place is known: the copy travels there with the pieces, from the moment the look went on to the moment they are
// home, and takes the colors of the new look half way. icon is what hawkMotionFor said, and a slight swap makes the copy a
// hawk for a moment on the way (flutter). travelMs is how long the pieces take, at normal speed.
export function flyHawk(run, logos, pace, icon, travelMs) {
  const hawk = run.hawk;
  if (!hawk) return;

  const target = logos[0];
  logos.forEach(logo => hideLogo(run, logo.element));

  const old = hawk.old;
  const from = { x: old.left + old.width / 2, y: old.top + old.height / 2, width: old.width, height: old.height };
  const to = target ? { x: target.left + target.width / 2, y: target.top + target.height / 2, width: target.width, height: target.height } : from;
  const plan = planHawk(from, to, travelMs, icon === 'slight' ? hawkShape.hopHeight : 0);

  const frames = plan.keyframes.map(keyframe => ({ offset: keyframe.offset, transform: hawkTransform(keyframe, plan.direction) }));
  run.hawkAnimations.push(hawk.clone.animate(frames, { duration: Math.round(plan.durationMs * pace), easing: 'linear', fill: 'forwards' }));
  run.hawkColorTimer = setTimeout(() => hawkColors.forEach(name => hawk.clone.style.removeProperty(name)), Math.round(plan.apexMs * pace));
  if (icon === 'slight') flutter(run, hawk.clone, pace);
}

// The emblem turns into the hawk and back in birdMs, and the wings beat. The animations end with the flutter, and the parts go
// back to what frame.css says: the emblem shown and the hawk hidden
function flutter(run, clone, pace) {
  const fades = birdFades();
  const flap = flapFrames();
  const beat = { duration: Math.round(hawkShape.birdMs / hawkShape.beats * pace), iterations: hawkShape.beats, easing: hawkShape.easing };
  const fade = { duration: Math.round(hawkShape.birdMs * pace), easing: 'linear' };

  clone.querySelectorAll('.emblem').forEach(part => run.hawkAnimations.push(part.animate(fades.emblem, fade)));
  clone.querySelectorAll('.hawk-part').forEach(part => run.hawkAnimations.push(part.animate(fades.hawk, fade)));
  [['.hawk-near-wing', flap.near], ['.hawk-far-wing', flap.far]].forEach(wing => {
    const part = clone.querySelector(wing[0]);
    if (part) run.hawkAnimations.push(part.animate(wing[1], beat));
  });
}

// The copy is gone and the logo is back, with a short fade between them
export async function landHawk(run, pace) {
  const hawk = run.hawk;
  if (!hawk) return;

  const fade = Math.round(swapTimes.landMs * pace);
  hawk.clone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fade, fill: 'forwards' });
  run.hiddenLogos.forEach(logo => {
    logo.style.removeProperty('visibility');
    logo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fade });
  });
  run.hiddenLogos = [];
  await frame.wait(fade);
}
