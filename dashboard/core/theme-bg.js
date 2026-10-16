// The background behind the stage (index.html, #theme-bg). Each theme has its own, in the folder of the theme
// (styles/<id>/background.js), and draws it with the stylesheet of the theme. The page holds all of them, and a
// stylesheet shows the one of the theme that is on, so a theme that goes on while the screen runs has its
// background already there.
//
// The setting Background of Dashboard Settings (Look tab) picks the background of the Original theme only: sweep,
// blueprint, rays, spotlight or embers. It is written on the page as data-background. ?background= in the address
// wins for that page, like the other switches. The other themes ignore it.

import { backgrounds, defaultSettings } from '../config.js';
import { backgroundMarkup as cybertron } from '../styles/cybertron/background.js';
import { backgroundMarkup as foundry } from '../styles/foundry/background.js';
import { backgroundMarkup as original } from '../styles/original/background.js';
import { backgroundMarkup as retro } from '../styles/retro/background.js';

// The background to show: the address, then the setting, then the default
export function backgroundFor(settings, asked) {
  if (backgrounds.includes(asked)) return asked;
  const saved = settings ? settings.background : '';
  return backgrounds.includes(saved) ? saved : defaultSettings.background;
}

// The markup of every theme's background, one group each
export function allBackgrounds() {
  return original() + cybertron() + retro() + foundry();
}

// Fills #theme-bg once. Called when the page starts, before anything is drawn. A page that has no #theme-bg
// (a test page) is left as it is.
export function fillBackground(doc = typeof document === 'undefined' ? null : document) {
  const host = doc ? doc.getElementById('theme-bg') : null;
  if (!host || host.firstElementChild) return false;
  host.innerHTML = allBackgrounds();
  return true;
}
