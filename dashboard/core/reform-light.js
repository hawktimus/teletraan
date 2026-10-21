// The Light panel and view transitions (docs/transitions.md, "Light"). One simple change for each theme with a handful of parts:
// two plates close over the region from its two sides, the page changes under them, and they open again. Nothing is copied, no
// square is drawn and no layer is larger than its region, so the 2011 computer can play it.
//
//   1. The plates close over each region (the panel, or the banner, the side column, the main panel and the ticker).
//   2. While they are closed the page changes under them, as the heavy transitions change it.
//   3. The plates open on the new page and are taken away.
//
// The theme says what the plates and the few parts on them look like (kit.light in styles/<theme>/transitions.js, and the
// stylesheet of the theme). A part is a description, { cls, markup, x, y, w, h, close, open }: the box of the part in its
// region, and the keyframes it plays while the plates close and while they open. This file makes the elements and plays the
// keyframes, so a kit holds no code that touches the page.

import * as frame from '../frame.js';
import { lightTimes } from './reform-plan.js';
import { rectOf, screenOrigin } from './reform-bake.js';
import { kitNow, layerOf, nextFrame, takeRun } from './reform-run.js';
import { otherRegions, regionWait, reloadWait, rolesOnPage, waitForRest } from './reform-view.js';

const platesClosed = 'scaleX(1)';
const platesOpen = 'scaleX(0)';
const closeEase = 'cubic-bezier(.5,0,.3,1)';
const openEase = 'cubic-bezier(.3,0,.5,1)';

function make(className, style = '', markup = '') {
  const element = document.createElement('div');
  element.className = className;
  if (style) element.style.cssText = style;
  if (markup) element.innerHTML = markup;
  return element;
}

const round = value => Math.round(value * 100) / 100;
const px = value => round(value) + 'px';

// The two plates of a region and the parts of the kit on them. A region drawn while the plates are closed starts closed.
// The animations are made later (play), so a part waits in the pose it starts from.
function regionOf(region, kit, closed) {
  const rect = region.rect;
  const box = make('reform-light-region', 'left:' + px(rect.x) + ';top:' + px(rect.y) + ';width:' + px(rect.w) + ';height:' + px(rect.h) + ';');
  const items = [];
  const plates = [
    ['reform-light-plate reform-light-left', 'left:0;width:calc(50% + 1px);transform-origin:0 50%;'],
    ['reform-light-plate reform-light-right', 'right:0;width:calc(50% + 1px);transform-origin:100% 50%;'],
  ];

  plates.forEach(([className, style]) => {
    const plate = make(className, 'top:0;height:100%;' + style + 'transform:' + (closed ? platesClosed : platesOpen) + ';');
    box.appendChild(plate);
    items.push({ element: plate, close: [{ transform: platesOpen }, { transform: platesClosed }], open: [{ transform: platesClosed }, { transform: platesOpen }] });
  });

  const parts = kit.light ? kit.light(rect.w, rect.h, region.role) : [];
  parts.forEach(part => {
    const element = make('reform-light-part ' + part.cls, 'left:' + px(part.x) + ';top:' + px(part.y) + ';width:' + px(part.w) + ';height:' + px(part.h) + ';', part.markup || '');
    const rest = closed ? part.close[part.close.length - 1] : part.close[0];
    Object.keys(rest).forEach(name => { if (name !== 'offset' && name !== 'easing') element.style.setProperty(name, String(rest[name])); });
    box.appendChild(element);
    items.push({ element: element, close: part.close, open: part.open });
  });
  return { role: region.role, rect: rect, box: box, items: items };
}

// The run: the layer of every region, and the way to play it
function drawRun(regions, kit, closed = false) {
  const root = make('reform-light');
  const made = regions.map(region => regionOf(region, kit, closed));

  made.forEach(item => root.appendChild(item.box));
  return { root: root, regions: made, animations: [] };
}

function elementsOf(run) {
  return run.regions.reduce((all, region) => all.concat(region.items), []);
}

// Plays one phase, close or open, of every part at once, and resolves when they are done. The animations are named
// reform so that a test that holds a run finds them (tests/motion).
function play(run, phase, ms) {
  const animations = elementsOf(run).map(item => {
    const animation = item.element.animate(item[phase], { duration: ms, easing: phase === 'close' ? closeEase : openEase, fill: 'forwards' });
    animation.id = 'reform';
    return animation;
  });

  run.animations = run.animations.concat(animations);
  return Promise.all(animations.map(animation => animation.finished.catch(() => {})));
}

