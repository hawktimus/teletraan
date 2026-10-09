// The end of the red eyes and the blue screen: the frames fall into a pile, a cube rises out
// of it and the frames fly back (docs/hidden-transitions.md, "The frames fall and come back").
// This file finds what falls on the page, measures it, hands the list to planPile()
// (core/transitions.js) and writes the answer on the page. frame.css does all the moving, and
// core/hidden-run.js starts each part at its time.
//
// What it writes on the page, all of it taken away again by clear():
//   data-pile="pieces"    on an area or a panel whose frame is cut into pieces. Its pieces show
//                         in place of the whole frame while the metal is down
//   data-pile="piece"     on an element that falls. The numbers that move it are custom
//                         properties on it (--pile-...)
//   data-pile="released"  on a bolt that falls by itself, as a copy of its own in #pile
//   data-pile="content"   on text, lists and pictures, which fade away before the metal falls
//   data-content="in"     on an area whose page comes back in at the end
// and the copies of the bolts in #pile.
//
// What falls is every piece of metal the page draws as a separate element: the pieces of a cut up
// frame, the fills and the two halves of a frame that is not cut up, every bolt, and a region
// that paints a box of its own (the strip and the sidebar of the sidebar layout).

import { enter, pace } from '../frame.js';
import { pileShape, pileTimes, planPile } from './transitions.js';

const svgNamespace = 'http://www.w3.org/2000/svg';
const boltBox = 48; // a copy of a bolt is a square this wide, with the bolt in the middle, before the zoom of its frame

// Where the middle of the cube is when it rests. base.css puts #cube at left 900 and top 840, 120 wide
const cubeMiddle = { x: 960, y: 900 };

const poseProperties = ['--pile-x', '--pile-y', '--pile-tip', '--pile-twist', '--pile-scale', '--pile-delay', '--pile-lift-delay'];
const cubeProperties = ['--cube-dx', '--cube-dy', '--cube-shrink-delay', '--cube-shrink-time'];

// The plates that fall. A frame that is cut into pieces (the large and the small panel, the main panel
// of the bar layout) falls as its pieces, which the page keeps hidden until now. A frame that is not
// (the countdown, the banners, the ticker of the bar layout) falls as its fills and its two halves.
// The shadows, the glint and the stamped id stay behind, and frame.css hides them.
function findPlates(stage) {
  const plates = [];

  stage.querySelectorAll('.area, .panel').forEach(root => {
    const own = Array.from(root.children).filter(child => child.matches('svg.plate'));
    const cut = own.filter(plate => plate.classList.contains('piece'));

    if (cut.length > 0) root.dataset.pile = 'pieces';
    const falling = cut.length > 0 ? cut : own.filter(plate => !plate.matches('.glint-layer, .shadow-layer'));
    falling.forEach(plate => plates.push(plate));
  });
  return plates;
}

// A region that paints a box of its own with a style sheet falls whole. It has a background, or a ::before
// that draws its frame, as the strip and the sidebar of the sidebar layout have. A region that holds
// plates is not one: its plates fall by themselves
function findBoxes(stage) {
  return Array.from(stage.querySelectorAll('[data-block]')).filter(region => {
    const style = window.getComputedStyle(region);
    const before = window.getComputedStyle(region, '::before').content;
    const painted = style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent';
    return (painted || style.backgroundImage !== 'none' || (before !== 'none' && before !== 'normal')) && region.querySelectorAll('svg.plate').length === 0;
  });
}

// Everything in the frames that is not metal. It fades away in the first part of the break
function findContent(stage, boxes) {
  const content = [];

  stage.querySelectorAll('.panel').forEach(panel => {
    Array.from(panel.children)
      .filter(child => !child.matches('svg.plate, .plate-id, .scan-clip'))
      .forEach(child => content.push(child));
  });
  stage.querySelectorAll('.page-host').forEach(host => content.push(host));
  boxes.forEach(box => {
    Array.from(box.children).filter(child => !child.matches('.kit')).forEach(child => content.push(child));
  });
  return content.filter(node => node.dataset.pile === undefined); // an area that is marked as pieces is metal
}

