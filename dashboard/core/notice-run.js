// Draws the announcement bar (core/notice.js says which announcement is up, docs/announcements.md says what it
// is for). It is the plate under the banner, #notice in index.html. It is not the full-screen announcement of
// "Play announcements" (core/announce-run.js, core/takeover.js).
//
// While one announcement is live for the team on the banner, the bar is up and the panels under the banner are
// made smaller by the height of the bar, so that nothing is covered. The bar lies under #talk, #overlay and
// #night in index.html, so a presentation, an alert and the night screen cover it. The panels move back when the
// last announcement ends.

import * as frame from '../frame.js';
import { liveNotices, noticeGap, noticeHeight, noticeShrinkMs, noticeUp, sizeFor } from './notice.js';
import { currentTeam } from './teams.js';
import { escapeHtml } from './text.js';

const sidePadding = 32;

const state = { shown: '', moved: [], layout: '' };

function addressHas(name) {
  try {
    return new URLSearchParams(window.location.search).has(name);
  } catch (error) {
    return false;
  }
}

// The panels under the banner that give up room: the large panel, and in the standard layout the right column
function targets() {
  const list = Array.from(document.querySelectorAll('.area[data-area="grid1"]'));
  const right = document.getElementById('region-right');
  if (right && getComputedStyle(right).display !== 'none') list.push(right);
  return list;
}

function box(element, worldRect, worldScale) {
  const rect = element.getBoundingClientRect();
  return {
    left: (rect.left - worldRect.left) / worldScale,
    top: (rect.top - worldRect.top) / worldScale,
    width: rect.width / worldScale,
    height: rect.height / worldScale,
  };
}

// Where each panel goes so that it ends where it did and is the height of the bar less tall, kept in the middle
// of the room it had. The scale is taken about the transform origin of the element, which is why the move is
// worked out from the origin and the size the layout gives it (see frame.moveArea).
function movesFor(elements, worldRect, worldScale) {
  return elements.map(element => {
    const seen = box(element, worldRect, worldScale);
    const origin = getComputedStyle(element).transformOrigin.split(' ').map(parseFloat);
    const grown = element.offsetHeight > 0 ? seen.height / element.offsetHeight : 1;
    const scale = (seen.height - noticeHeight) / seen.height;
    const x = (seen.width / 2 - (origin[0] || 0) * grown) * (1 - scale);
    const y = (seen.height - (origin[1] || 0) * grown) * (1 - scale);

    return { element: element, seen: seen, to: { scale: scale, x: x, y: y } };
  });
}

function clearMoves() {
  state.moved.forEach(item => frame.moveArea(item.element, { scale: 1, x: 0, y: 0 }, noticeShrinkMs));
  state.moved = [];
}

// Puts the bar in place and makes room. The panels are put back to their size for a moment, unseen, to be measured.
function makeRoom(bar) {
  const world = document.getElementById('world');
  const elements = targets();
  if (!world || elements.length === 0) return false;

  elements.forEach(element => {
    element.style.scale = '';
    element.style.translate = '';
  });
  const worldRect = world.getBoundingClientRect();
  const worldScale = worldRect.width / 1920 || 1;
  const moves = movesFor(elements, worldRect, worldScale);

  const standard = document.documentElement.dataset.layout === 'standard';
  const main = moves[0].seen;
  const ticker = document.getElementById('region-ticker');
  const wide = standard && ticker ? box(ticker, worldRect, worldScale) : main;
  const strip = document.getElementById('region-strip');
  const banner = strip && !strip.hidden ? strip : document.getElementById('region-banner');
  const bannerBottom = banner ? box(banner, worldRect, worldScale).top + box(banner, worldRect, worldScale).height : 0;

  bar.style.left = Math.round(wide.left) + 'px';
  bar.style.width = Math.round(wide.width) + 'px';
  bar.style.top = Math.round(Math.max(main.top - noticeGap, bannerBottom)) + 'px';

  moves.forEach(item => frame.moveArea(item.element, item.to, noticeShrinkMs));
  state.moved = moves;
  state.layout = document.documentElement.dataset.layout || '';
  return true;
}

function fill(bar, notice) {
  const room = bar.clientWidth > 0 ? bar.clientWidth - sidePadding * 2 : 1760;
  bar.dataset.level = notice.level;
  bar.innerHTML = '<span class="notice-text" style="font-size: ' + sizeFor(notice.text, room) + 'px">' + escapeHtml(notice.text) + '</span>';
}

async function hiddenIsPlaying() {
  try {
    return (await import('./hidden-run.js')).hiddenPlaying();
  } catch (error) {
    return false;
  }
}

// Called once a second with the content. Does something only when the announcement that is up changes.
async function lookAtNotices(getContent, now = new Date()) {
  const bar = document.getElementById('notice');
  const content = getContent();
  if (!bar || !content) return;

  const live = liveNotices(content.notices, now, currentTeam().code, addressHas('notice'));
  const up = noticeUp(live, now);
  const key = up ? up.id + '|' + up.text + '|' + up.level : '';

  // The layout changed under an announcement that is up: measure again
  const layoutChanged = key !== '' && state.shown === key && state.layout !== (document.documentElement.dataset.layout || '');
  if (key === state.shown && !layoutChanged) return;
  if (key !== '' && (await hiddenIsPlaying())) return;

  if (key === '') {
    state.shown = '';
    clearMoves();
    frame.fadeNotice(bar, 0, noticeShrinkMs, () => {
      bar.hidden = true;
    });
    return;
  }

  const wasUp = state.shown !== '';
  state.shown = key;
  if (!wasUp || layoutChanged) {
    bar.hidden = false;
    bar.style.opacity = '0';
    if (!makeRoom(bar)) {
      state.shown = '';
      bar.hidden = true;
      return;
    }
    fill(bar, up);
    frame.fadeNotice(bar, 1, noticeShrinkMs);
    return;
  }

  // One gives way to the other in the same place
  frame.fadeNotice(bar, 1, noticeShrinkMs, () => fill(bar, up));
}

export function startNoticeRunner(getContent) {
  frame.onSecond(() => {
    lookAtNotices(getContent).catch(error => console.error('The announcement bar could not be drawn', error));
  });
}
