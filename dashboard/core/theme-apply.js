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
//
// An overlay may also have decorations (core/season.js). This file does not
// know about them: it tells whoever asked (the onLook of startThemes) each time
// a look goes on, and they follow the overlay from there.
//
// A look is { theme, overlay, style }. The style (core/style.js) is the Style
// setting, or ?style=, and it waits for the same moment as the theme. This file
// only carries it: onLook puts data-style on the page, in the same step as the
// classes, and a style with another layout reloads the page like a theme does.
// A preview (core/preview.js) holds a style or a pack through the same look, so it goes on
// at the same moment.

import * as frame from '../frame.js';
import { themes } from '../themes/registry.js';
import { overlays } from '../themes/overlays/registry.js';
import { isKnownOverlay, isKnownTheme, previewedPack, resolveTheme } from './theme.js';
import { chooseStyle } from './style.js';

const page = document.documentElement;
const checkEvery = 60 * 1000;
const waitedTooLong = 60 * 1000;
const stylesheetWait = 2000;

let readContent = null; // gives the newest content, set by startThemes
let asked = { theme: null, overlay: null, style: null }; // ?theme=, ?overlay= and ?style= in the address, for trying a look
let showing = { theme: '', overlay: '', style: '' }; // what the classes and data-style on the page say now
let waiting = null; // { look, since }: a look that is not on screen yet
let followLook = null; // called with the look each time it goes on the page. shell.js gives it, to show the overlay's decorations
let holdLook = null; // asked before a look goes on the page: true means not now. shell.js gives it, for a theme with another layout (core/layout-apply.js)

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
  return a.theme === b.theme && a.overlay === b.overlay && a.style === b.style;
}

// The theme and overlay the Theme document asks for now, and the style Dashboard
// Settings asks for. The address wins, like the other switches.
function wantedLook() {
  try {
    const content = readContent();
    const look = resolveTheme(content.theme, new Date());
    if (isKnownTheme(asked.theme)) look.theme = asked.theme;
    if (isKnownOverlay(asked.overlay)) look.overlay = asked.overlay;
    if (asked.overlay === 'none') look.overlay = '';
    look.overlay = previewedPack() || look.overlay; // a preview wins over the address, like the style
    look.style = chooseStyle(content.settings ? content.settings.style : null, asked.style);
    return look;
  } catch (error) {
    console.error('Could not work out the theme', error);
    return null;
  }
}

// The old theme class and overlay class go and the new ones come in one step,
// so the screen is never drawn with half of each
function applyLook(look) {
  // A theme with another layout cannot go on by changing variables. The page
  // reloads to change layout, so this look is not put on this page.
  if (holdLook) {
    try {
      if (holdLook(look)) return;
    } catch (error) {
      console.error('Could not check the layout of the theme', error);
    }
  }

  Array.prototype.slice.call(page.classList)
    .filter(name => /^(theme|overlay)-/.test(name))
    .forEach(name => page.classList.remove(name));

  page.classList.add('theme-' + look.theme);
  if (look.overlay) page.classList.add('overlay-' + look.overlay);

  showing = look;
  waiting = null;

  // Told in the same step as the classes, so the decorations change with the colours.
  // A problem there must never stop the colours going on.
  if (followLook) {
    try {
      followLook(look);
    } catch (error) {
      console.error('Could not follow the theme change', error);
    }
  }
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

// Gives the function that is asked before a look goes on the page. It is called
// with { theme, overlay, style } and answers true to keep the look off the page for now.
// shell.js gives it, call this before startThemes().
export function holdLooksFor(hold) {
  holdLook = typeof hold === 'function' ? hold : null;
}

// getContent() gives the newest content. address is { theme, overlay, style } from
// the address bar, or null. onLook is optional: it is called with
// { theme, overlay, style } each time a look goes on the page, the first time too.
// Resolves once the theme is on the page.
export async function startThemes(getContent, address, onLook) {
  readContent = getContent;
  asked = Object.assign(asked, address);
  followLook = typeof onLook === 'function' ? onLook : null;

  await addStylesheets();
  showThemeNow();
  setInterval(checkTheme, checkEvery);
}