// The counts that the tests and ?debug=1 read, as the heavy runs write them
function markReady(run) {
  const layer = layerOf();
  const all = new Set([run.root]);

  run.root.querySelectorAll('*').forEach(element => all.add(element));
  layer.dataset.ready = '1';
  layer.dataset.weight = 'light';
  layer.dataset.elements = String(all.size);
  layer.dataset.animated = String(elementsOf(run).length);
  layer.dataset.regions = JSON.stringify(run.regions.map(item => ({ role: item.role, from: item.rect, to: item.rect, grid: 'light' })));
}

function mount(run) {
  const layer = layerOf();
  const camera = layer.firstElementChild;

  camera.replaceChildren(run.root);
  layer.hidden = false;
  return () => {
    delete layer.dataset.ready;
    delete layer.dataset.weight;
    run.animations.forEach(animation => animation.cancel());
    camera.replaceChildren();
    layer.hidden = true;
  };
}

// The time of a phase: the Speed setting stretches it, and the length of Dashboard Settings does not, because Light is
// never longer than a transition of the shortest length
const phaseMs = normal => Math.round(normal * frame.pace());

// Waits for the page that was just changed to be drawn once, which is when the plates may open
async function settle() {
  await nextFrame();
  await nextFrame();
}

export async function playPanelLight(swapPage, context) {
  const area = document.querySelector('#region-grid1 .area');
  const release = area ? takeRun('reform', context.hold) : null;
  if (!release) return 0;

  let cleanup = () => {};
  const started = performance.now();

  try {
    const kit = await kitNow();
    const rect = rectOf(area, screenOrigin());
    const run = drawRun([{ role: 'main', rect: rect }], kit);

    cleanup = mount(run);
    markReady(run);
    await play(run, 'close', phaseMs(lightTimes.closeMs));
    if (context.busyNow()) return 0;

    swapPage();
    await settle();
    await play(run, 'open', phaseMs(lightTimes.openMs));
    return performance.now() - started;
  } catch (error) {
    console.error('The light panel transition failed', error);
    return 0;
  } finally {
    cleanup();
    release();
  }
}

// The regions of the page now, as the plates cover them
function regionsOnPage(origin) {
  const found = rolesOnPage(origin);
  return Object.keys(found).map(role => ({ role: role, rect: found[role].rect }));
}

export async function playViewLight(swapPage, context) {
  const release = takeRun('reform', context.hold);
  if (!release) return 0;

  const stage = document.getElementById('stage');
  const screen = context.wholeScreen(false);
  let cleanup = () => {};

  frame.setSwapPlaying(true);
  try {
    if (!await waitForRest(context.busyNow)) return 0;

    const kit = await kitNow();
    const origin = screenOrigin();
    const run = drawRun(regionsOnPage(origin), kit);

    cleanup = mount(run);
    markReady(run);
    await play(run, 'close', phaseMs(lightTimes.closeMs));
    if (context.busyNow()) return 0;

    // The look goes on under the plates, with the pages of the other areas, as the swap does it. The stage is out of sight
    // until the plates open, so nothing of the next view shows before it is turned to
    stage.style.opacity = '0.001';
    context.moveOn(otherRegions);
    await screen.waitForRegions(otherRegions, regionWait);
    swapPage();
    screen.apart();
    if (context.reloading()) await frame.wait(reloadWait);

    // The plates are drawn again where the regions are now, already closed, and the old ones are taken away
    run.animations.forEach(animation => animation.cancel());
    const next = drawRun(regionsOnPage(origin), kit, true);
    cleanup = mount(next);
    markReady(next);
    stage.style.removeProperty('opacity');
    await settle();
    await play(next, 'open', phaseMs(lightTimes.openMs));
    return phaseMs(lightTimes.closeMs + lightTimes.openMs);
  } catch (error) {
    console.error('The light view transition failed', error);
    return 0;
  } finally {
    stage.style.removeProperty('opacity');
    cleanup();
    screen.together();
    screen.end();
    frame.setSwapPlaying(false);
    release();
  }
}
