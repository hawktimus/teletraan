// Preview a look: the plain functions. They know nothing about the page, so
// tools/test-effects.mjs can run them. core/preview-run.js hands them the real
// screen.
//
// How it goes (docs/hidden-transitions.md, "Preview a look"):
//   1. Someone clicks "Preview Prime", "Preview Nova", "Preview Cybertron", "Preview
//      Minimal" or "Preview next pack" on Dashboard Settings in the Studio. That writes
//      the kind and the time now into previewRequest and publishes.
//   2. The screen reads the settings with the rest of the content and looks at them
//      every second (makePreviewRunner().look).
//   3. A request starts a preview only if it is less than a minute old and is not the
//      one handled before, the same guard as a demo (shouldRunDemo in core/demo.js).
//      The one handled before is kept in localStorage, so a Mini that restarts never
//      starts it again.
//   4. It waits while an alert, an announcement, a talk, night mode, a demo or a hidden
//      transition has the screen.
//   5. For previewSeconds the screen holds the team, the style or the pack the button
//      names (previewTeam in core/teams.js, previewStyle in core/style.js and previewPack
//      in core/theme.js). Nothing is written to the settings. When the time is up the
//      screen goes back to what they say.
//   6. A style with another layout reloads the page (core/layout.js). The preview that
//      was on is kept in localStorage and goes on after the reload for the time it has
//      left (resumePreview).

import { previewSeconds, styles, teamModes } from '../config.js';
import { overlays } from '../themes/overlays/registry.js';
import { readHandled, rememberHandled, shouldRunDemo } from './demo.js';
import { previewStyle } from './style.js';
import { previewTeam } from './teams.js';
import { isKnownOverlay, previewPack } from './theme.js';

export const handledKey = 'teletraan-preview-handled';
export const activeKey = 'teletraan-preview-active';

// One entry for each button. The key is the id the Studio stores in previewRequest.kind,
// and name is the words after Preview on the button (studio/previews.js has a copy).
// A kind holds one thing: a team mode from teamModes in config.js, a style from styles,
// or the pack after the one on the screen ('next').
export const previewKinds = {
  prime: { name: 'Prime', team: 'prime' },
  nova: { name: 'Nova', team: 'nova' },
  cybertron: { name: 'Cybertron', style: 'cybertron' },
  minimal: { name: 'Minimal', style: 'minimal' },
  'next-pack': { name: 'next pack', pack: 'next' },
};

const nothingHeld = { team: '', style: '', pack: '' };

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isKind(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(previewKinds, id);
}

// The previewRequest of Dashboard Settings, always complete: { kind, requestedAt }.
// A kind the registry does not have, or a time that is not a time, is empty.
export function tidyPreviewRequest(raw) {
  const source = isRecord(raw) ? raw : {};
  const requestedAt = typeof source.requestedAt === 'string' && !isNaN(Date.parse(source.requestedAt)) ? source.requestedAt : '';

  return {
    kind: isKind(source.kind) ? source.kind : '',
    requestedAt: requestedAt,
  };
}

// The handled request, kept under a name of its own in localStorage, apart from the
// demo's, the hidden transitions', the announcements' and the presentation test's
export function readHandledPreview(storage) {
  return readHandled(storage, handledKey);
}

export function rememberHandledPreview(storage, requestedAt) {
  return rememberHandled(storage, requestedAt, handledKey);
}

// The packs a preview can show, in the order of the registry. The placeholder overlay has no
// decorations and is not one. list is only for the tests.
export function previewPacks(list = overlays) {
  return list.filter(overlay => overlay.decorations === true).map(overlay => overlay.id);
}

// The pack after the one on the screen, in the order of the registry. With none on the screen,
// or one that is not a pack, it is the first, and after the last it is the first again.
export function nextPack(current, list) {
  const packs = previewPacks(list);
  if (packs.length === 0) return '';

  return packs[(packs.indexOf(current) + 1) % packs.length];
}