// The bolts on the plates that fall, that can be seen
function findBolts(stage, plates) {
  return Array.from(stage.querySelectorAll('.screw')).filter(bolt => {
    const plate = bolt.closest('svg.plate');
    return plate !== null && plates.indexOf(plate) !== -1 && bolt.getBoundingClientRect().width > 0;
  });
}

// Where the 1920 x 1080 screen is in the window. shell.js shrinks it to fit a smaller window
function screenPlace() {
  const box = document.getElementById('screen').getBoundingClientRect();
  return { left: box.left, top: box.top, scale: box.width / pileShape.screenWidth };
}

// Where an element is on the 1920 x 1080 screen, and its zoom: how many pixels of the screen one pixel
// of its own is. It is 1, except in the frames that the sidebar layout and the bar layout scale to fit
// (layouts/sidebar.css and layouts/bar.css). A distance on the screen is a distance in the element's own
// pixels once it is divided by the zoom, which is what the transform in frame.css moves by.
function boxOf(element, place) {
  const box = element.getBoundingClientRect();
  const width = box.width / place.scale;
  const ownWidth = element.offsetWidth || Number(element.getAttribute('width')) || 0;

  return {
    left: (box.left - place.left) / place.scale,
    top: (box.top - place.top) / place.scale,
    width: width,
    height: box.height / place.scale,
    zoom: ownWidth > 0 ? width / ownWidth : 1,
  };
}

// A bolt falls by itself, so it gets a copy in #pile, which lies over the whole stage and is moved by
// nothing. The bolt on the frame stays hidden until the pieces are back. middle is where the bolt is
// on the screen, and size how wide the copy is there: the bolt drawn as the frame draws it
function boltCopy(bolt, middle, size) {
  const copy = document.createElementNS(svgNamespace, 'svg');
  copy.setAttribute('class', 'plate pile-bolt');
  copy.setAttribute('width', String(size));
  copy.setAttribute('height', String(size));
  copy.setAttribute('viewBox', [-boltBox / 2, -boltBox / 2, boltBox, boltBox].join(' '));
  copy.style.left = (middle.x - size / 2) + 'px';
  copy.style.top = (middle.y - size / 2) + 'px';

  const head = document.createElementNS(svgNamespace, 'use');
  head.setAttribute('class', 'screw');
  head.setAttribute('href', bolt.getAttribute('href'));
  copy.appendChild(head);
  return copy;
}

// Writes one entry of the plan on the element that falls. The delays are stretched by the Speed
// setting, as the other delays are
function writePose(element, entry, zoom) {
  const pose = entry.pose;

  element.style.setProperty('--pile-x', Math.round(pose.x / zoom * 10) / 10 + 'px');
  element.style.setProperty('--pile-y', Math.round(pose.y / zoom * 10) / 10 + 'px');
  element.style.setProperty('--pile-tip', pose.tip + 'deg');
  element.style.setProperty('--pile-twist', pose.twist + 'deg');
  element.style.setProperty('--pile-scale', String(pose.scale));
  element.style.setProperty('--pile-delay', Math.round(entry.fall.delayMs * pace()) + 'ms');
  element.style.setProperty('--pile-lift-delay', Math.round(entry.lift.delayMs * pace()) + 'ms');
  element.dataset.pile = 'piece';
}

