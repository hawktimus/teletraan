// Draws the live subtheme (core/subthemes.js) over the stage. The layer is one div in #world, just after
// #stage, so everything that takes over the screen covers it. It is as big as the screen, clips each
// picture to the box of its place and lets every click through. It is drawn again only when the subtheme,
// the theme, the view or the layout changes, and is gone when there is nothing to draw.
//
// Each picture is an svg that points at one symbol with <use>, so a picture used in two places is
// drawn once. A symbol holds the line art of a drawing the screen has, or an <image> of an uploaded
// file. Nothing here moves: subthemes.css plays the motion, and only in full motion.

import { liveSubtheme, spritesFor } from './subthemes.js';
import { drawingMarkup } from './subtheme-art.js';
import { escapeHtml } from './text.js';

const layerId = 'subtheme-layer';
const checkEvery = 5000;

let drawnKey = '';

function page() {
  return document.documentElement;
}

function symbolsOf(sprites) {
  const seen = {};
  return sprites
    .filter(sprite => !seen[sprite.slot] && (seen[sprite.slot] = true))
    .map(sprite => {
      const inside = sprite.asset.builtin !== ''
        ? drawingMarkup(sprite.asset.builtin)
        : '<image href="' + escapeHtml(sprite.asset.url) + '" width="100" height="100"/>';
      return '<symbol id="subtheme-' + escapeHtml(sprite.slot) + '" viewBox="0 0 100 100">' + inside + '</symbol>';
    })
    .join('');
}

function spriteMarkup(sprite) {
  const box = sprite.box;
  return '<div class="subtheme-box" data-anchor="' + sprite.anchor + '" style="left:' + box.x + 'px;top:' + box.y + 'px;width:' + box.width + 'px;height:' + box.height + 'px">'
    + '<svg class="subtheme-sprite" data-motion="' + sprite.motion + '" width="' + sprite.size + '" height="' + sprite.size + '" style="left:' + (sprite.x - box.x) + 'px;top:' + (sprite.y - box.y) + 'px">'
    + '<use href="#subtheme-' + escapeHtml(sprite.slot) + '"/></svg></div>';
}

export function layerMarkup(sprites) {
  return '<svg class="subtheme-defs" width="0" height="0" aria-hidden="true">' + symbolsOf(sprites) + '</svg>' + sprites.map(spriteMarkup).join('');
}

function removeLayer() {
  const old = document.getElementById(layerId);
  if (old) old.remove();
  drawnKey = '';
}

function draw(getContent) {
  const content = getContent();
  const theme = page().dataset.theme || '';
  const view = page().dataset.view || '';
  const layout = page().dataset.layout || 'standard';
  const settings = content && content.theme ? content.theme : {};
  const live = content ? liveSubtheme(content.subthemes, new Date(), settings.timeZone) : null;
  const sprites = live ? spritesFor(live, theme, view, layout) : [];
  const html = sprites.length > 0 ? layerMarkup(sprites) : '';

  if (html === drawnKey) return;
  removeLayer();
  if (html === '') return;

  const stage = document.getElementById('stage');
  const world = document.getElementById('world');
  if (!stage || !world) return;

  const layer = document.createElement('div');
  layer.id = layerId;
  layer.className = 'subtheme-layer';
  layer.innerHTML = html;
  world.insertBefore(layer, stage.nextSibling);
  drawnKey = html;
}

export function startSubthemes(getContent) {
  const run = () => {
    try {
      draw(getContent);
    } catch (error) {
      console.error('The subtheme could not be drawn. The screen goes on without it.', error);
    }
  };

  run();
  setInterval(run, checkEvery);
}
