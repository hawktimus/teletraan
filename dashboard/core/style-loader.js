// Finds a theme's folder from its id (themeIds in config.js). The folder is styles/<id>/ and has four files:
//
//   tokens.css       the theme-level overrides of the team tokens
//   theme.css        the frames, textures and type of the theme
//   frame.css        the keyframes and animation rules that only this theme has
//   transitions.js   the swap variant (core/swap-plan.js is the default)
//
// index.html links the three stylesheets of every theme, so a theme that goes on while the screen runs
// is ready at once. ensureThemeSheets adds a link that is missing, which only a page built by hand lacks.
// ?style= and the weekday schedule give an id, and every function here takes an id that is not a
// theme as the default theme.

import { defaultSettings } from '../config.js';
import { themeOf } from './style.js';

const themeSheetNames = ['tokens.css', 'theme.css', 'frame.css'];

export function themeFolder(id) {
  return 'styles/' + themeOf(id) + '/';
}

export function themeSheets(id) {
  return themeSheetNames.map(name => themeFolder(id) + name);
}

// The path of the swap variant, from the folder of the dashboard
export function transitionsPath(id) {
  return themeFolder(id) + 'transitions.js';
}

// Adds a <link> for each stylesheet of the theme that the page does not have yet. Returns the number added.
export function ensureThemeSheets(id, doc = typeof document === 'undefined' ? null : document) {
  if (!doc || !doc.head) return 0;

  const have = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map(link => (link.getAttribute('href') || '').split('?')[0]);
  const version = (doc.querySelector('link[href*="styles/"]') || { getAttribute: () => '' }).getAttribute('href') || '';
  const suffix = version.indexOf('?') === -1 ? '' : version.slice(version.indexOf('?'));
  let added = 0;

  themeSheets(id).forEach(href => {
    if (have.includes(href)) return;
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = href + suffix;
    doc.head.appendChild(link);
    added += 1;
  });
  return added;
}

// The swap variant of a theme: { name, times, reform, shape }. A theme whose file cannot be loaded gets the
// default theme's, so a swap never fails for want of a file.
export async function loadSwapVariant(id) {
  try {
    return (await import('../' + transitionsPath(id))).swapVariant;
  } catch (error) {
    console.error('Could not load the swap of the ' + id + ' theme. The default swap plays.', error);
    return (await import('../' + transitionsPath(defaultSettings.style))).swapVariant;
  }
}