// What a kind holds on the screen: { team, style, pack }, with one filled in and the others
// empty. current is the pack on the screen now. A kind that is not one holds nothing.
export function heldBy(kind, current) {
  const entry = isKind(kind) ? previewKinds[kind] : {};

  return {
    team: entry.team || '',
    style: entry.style || '',
    pack: entry.pack === 'next' ? nextPack(current) : '',
  };
}

function holdsNothing(held) {
  return held.team === '' && held.style === '' && held.pack === '';
}

// Each of the three keeps what it is given until the time, and an empty name lets go
function hold(held, until) {
  previewTeam(held.team, until);
  previewStyle(held.style, until);
  previewPack(held.pack, until);
}

// The preview that is on, kept in localStorage so that a reload does not lose it. It is
// { until, held } with until in milliseconds, or null when there is none or it is not usable.
function readActive(storage) {
  try {
    const saved = JSON.parse(storage.getItem(activeKey));
    if (!isRecord(saved) || typeof saved.until !== 'number' || !isFinite(saved.until) || !isRecord(saved.held)) return null;

    const held = saved.held;
    const team = typeof held.team === 'string' && teamModes.indexOf(held.team) !== -1 ? held.team : '';
    const style = typeof held.style === 'string' && styles.indexOf(held.style) !== -1 ? held.style : '';
    const pack = isKnownOverlay(held.pack) ? held.pack : '';
    return { until: saved.until, held: { team: team, style: style, pack: pack } };
  } catch (error) {
    return null;
  }
}

function writeActive(storage, active) {
  try {
    storage.setItem(activeKey, JSON.stringify(active));
  } catch (error) {
    // the preview still runs from memory, and a reload loses it
  }
}

function forgetActive(storage) {
  try {
    storage.removeItem(activeKey);
  } catch (error) {
    // nothing was written, so there is nothing to forget
  }
}

// Puts a preview back that was on when the page reloaded, for the time it has left. It is
// called before the style and the layout are chosen. Returns the preview, or null. now is a Date.
export function resumePreview(storage, now = new Date()) {
  const saved = readActive(storage);
  if (saved === null) return null;

  if (saved.until <= now.getTime()) {
    forgetActive(storage);
    return null;
  }

  hold(saved.held, saved.until);
  return saved;
}

// The runner. deps is what it needs from the page, so that the tests can give it fakes:
//   getContent()        the newest content
//   storage             localStorage, or null when the browser has none
//   takeoverRunning()   true while an alert, an announcement or a talk covers the screen
//   demoRunning()       true while a demo plays
//   nightIsUp()         true while the night screen is up
//   hiddenPlaying()     true while a hidden transition plays
//   packOnScreen()      the id of the pack on the screen now, or ''
//   lookAgain(held)     asks the page to work out its look again, after a preview starts or ends
// Call look(now) once a second.
export function makePreviewRunner(deps) {
  // Read once and then kept here as well, so that a storage that fails still stops
  // the same request from starting twice while the page is open
  let handled = readHandledPreview(deps.storage);
  let active = readActive(deps.storage); // { until, held }, or null

  function busy() {
    return deps.takeoverRunning() || deps.demoRunning() || deps.nightIsUp() || deps.hiddenPlaying();
  }

  function start(kind, now) {
    const held = heldBy(kind, deps.packOnScreen());
    if (holdsNothing(held)) return;

    active = { until: now.getTime() + previewSeconds * 1000, held: held };
    hold(held, active.until);
    writeActive(deps.storage, active);
    deps.lookAgain(held);
  }

  function finish() {
    const held = active.held;

    active = null;
    hold(nothingHeld, 0);
    forgetActive(deps.storage);
    deps.lookAgain(held);
  }

  function look(now) {
    if (active && now.getTime() >= active.until) finish();

    const content = deps.getContent();
    if (!content || !content.settings) return;
    const request = tidyPreviewRequest(content.settings.previewRequest);

    if (request.kind === '' || !shouldRunDemo(request.requestedAt, handled, now)) return;
    if (busy()) return;

    handled = request.requestedAt;
    rememberHandledPreview(deps.storage, handled);
    start(request.kind, now);
  }

  return {
    look: look,
    isActive: () => active !== null,
  };
}
