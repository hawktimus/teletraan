// New content reaches the page that is on screen at once: a panel that stays for half a minute should not show an
// old answer after a publish. The page is built again from the newest content and put in its place only when it reads
// differently, so a change that does not touch this panel leaves it alone. Pages that are arriving, leaving or under a
// swap or a transition are left; they were chosen from the content that was newest then. They are looked at again every
// second for a few seconds, so a publish that lands in the middle of a transition shows as soon as the page rests.

import * as frame from '../frame.js';
import { replaceRestingPage, restingPage } from './areas.js';
import { clockHeld } from './schedule-hold.js';

const regions = ['grid1', 'grid2'];
const retryMilliseconds = 1000;
const retryTimes = 12;

let retriesLeft = 0;
let timer = null;

// What a viewer could tell apart: the words and the pictures
function lookOf(element) {
  const pictures = Array.from(element.querySelectorAll('img, image, use')).map(item => item.getAttribute('src') || item.getAttribute('href') || '');
  return element.textContent + '|' + pictures.join('|');
}

// Draws the page of one region again. Returns false when the region has no page at rest yet.
function refreshRegion(region) {
  const old = restingPage(region);
  if (!old) return false;
  if (typeof old.rebuild !== 'function') return true;

  try {
    const next = old.rebuild();
    if (!next || !next.element || lookOf(next.element) === lookOf(old.element)) return true;

    next.rebuild = old.rebuild;
    next.scrolled = old.scrolled || 0;
    replaceRestingPage(region, next);
    if (next.scrolled > 0) frame.scrollCard(next.element, next.scrolled);
  } catch (error) {
    console.error('The page on screen could not be drawn again, it stays as it is', error);
  }
  return true;
}

function attempt() {
  timer = null;
  const waiting = clockHeld > 0 ? true : regions.map(refreshRegion).includes(false);

  if (waiting && retriesLeft > 0) {
    retriesLeft -= 1;
    timer = setTimeout(attempt, retryMilliseconds);
  }
}

export function refreshPagesInPlace() {
  clearTimeout(timer);
  retriesLeft = retryTimes;
  attempt();
}
