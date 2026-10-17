// The Live preview card of the Now showing tab. It shows a moving picture of the TV when the mirror runs on the
// Teletraan computer (computer/scripts/mirror.py), and falls back to a still copy of the dashboard that follows the
// TV's report when the mirror cannot start.
//
// Nothing loads by itself under 900 px wide: a phone taps Show live preview. Everything stops when the tab changes or
// the page goes to the background.

import { api } from './api.js';
import {
  followFor, framesPerSecond, mirrorFrameWait, mirrorLive, mirrorPictureAddress, mirrorWords,
  previewAutoLoads, previewHeight, previewScale, previewWidth,
} from './render.js';

// How often the still copy asks what the TV shows
const followSeconds = 5;
// How often the mirror tells the computer that someone is looking (it stops after 120 seconds without)
const watchSeconds = 30;
// The wait between two looks at the counter when no new picture is there
const counterMilliseconds = 100;

// Returns a function that removes it and its listeners.
export function wirePreview(root) {
  const box = root.querySelector('[data-preview-box]');
  const toggle = root.querySelector('[data-preview-toggle]');
  const off = root.querySelector('[data-preview-off]');
  const line = root.querySelector('[data-preview-line]');
  const modeLine = root.querySelector('[data-preview-mode]');
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
  let pictureUrl = '';
  let renew = null;
  let drawn = [];

  const fit = () => { if (frame) frame.style.transform = 'scale(' + previewScale(box.clientWidth) + ')'; };
  let watcher = null;
  if (typeof ResizeObserver === 'function') { watcher = new ResizeObserver(fit); watcher.observe(box); }
  else window.addEventListener('resize', fit);

  function draw() {
    off.hidden = Boolean(frame || picture);
    toggle.textContent = active ? 'Hide live preview' : 'Show live preview';
    toggle.setAttribute('aria-pressed', String(active));
  }

  // The still copy: asks for the report and puts the frame where the TV is. The frame is made when the first address is known.
  async function follow(mine) {
    const answer = await api('GET', '/now');
    if (mine !== run) return;
    const next = followFor(answer.ok && answer.data ? answer.data.report : null);
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

  // The mirror: one request in flight at a time. The counter is read, and when it moved the new picture is fetched and
  // swapped in. Before the first picture the loop gives up after the wait and the still copy takes over.
  async function mirrorLoop(mine) {
    const began = Date.now();
    let seen = '';
    let first = false;
    let lastGood = began;
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
        try {
          const answer = await fetch(mirrorPictureAddress(counter), { cache: 'no-store' });
          if (answer.ok) {
            const blob = await answer.blob();
            if (mine !== run) return;
            seen = counter;
            lastGood = Date.now();
            if (!picture) {
              picture = document.createElement('img');
              picture.alt = 'The TV, live';
              picture.draggable = false;
              box.append(picture);
              first = true;
              modeLine.textContent = mirrorLive(0);
              draw();
            }
            const url = URL.createObjectURL(blob);
            picture.src = url;
            if (pictureUrl) URL.revokeObjectURL(pictureUrl);
            pictureUrl = url;
            const now = Date.now();
            drawn.push(now);
            drawn = drawn.filter(time => now - time <= 3000);
            modeLine.textContent = mirrorLive(framesPerSecond(drawn, now));
            continue;
          }
        } catch (error) {
          // a picture that did not arrive is tried again with the next counter
        }
      }
      // No picture at the start, or the counter gone after the service stopped: the still copy takes over
      if (Date.now() - lastGood > mirrorFrameWait && (counter === '' || !first)) {
        startCopy(mirrorWords.failed, mine);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, counterMilliseconds));
    }
  }
  function stopMirror() {
    if (renew !== null) { clearInterval(renew); renew = null; }
    if (picture) { picture.removeAttribute('src'); picture.remove(); picture = null; }
    if (pictureUrl) { URL.revokeObjectURL(pictureUrl); pictureUrl = ''; }
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
