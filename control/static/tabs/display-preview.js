// The pictures of a row in the Display tab: one large live picture of the selected row, and a small live picture on the rows
// (docs/control-page.md, "Pictures of a row"). A picture is the real dashboard in a frame at 1920 by 1080, shrunk with a
// transform, drawn with ?rowpreview= so it holds one row, still, and only reads (dashboard/core/row-preview.js). The frames
// load from this same server, in the browser of the person who opened the page, never on the TV.
//
// The cost is kept down on purpose: a small picture is made only when its slot is on screen, at most six are live (a frame
// that leaves the screen is reused for the next row), everything is dropped while the tab is hidden, and a phone has a small
// picture for the selected row only.

import { api } from './api.js';
import {
  chooseLive, hasPicture, isKioskHost, isPhone, mostThumbs, nowLine, nowSeconds, pictureAddress, readSwitch, sandbox, scaleFor,
  thumbsWanted, words, writeSwitch,
} from '../display-preview.js';
import { chipHtml } from './display-parts.js';
import { esc } from './render.js';

function makeFrame(title, small) {
  const frame = document.createElement('iframe');
  frame.title = title;
  frame.setAttribute('sandbox', sandbox);
  frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.tabIndex = -1;
  frame.width = 1920;
  frame.height = 1080;
  frame.className = small ? 'thumb-frame' : 'large-frame';
  if (small) frame.setAttribute('aria-hidden', 'true');
  return frame;
}