// The cube shrinks to a point in the middle of the large panel, and is gone when the last piece is back
function writeCube(cube, plan, place) {
  const grid = document.getElementById('region-grid1');
  const box = grid ? boxOf(grid, place) : null;
  const target = box && box.width > 0
    ? { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    : { x: pileShape.screenWidth / 2, y: pileShape.screenHeight / 2 };

  cube.style.setProperty('--cube-dx', Math.round(target.x - cubeMiddle.x) + 'px');
  cube.style.setProperty('--cube-dy', Math.round(target.y - cubeMiddle.y) + 'px');
  cube.style.setProperty('--cube-shrink-delay', Math.round((pileTimes.liftAtMs - pileTimes.cubeAtMs) * pace()) + 'ms');
  cube.style.setProperty('--cube-shrink-time', Math.round((plan.lockedMs - pileTimes.liftAtMs) * pace()) + 'ms');
}

// Finds what falls and marks the areas whose frames are cut up. Nothing moves until release().
// empty is true when the page has no metal to drop, and then the screen should just come back.
export function makePile() {
  const stage = document.getElementById('stage');
  const layer = document.getElementById('pile');
  const cube = document.getElementById('cube');

  const plates = findPlates(stage);
  const boxes = findBoxes(stage);
  const content = findContent(stage, boxes);

  // The pieces are back where they belong: the frames show again as they were and the cube is gone
  function finish() {
    layer.querySelectorAll('.pile-bolt').forEach(copy => copy.remove());
    document.querySelectorAll('[data-pile="released"]').forEach(bolt => { delete bolt.dataset.pile; });
    cube.hidden = true;
    layer.hidden = true;
  }

  // The page as it was before, whatever happened. It can be called at any time, and more than once
  function clear() {
    finish();
    document.querySelectorAll('[data-pile]').forEach(element => {
      poseProperties.forEach(name => element.style.removeProperty(name));
      delete element.dataset.pile;
    });
    cubeProperties.forEach(name => cube.style.removeProperty(name));
    document.querySelectorAll('.area[data-content]').forEach(area => { delete area.dataset.content; });
  }

  return {
    empty: plates.length + boxes.length === 0,

    // Call it once #world has data-hidden="fall", which shows the pieces. It measures everything,
    // plans the fall and the lift, and starts the fall: the content fades and the metal lets go.
    // Returns the plan.
    release(seed) {
      const place = screenPlace();
      const pieces = [];
      const found = {};

      const add = (id, element) => {
        const box = boxOf(element, place);
        found[id] = { element: element, zoom: box.zoom };
        pieces.push(Object.assign({ id: id, parent: '' }, box));
      };
      plates.forEach((plate, index) => add('plate-' + index, plate));
      boxes.forEach((region, index) => add('box-' + index, region));
      findBolts(stage, plates).forEach((bolt, index) => {
        const box = boxOf(bolt, place);
        const parent = 'plate-' + plates.indexOf(bolt.closest('svg.plate'));
        const size = boltBox * found[parent].zoom;
        const middle = { x: box.left + box.width / 2, y: box.top + box.height / 2 };

        found['bolt-' + index] = { bolt: bolt, middle: middle, size: size, zoom: 1 };
        pieces.push({ id: 'bolt-' + index, parent: parent, left: middle.x - size / 2, top: middle.y - size / 2, width: size, height: size });
      });

      const plan = planPile(pieces, seed);

      layer.hidden = false;
      plan.pieces.forEach(entry => {
        const item = found[entry.id];
        if (item.bolt) {
          item.element = boltCopy(item.bolt, item.middle, item.size);
          layer.insertBefore(item.element, cube);
          item.bolt.dataset.pile = 'released';
        }
        writePose(item.element, entry, item.zoom);
      });
      content.forEach(node => { node.dataset.pile = 'content'; });
      writeCube(cube, plan, place);
      return plan;
    },

    showCube() {
      cube.hidden = false;
    },

    finish: finish,

    // The first assembly again, for the content only: each area turns its page in, and each
    // panel brings its own parts in as it does at the start (frame.js, enter)
    contentIn() {
      document.querySelectorAll('.area').forEach(area => { area.dataset.content = 'in'; });
      stage.querySelectorAll('.panel[data-sequence]').forEach(panel => {
        try {
          enter(panel, true);
        } catch (error) {
          console.error('The ' + panel.dataset.sequence + ' panel could not bring its content back', error);
        }
      });
    },

    clear: clear,
  };
}
