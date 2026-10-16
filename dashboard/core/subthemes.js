// Subthemes: dated layers of small pictures at fixed places (docs/subthemes.md). These are the
// Subtheme documents of Studio (EVENTS, Subthemes). Nothing here touches the page, so the tests
// can run it. core/subthemes-layer.js draws the result.

import { anchorBox, anchorNames, fitInBox } from './anchors.js';
import { dateIn, zoneNamed } from './theme.js';
import { isRecord } from './text.js';

export const subthemeMotions = ['none', 'drift', 'blink', 'fall'];
const sizeLeast = 40;
const sizeMost = 240;

const themeIds = ['original', 'cybertron', 'retro'];
const viewKeys = ['general', 'prime', 'nova', 'family'];
const dayForm = /^\d{4}-\d{2}-\d{2}$/;

function dayOf(value) {
  return typeof value === 'string' && dayForm.test(value) ? value : '';
}

function tidyRule(raw) {
  if (!isRecord(raw)) return null;
  const slot = typeof raw.slot === 'string' ? raw.slot.trim() : '';
  if (slot === '' || !anchorNames.includes(raw.anchor)) return null;

  const size = Number(raw.size);
  return {
    theme: themeIds.includes(raw.theme) ? raw.theme : '',
    view: viewKeys.includes(raw.view) ? raw.view : '',
    slot: slot,
    anchor: raw.anchor,
    size: isFinite(size) ? Math.min(sizeMost, Math.max(sizeLeast, Math.round(size))) : 80,
    motion: subthemeMotions.includes(raw.motion) ? raw.motion : 'none',
  };
}

// A picture is a slot and either an address or the name of a drawing the screen has (builtin)
function tidyAsset(raw) {
  if (!isRecord(raw)) return null;
  const slot = typeof raw.slot === 'string' ? raw.slot.trim() : '';
  const url = typeof raw.url === 'string' ? raw.url : '';
  const builtin = typeof raw.builtin === 'string' ? raw.builtin : '';
  if (slot === '' || (url === '' && builtin === '')) return null;
  return { slot: slot, url: url, builtin: builtin };
}

export function tidySubthemes(list) {
  return (Array.isArray(list) ? list : [])
    .filter(isRecord)
    .map(raw => ({
      name: typeof raw.name === 'string' ? raw.name : '',
      enabled: raw.enabled !== false,
      start: dayOf(raw.start),
      end: dayOf(raw.end),
      priority: isFinite(Number(raw.priority)) && raw.priority !== null && raw.priority !== '' ? Number(raw.priority) : 0,
      assets: (Array.isArray(raw.assets) ? raw.assets : []).map(tidyAsset).filter(Boolean),
      rules: (Array.isArray(raw.rules) ? raw.rules : []).map(tidyRule).filter(Boolean),
    }));
}

// Live on a day written 2026-12-31: on, and from the first day to the last day, both included
export function isLive(subtheme, day) {
  if (!subtheme || !subtheme.enabled) return false;
  if (subtheme.start !== '' && day < subtheme.start) return false;
  if (subtheme.end !== '' && day > subtheme.end) return false;
  return true;
}

// The one that is drawn: of the live ones the highest priority, and the first in the list when
// they tie. The day is the day in the kiosk time zone.
export function liveSubtheme(list, now, timeZone) {
  const zone = zoneNamed(timeZone);
  const day = dateIn(zone, now);
  let best = null;

  (list || []).forEach(item => {
    if (isLive(item, day) && (best === null || item.priority > best.priority)) best = item;
  });
  return best;
}

// The rules that fit the theme and the view on the screen
export function matchingRules(subtheme, theme, view) {
  if (!subtheme) return [];
  return subtheme.rules.filter(rule => (rule.theme === '' || rule.theme === theme) && (rule.view === '' || rule.view === view));
}

// What to draw: one picture for each place, from the first matching rule that names the place and
// has a picture in its slot. A layout with no anchors draws nothing.
export function spritesFor(subtheme, theme, view, layout) {
  const taken = {};
  const sprites = [];

  matchingRules(subtheme, theme, view).forEach(rule => {
    const asset = subtheme.assets.filter(item => item.slot === rule.slot)[0];
    const place = anchorBox(theme, layout, rule.anchor);
    if (!asset || !place || taken[rule.anchor]) return;

    taken[rule.anchor] = true;
    sprites.push(Object.assign({ anchor: rule.anchor, slot: rule.slot, motion: rule.motion, box: place, asset: asset }, fitInBox(place, rule.size)));
  });
  return sprites;
}
