// The Live preview card of the Status tab. It shows a moving picture of the TV when the mirror runs on the
// Teletraan computer (computer/scripts/mirror.py), and falls back to a still copy of the dashboard that follows the
// TV's report when the mirror cannot start.
//
// Nothing loads by itself under 900 px wide: a phone taps Show live preview. Everything stops when the tab changes or
// the page goes to the background.

import { api } from './api.js';
import {
  followFor, framesPerSecond, mirrorFrameWait, mirrorLive, mirrorPictureAddress, mirrorWords, pictureErrorLine, pictureFacts,
  previewAutoLoads, previewHeight, previewScale, previewWidth, wallReport,
} from './render.js';

// How often the still copy asks what the TV shows
const followSeconds = 5;
// How often the mirror tells the computer that someone is looking (it stops after 120 seconds without)
const watchSeconds = 30;
// The wait between two looks at the counter when no new picture is there
const counterMilliseconds = 100;
// How often the page asks the computer how the pictures are made (screencast, screenshots or black)
const stateSeconds = 5;

// Returns a function that removes it and its listeners.
export function wirePreview(root) {
  const box = root.querySelector('[data-preview-box]');
  const toggle = root.querySelector('[data-preview-toggle]');
  const off = root.querySelector('[data-preview-off]');
  const line = root.querySelector('[data-preview-line]');
  const followNote = root.querySelector('[data-preview-follow-note]');
  const modeLine = root.querySelector('[data-preview-mode]');
  const factsLine = root.querySelector('[data-preview-facts]');
  const errorLine = root.querySelector('[data-preview-error]');
  const openLink = root.querySelector('[data-preview-open]');
  const blackBox = root.querySelector('[data-preview-black]');
  // screen.width keeps a phone narrow even when a wide page makes the browser widen its layout
  const wide = () => previewAutoLoads(Math.min(window.innerWidth, window.screen && window.screen.width ? window.screen.width : window.innerWidth));
  let wanted = wide();
  let active = false;
  let run = 0; // a new number for each start, so an answer that arrives after a stop is ignored

  // The still copy
  let frame = null;
  let timer = null;
  let held = '';
  // The mirror
  let picture = null;
  let renew = null;
  let drawn = [];
  let pictureMode = 'screencast';
  let black = false;
  let stateTimer = null;

  const fit = () => { if (frame) frame.style.transform = 'scale(' + previewScale(box.clientWidth) + ')'; };
  let watcher = null;
  if (typeof ResizeObserver === 'function') { watcher = new ResizeObserver(fit); watcher.observe(box); }
  else window.addEventListener('resize', fit);

  // The line under the box for the mirror: the way the pictures are made and the rate, or the black message
  function mirrorLine(fps) {
    blackBox.hidden = !black;
    modeLine.textContent = black ? mirrorWords.black : mirrorLive(fps, pictureMode);
  }
  async function askState(mine) {
    const answer = await api('GET', '/mirror/status');
    if (mine !== run || !answer.ok || !answer.data || !answer.data.picture) return;
    pictureMode = answer.data.picture.mode;
    black = answer.data.picture.state === 'black';
    mirrorLine(framesPerSecond(drawn, Date.now()));
  }

  function draw() {
    off.hidden = Boolean(frame || picture);
    root.dataset.on = active ? 'yes' : 'no';
    toggle.textContent = active ? 'Hide live preview' : 'Show live preview';
    toggle.setAttribute('aria-pressed', String(active));
  }

  // The still copy: asks for the report and puts the frame where the TV is. The frame is made when the first address is known.
  async function follow(mine) {
    const answer = await api('GET', '/now');
    if (mine !== run) return;
    const next = followFor(wallReport(answer.ok ? answer.data : null));
    line.hidden = false;
    followNote.hidden = false;
    line.textContent = next.line;
    off.textContent = next.src === '' ? 'The TV has not reported yet' : 'The preview is off.';
    if (next.src === '' || next.src === held) return;
    held = next.src;
    if (!frame) {
      frame = document.createElement('iframe');
      frame.title = 'A copy of the dashboard that follows the TV';
      frame.width = previewWidth;
      frame.height = previewHeight;
      frame.loading = 'lazy';
      frame.tabIndex = -1;
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      box.append(frame);
      fit();
    }
    frame.src = held;
    draw();
  }
  function startCopy(note, mine) {
    stopMirror();
    modeLine.textContent = note;
    timer = setInterval(() => follow(mine), followSeconds * 1000);
    follow(mine);
  }

  // Loads one picture the way the page shows it, and gives the image when the browser could draw it
  function loadPicture(address) {
    return new Promise(resolve => {
      const test = new Image();
      test.onload = () => resolve(test.naturalWidth > 0 ? test : null);
      test.onerror = () => resolve(null);
      test.src = address;
    });
  }
  function sizeOf(address) {
    try {
      const found = performance.getEntriesByName(new URL(address, document.baseURI).href);
      const last = found[found.length - 1];
      return last ? (last.encodedBodySize || last.decodedBodySize || 0) : 0;
    } catch (error) {
      return 0;
    }
  }
  async function showError(address) {
    let status = 0;
    try { status = (await fetch(address, { method: 'HEAD', cache: 'no-store' })).status; } catch (error) { status = 0; }
    errorLine.textContent = pictureErrorLine(status);
    errorLine.hidden = false;
    openLink.hidden = false;
  }

  // The mirror: one request in flight at a time. The counter is read, and when it moved the new picture is loaded and
  // swapped in. Only a picture that the browser loaded counts as a frame shown. Before the first picture the loop gives
  // up after the wait and the still copy takes over, unless the pictures fail to load, which is told in red.
  async function mirrorLoop(mine) {
    const began = Date.now();
    let seen = '';
    let first = false;
    let lastGood = began;
    let failing = false;
    let lastError = 0;
    while (mine === run) {
      let counter = '';
      try {
        const answer = await fetch('/mirror/frame.n', { cache: 'no-store' });
        counter = answer.ok ? (await answer.text()).trim() : '';
      } catch (error) {
        counter = '';
      }
      if (mine !== run) return;
      if (counter !== '' && counter !== seen) {
        const address = mirrorPictureAddress(counter);
        const loaded = await loadPicture(address);
        if (mine !== run) return;
        seen = counter;
        if (loaded) {
          failing = false;
          errorLine.hidden = true;
          openLink.hidden = true;
          lastGood = Date.now();
          loaded.alt = 'The TV, live';
          loaded.draggable = false;
          box.append(loaded);
          if (picture) picture.remove();
          picture = loaded;
          if (!first) { first = true; mirrorLine(0); draw(); }
          factsLine.textContent = pictureFacts(sizeOf(address), loaded.naturalWidth, loaded.naturalHeight);
          const now = Date.now();
          drawn.push(now);
          drawn = drawn.filter(time => now - time <= 3000);
          mirrorLine(framesPerSecond(drawn, now));
          continue;
        }
        // Asked again every 5 seconds, so the sentence follows a change (403 after 404) and the rate falls to 0
        if (!failing || Date.now() - lastError > 5000) {
          failing = true;
          lastError = Date.now();
          drawn = [];
          mirrorLine(0);
          await showError(address);
          if (mine !== run) return;
        }
      }
      // No picture at the start, or the counter gone after the service stopped: the still copy takes over
      if (!failing && Date.now() - lastGood > mirrorFrameWait && (counter === '' || !first)) {
        startCopy(mirrorWords.failed, mine);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, counterMilliseconds));
    }
  }
  function stopMirror() {
    line.hidden = true;
    followNote.hidden = true;
    if (renew !== null) { clearInterval(renew); renew = null; }
    if (stateTimer !== null) { clearInterval(stateTimer); stateTimer = null; }
    black = false;
    pictureMode = 'screencast';
    blackBox.hidden = true;
    errorLine.hidden = true;
    openLink.hidden = true;
    factsLine.textContent = '';
    if (picture) { picture.removeAttribute('src'); picture.remove(); picture = null; }
    drawn = [];
  }

  async function begin(mine) {
    modeLine.textContent = mirrorWords.waiting;
    const answer = await api('POST', '/mirror/watch', {});
    if (mine !== run) return;
    const state = answer.ok && answer.data ? answer.data.state : '';
    if (state === 'no-python3') { startCopy(mirrorWords.noPython, mine); return; }
    if (!answer.ok) { startCopy(mirrorWords.failed, mine); return; }
    renew = setInterval(() => { if (!document.hidden) api('POST', '/mirror/watch', {}); }, watchSeconds * 1000);
    stateTimer = setInterval(() => { if (!document.hidden) askState(mine); }, stateSeconds * 1000);
    mirrorLoop(mine);
  }

  function load() {
    if (active) return;
    active = true;
    run += 1;
    draw();
    begin(run);
  }
  function unload() {
    active = false;
    run += 1; // answers that are still on their way are ignored
    if (timer !== null) { clearInterval(timer); timer = null; }
    stopMirror();
    if (frame) { frame.removeAttribute('src'); frame.remove(); frame = null; }
    held = '';
    modeLine.textContent = '';
    off.textContent = 'The preview is off.';
    draw();
  }

  toggle.addEventListener('click', () => {
    wanted = !active;
    if (wanted) load(); else unload();
  });
  // A phone asks again after the page was in the background; a wide screen brings the preview back by itself
  const visibility = () => {
    if (document.hidden) {
      unload();
      if (!wide()) wanted = false;
    } else if (wanted) load();
  };
  document.addEventListener('visibilitychange', visibility);

  if (wanted) load(); else unload();

  return () => {
    unload();
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('resize', fit);
    if (watcher) watcher.disconnect();
  };
}