// getPage() gives { rows, checks, choices }. titles maps a panel id to its title. Returns the controls of the pictures.
export function startPictures(root, getPage, titlesOf) {
  const card = root.querySelector('[data-preview-card]');
  const rowsBox = root.querySelector('[data-rows]');
  const stage = card.querySelector('[data-large-stage]');
  const box = card.querySelector('[data-large-box]');
  const empty = card.querySelector('[data-large-empty]');
  const titleLine = card.querySelector('[data-large-title]');
  const reasonLine = card.querySelector('[data-large-reason]');
  const nowElement = card.querySelector('[data-large-now]');
  const kioskNote = card.querySelector('[data-kiosk-note]');
  const hereButton = card.querySelector('[data-action="preview-here"]');
  const thumbSwitch = card.querySelector('[data-thumb-switch]');
  const helpLine = card.querySelector('[data-thumb-help]');

  const kiosk = isKioskHost(new URL(document.baseURI).hostname);
  const width = () => Math.min(window.innerWidth, window.screen && window.screen.width ? window.screen.width : window.innerWidth);
  let thumbsOn = thumbsWanted(readSwitch(window.localStorage), width(), kiosk);
  let drawHere = !kiosk; // the kiosk draws the large picture only when asked
  let selected = '';
  let gone = false;
  let paused = document.hidden;
  let largeFrame = null;
  let largeAddress = '';
  let largeTimer = null;
  let nowTimer = null;
  let lastReport = null;

  const free = []; // frames that were used and are waiting for another row
  const live = new Map(); // row key to its small frame
  const visible = new Set(); // the small slots that are on screen
  const watched = new Set(); // the small slots the observer has
  let observer = null;
  const phone = () => isPhone(width());

  function rowOf(key) {
    return getPage().rows.find(row => row._key === key) || null;
  }

  // ----- the large picture -----

  function fitLarge() {
    if (largeFrame) largeFrame.style.transform = 'scale(' + scaleFor(stage.clientWidth) + ')';
  }

  function dropLarge() {
    clearTimeout(largeTimer);
    if (largeFrame) {
      largeFrame.src = 'about:blank';
      largeFrame.remove();
      largeFrame = null;
    }
    largeAddress = '';
  }

  function showLarge(address) {
    if (address === largeAddress && largeFrame) return;
    largeAddress = address;
    if (!largeFrame) {
      largeFrame = makeFrame('The dashboard drawn with the settings of the selected row', false);
      stage.append(largeFrame);
      fitLarge();
    }
    largeFrame.src = address;
  }

  function reasonHtml(row, check) {
    const state = check ? check.state : row.shown === false ? 'off' : 'unknown';
    return chipHtml(check, row) + ' <span data-state="' + esc(state) + '">' + esc(check ? check.reason : 'Checking what the wall would do.') + '</span>';
  }

  // Redraws the lines and, when the settings of the row changed, the frame
  function syncLarge() {
    if (gone) return;
    const page = getPage();
    const row = rowOf(selected) || page.rows[0] || null;
    if (row && row._key !== selected) selected = row._key;
    markSelected();

    const titles = titlesOf(page.choices);
    const number = row ? page.rows.indexOf(row) + 1 : 0;
    titleLine.textContent = row ? 'Row ' + number + ': ' + (titles[row.panel] || row.panel || 'Panel not chosen') + ', view ' + row.view + '.' : 'Pick a row to see it.';
    reasonLine.hidden = !row;
    if (row) reasonLine.innerHTML = reasonHtml(row, page.checks[row._key]);

    kioskNote.hidden = !kiosk;
    hereButton.hidden = !kiosk || drawHere;

    let message = '';
    if (!row) message = words.nothing;
    else if (!row.panel) message = words.noPanel;
    else if (!hasPicture(row, titles)) message = words.retired;
    else if (!drawHere) message = words.kiosk;
    else if (paused) message = words.hidden;
    empty.textContent = message;
    box.dataset.state = message === '' ? 'picture' : 'message';

    if (message !== '' || !row) {
      dropLarge();
      return;
    }
    // A short wait, so that a burst of changes loads the frame once
    clearTimeout(largeTimer);
    const address = pictureAddress(row);
    if (address === largeAddress && largeFrame) return;
    largeTimer = setTimeout(() => { if (!gone && !paused) showLarge(address); }, 200);
  }

  // ----- the small pictures -----

  function markSelected() {
    rowsBox.querySelectorAll('.drow').forEach(item => {
      if (item.dataset.key === selected) item.dataset.selected = 'yes';
      else delete item.dataset.selected;
    });
  }

  function releaseThumb(key) {
    const frame = live.get(key);
    if (!frame) return;
    live.delete(key);
    frame.src = 'about:blank';
    frame.dataset.address = '';
    frame.remove();
    free.push(frame);
  }

  function slotOf(key) {
    const item = rowsBox.querySelector('.drow[data-key="' + key + '"]');
    return item ? item.querySelector('.thumb') : null;
  }

  // Gives a small frame to the rows that should have one, and takes it from the rest
  function syncThumbs() {
    if (gone) return;
    const page = getPage();
    const titles = titlesOf(page.choices);
    rowsBox.dataset.thumbs = thumbsOn ? 'on' : 'off';

    const order = Array.from(rowsBox.querySelectorAll('.drow')).filter(item => visible.has(item.querySelector('.thumb'))).map(item => item.dataset.key);
    const wanted = thumbsOn && !paused ? chooseLive(order, selected, mostThumbs, phone()) : [];

    Array.from(live.keys()).filter(key => !wanted.includes(key) || !slotOf(key)).forEach(releaseThumb);
    wanted.forEach(key => {
      const row = rowOf(key);
      const slot = slotOf(key);
      if (!row || !slot) return;
      const address = hasPicture(row, titles) ? pictureAddress(row) : '';
      let frame = live.get(key);
      if (address === '') {
        if (frame) releaseThumb(key);
        return;
      }
      if (!frame) {
        frame = free.pop() || makeFrame('Small picture of a row', true);
        live.set(key, frame);
      }
      if (frame.parentElement !== slot) slot.append(frame);
      if (frame.dataset.address !== address) {
        frame.dataset.address = address;
        frame.src = address;
      }
    });
    helpLine.textContent = kiosk ? 'Off on the Teletraan computer.' : thumbsOn
      ? (phone() ? 'A small live picture on the selected row.' : 'A small live picture on each row, at most ' + mostThumbs + ' at a time (' + live.size + ' now).')
      : 'No small pictures.';
  }

  function watchSlots() {
    if (!observer) return;
    const now = new Set(Array.from(rowsBox.querySelectorAll('.thumb')));
    watched.forEach(slot => { if (!now.has(slot)) { observer.unobserve(slot); watched.delete(slot); visible.delete(slot); } });
    now.forEach(slot => { if (!watched.has(slot)) { observer.observe(slot); watched.add(slot); } });
  }

  // ----- what the TV shows now -----

  async function askNow() {
    if (gone || paused) return;
    const answer = await api('GET', '/now');
    if (gone) return;
    lastReport = answer.ok && answer.data && answer.data.report && !answer.data.quiet ? answer.data.report : null;
    nowElement.textContent = nowLine(lastReport);
  }

  // ----- the page tells what changed -----

  function select(key) {
    if (!key || key === selected || !rowOf(key)) return;
    selected = key;
    syncLarge();
    syncThumbs();
  }

  function onSelect(event) {
    const item = event.target.closest && event.target.closest('.drow');
    if (item) select(item.dataset.key);
  }

  function onClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    if (button.dataset.action === 'preview-here') {
      drawHere = true;
      syncLarge();
    } else if (button.dataset.action === 'to-preview') {
      card.scrollIntoView({ block: 'start' });
    }
  }

  function onSwitch() {
    thumbsOn = thumbSwitch.checked;
    writeSwitch(window.localStorage, thumbsOn);
    syncThumbs();
  }

  function onVisibility() {
    paused = document.hidden;
    if (paused) {
      clearTimeout(largeTimer);
      Array.from(live.keys()).forEach(releaseThumb);
      dropLarge();
      syncLarge();
    } else {
      syncLarge();
      syncThumbs();
      askNow();
    }
  }

  if (typeof IntersectionObserver === 'function') {
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) visible.add(entry.target); else visible.delete(entry.target); });
      syncThumbs();
    }, { rootMargin: '200px 0px' });
  }
  let sizeWatcher = null;
  if (typeof ResizeObserver === 'function') { sizeWatcher = new ResizeObserver(fitLarge); sizeWatcher.observe(stage); }

  thumbSwitch.checked = thumbsOn;
  thumbSwitch.disabled = kiosk;
  rowsBox.addEventListener('focusin', onSelect);
  rowsBox.addEventListener('click', onSelect);
  card.addEventListener('click', onClick);
  rowsBox.addEventListener('click', onClick);
  thumbSwitch.addEventListener('change', onSwitch);
  document.addEventListener('visibilitychange', onVisibility);
  nowTimer = setInterval(askNow, nowSeconds * 1000);
  askNow();

  return {
    // After the rows were drawn or patched
    rowsPainted() {
      watchSlots();
      syncLarge();
      syncThumbs();
    },
    // After the check of the wall came back: only the lines change
    checksChanged() {
      syncLarge();
    },
    select: select,
    selected: () => selected,
    liveCount: () => live.size,
    destroy() {
      gone = true;
      clearTimeout(largeTimer);
      clearInterval(nowTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      rowsBox.removeEventListener('focusin', onSelect);
      rowsBox.removeEventListener('click', onSelect);
      rowsBox.removeEventListener('click', onClick);
      card.removeEventListener('click', onClick);
      if (observer) observer.disconnect();
      if (sizeWatcher) sizeWatcher.disconnect();
      Array.from(live.keys()).forEach(releaseThumb);
      dropLarge();
    },
  };
}
