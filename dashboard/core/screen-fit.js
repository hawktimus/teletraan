// How the 1920 by 1080 canvas sits in the browser window (docs/layouts.md, "Fit the screen").
//
// Dashboard Settings, Advanced, Screen fit has four settings:
//   screenFit      auto (the whole canvas fits inside the window, centred), fill (the canvas covers the window and the
//                  overflow is cropped), contain (the same as auto, never snapped to 100 percent) or exact (no scaling)
//   screenScale    percent, an extra multiplier on top of the fit (95 pulls the picture in from a TV that crops its edges)
//   screenOffsetX  pixels of the window, moves the canvas right (negative is left)
//   screenOffsetY  pixels of the window, moves the canvas down (negative is up)
// The address wins over the settings: ?screenfit=, ?screenscale=, ?screenx= and ?screeny=.
//
// The page never reflows. One transform scales the canvas and two margins place it, as they always did.

import { screenFits } from '../config.js';

export const canvasWidth = 1920;
export const canvasHeight = 1080;

// A window within this share of exactly 100 percent is drawn at 1 (1925 by 1083 is not scaled)
const snapShare = 0.01;

// Where the canvas goes in a window. width and height are the window; the rest are the settings, in their own units.
// Returns the scale, the left and top of the canvas in window pixels, and unusedPercent: the share of the window that the
// canvas does not cover (bars when it is too small, 0 when it covers everything, also when it overflows).
export function fitFor({ width, height, fit = 'auto', scale = 100, offsetX = 0, offsetY = 0 }) {
  const across = width / canvasWidth;
  const down = height / canvasHeight;
  let base = Math.min(across, down);

  if (fit === 'fill') base = Math.max(across, down);
  if (fit === 'exact') base = 1;
  if (fit === 'auto' && Math.abs(base - 1) < snapShare) base = 1;

  const drawn = base * (scale / 100);
  const left = (width - canvasWidth * drawn) / 2 + offsetX;
  const top = (height - canvasHeight * drawn) / 2 + offsetY;

  // The part of the canvas that is inside the window
  const seenWidth = Math.max(0, Math.min(width, left + canvasWidth * drawn) - Math.max(0, left));
  const seenHeight = Math.max(0, Math.min(height, top + canvasHeight * drawn) - Math.max(0, top));
  const unused = width > 0 && height > 0 ? 100 * (1 - (seenWidth * seenHeight) / (width * height)) : 0;

  return { scale: drawn, left: left, top: top, unusedPercent: Math.round(unused * 10) / 10 };
}

// The settings in use now: the content's, then the address on top of them
const current = { fit: 'auto', scale: 100, offsetX: 0, offsetY: 0 };
const address = { fit: undefined, scale: null, offsetX: null, offsetY: null };

function number(text) {
  const value = Number(text);
  return text !== null && text !== '' && isFinite(value) ? value : null;
}

function numberOf(asked, saved, fallback) {
  if (asked !== null) return asked;
  return typeof saved === 'number' && isFinite(saved) ? saved : fallback;
}

// Called once at the start with the address, and with the settings of the content each time it is built
// (shell-content.js, rebuild). Applies at once, with no reload.
export function useScreenFit(settings, params) {
  const given = settings || {};

  if (params) {
    address.fit = screenFits.includes(params.get('screenfit')) ? params.get('screenfit') : undefined;
    address.scale = number(params.get('screenscale'));
    address.offsetX = number(params.get('screenx'));
    address.offsetY = number(params.get('screeny'));
  }
  current.fit = address.fit || (screenFits.includes(given.screenFit) ? given.screenFit : 'auto');
  current.scale = numberOf(address.scale, given.screenScale, 100);
  current.offsetX = numberOf(address.offsetX, given.screenOffsetX, 0);
  current.offsetY = numberOf(address.offsetY, given.screenOffsetY, 0);
  fitToScreen();
}

let lastFit = null;

// What the report to the control page holds: the window, the pixel ratio, the display the browser sees, the fit in use and
// the share of the window the canvas leaves unused
export function fitReport() {
  if (typeof window === 'undefined') return null;

  const fit = lastFit || fitFor({ width: window.innerWidth, height: window.innerHeight });
  return {
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    pixelRatio: window.devicePixelRatio || 1,
    displayWidth: window.screen ? window.screen.width : 0,
    displayHeight: window.screen ? window.screen.height : 0,
    fit: current.fit,
    scale: Math.round(fit.scale * 1000) / 1000,
    percent: current.scale,
    offsetX: current.offsetX,
    offsetY: current.offsetY,
    unusedPercent: fit.unusedPercent,
  };
}

// Draws the canvas for the window as it is now, with the settings in use
export function fitToScreen() {
  const screen = document.getElementById('screen');
  if (!screen) return;

  lastFit = fitFor({ width: window.innerWidth, height: window.innerHeight, fit: current.fit, scale: current.scale, offsetX: current.offsetX, offsetY: current.offsetY });
  if (lastFit.scale === 1 && lastFit.left === 0 && lastFit.top === 0) {
    screen.style.transform = '';
    screen.style.marginLeft = '';
    screen.style.marginTop = '';
    return;
  }

  screen.style.transform = 'scale(' + lastFit.scale + ')';
  screen.style.marginLeft = lastFit.left + 'px';
  screen.style.marginTop = lastFit.top + 'px';
}
