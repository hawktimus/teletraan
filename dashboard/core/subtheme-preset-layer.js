// Draws the shipped subtheme (core/subtheme-presets.js) over the frames. The layer is one div in #world, just
// after #stage and the layer of core/subthemes-layer.js, so everything that takes over the screen covers it.
// It is as big as the screen, lets every click through, and each piece is an svg that is as big as its
// anchor and clips what it draws. It is drawn again when the subtheme, the theme, the layout or the team
// trim changes, and is gone when there is nothing to draw. subthemes.css plays the motion, in full motion
// only, and hides the layer while the frames fly apart in a swap.

import { chooseShipped } from './subthemes.js';
import { presetMarkup, presetPieces } from './subtheme-presets.js';

const layerId = 'subtheme-frame-layer';
const checkEvery = 5000;

let drawnKey = '';
let timer = 0;

function page() {
  return document.documentElement;
}

// The preset the address asks for, or ''. ?subtheme=none draws none, whatever the schedule says.
function askedPreset() {
  try {
    return new URLSearchParams(window.location.search).get('subtheme') || '';
  } catch (error) {
    return '';
  }
}

function removeLayer() {
  const old = document.getElementById(layerId);
  if (old) old.remove();
  drawnKey = '';
}

function draw(getContent) {
  const root = page();
  const theme = root.dataset.theme || 'original';
  const layout = root.dataset.layout || 'standard';
  const options = { mirrored: root.classList.contains('mirrored'), flipped: root.classList.contains('corner-cut-tr') };
  const preset = chooseShipped(getContent(), askedPreset(), new Date());
  const html = preset === '' ? '' : presetMarkup(presetPieces(preset, theme, layout, options));

  const key = preset + '|' + html;
  if (key === drawnKey) return;
  removeLayer();
  if (html === '') return;

  const stage = document.getElementById('stage');
  const world = document.getElementById('world');
  if (!stage || !world) return;

  const layer = document.createElement('div');
  layer.id = layerId;
  layer.className = 'subtheme-frame-layer';
  layer.dataset.preset = preset;
  layer.innerHTML = html;
  const after = document.getElementById('subtheme-layer') || stage;
  world.insertBefore(layer, after.nextSibling);
  drawnKey = key;
}

export function startPresetSubthemes(getContent) {
  const run = () => {
    try {
      draw(getContent);
    } catch (error) {
      console.error('The subtheme could not be drawn. The screen goes on without it.', error);
    }
  };

  // A change of theme, layout, view or team trim is a change of an attribute of the page
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(run, 50);
  };

  run();
  setInterval(run, checkEvery);
  new MutationObserver(soon).observe(page(), { attributes: true, attributeFilter: ['class', 'data-layout', 'data-theme', 'data-view'] });
}
