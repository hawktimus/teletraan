// Puts the chosen theme and overlay on the page. core/theme.js works out which
// ones; this file loads their stylesheets, checks once a minute, and sets one
// class for each on the html element, for example
//
//   <html class="theme-alternate overlay-example">
//
// The classes switch on the variables in themes/. Nothing here moves
// anything: a theme changes variables only.
//
// When the answer changes, the screen does not change colour in front of
// people. The change waits for the next page change in the large panel and
// happens in the moment the frame is apart (areas.js calls
// changeThemeNow() there). If no page change comes for a minute, for example
// during an alert, it happens anyway. At boot it happens at once.

import * as frame from '../frame.js';
import { themes } from '../themes/registry.js';
import { overlays } from '../themes/overlays/registry.js';
import { isKnownOverlay, isKnownTheme, resolveTheme } from './theme.js';

const page = document.documentElement;
const checkEvery = 60 * 1000;
const waitedTooLong = 60 * 1000;
const stylesheetWait = 2000;

let readContent = null; // gives the newest content, set by startThemes
let asked = { theme: null, overlay: null }; // ?theme= and ?overlay= in the address, for trying a theme
let showing = { theme: '', overlay: '' }; // what the classes on the page say now
let waiting = null; // { look, since }: a look that is not on screen yet

// The one stylesheet index.html links itself is hawktimus.css, because the
// screen needs it before anything is drawn. Every other theme and overlay is
// linked here from the registries. Overlays go last, so when an overlay and a
// theme set the same variable the overlay wins.
function addStylesheets() {
  const files = themes.map(theme => 'themes/' + theme.id + '.css')
    .concat(overlays.map(overlay => 'themes/overlays/' + overlay.id + '.css'));

  const loading = files
    .filter(file => !document.querySelector('link[href="' + file + '"]'))
    .map(file => new Promise(resolve => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = file;
      link.addEventListener('load', resolve);
      link.addEventListener('error', () => {
        console.error('Could not load ' + file + '. Is it listed in a registry.js but missing?');
        resolve();
      });
      document.head.appendChild(link);
    }));

  // A stylesheet that is slow to arrive must not hold up the screen
  return Promise.race([Promise.all(loading), frame.wait(stylesheetWait)]);
}

function sameLook(a, b) {
  return a.theme === b.theme && a.overlay === b.overlay;
}

// The theme and overlay the Theme document asks for now. The address wins,
// like the other switches.
function wantedLook() {
  try {
    const look = resolveTheme(readContent().theme, new Date());
    if (isKnownTheme(asked.theme)) look.theme = asked.theme;
    if (isKnownOverlay(asked.overlay)) look.overlay = asked.overlay;
    if (asked.overlay === 'none') look.overlay = '';
    return look;
  } catch (error) {
    console.error('Could not work out the theme', error);
    return null;
  }
}

// The old theme class and overlay class go and the new ones come in one step,
// so the screen is never drawn with half of each
function applyLook(look) {
  Array.prototype.slice.call(page.classList)
    .filter(name => /^(theme|overlay)-/.test(name))
    .forEach(name => page.classList.remove(name));

  page.classList.add('theme-' + look.theme);
  if (look.overlay) page.classList.add('overlay-' + look.overlay);

  showing = look;
  waiting = null;
}

// Works out the look again and remembers a change, without showing it.
// shell.js calls it when the content changes and once a minute.
export function checkTheme() {
  if (!readContent) return;

  const look = wantedLook();
  if (!look) return;

  if (sameLook(look, showing)) {
    waiting = null;
  } else if (!waiting || !sameLook(waiting.look, look)) {
    waiting = { look: look, since: Date.now() };
  } else if (Date.now() - waiting.since >= waitedTooLong) {
    applyLook(look);
  }
}

// The look from the newest content, on the page now
export function showThemeNow() {
  const look = wantedLook();
  if (look) applyLook(look);
}

// Called by areas.js while the large panel's frame is apart. If a different
// look is waiting, this is when it goes on.
export function changeThemeNow() {
  if (waiting) showThemeNow();
}

// getContent() gives the newest content. address is { theme, overlay } from
// the address bar, or null. Resolves once the theme is on the page.
export async function startThemes(getContent, address) {
  readContent = getContent;
  asked = Object.assign(asked, address);

  await addStylesheets();
  showThemeNow();
  setInterval(checkTheme, checkEvery);
}
