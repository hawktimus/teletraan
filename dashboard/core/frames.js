// Whether the screen is actually painting, and how fast its refresh is.
//
// Everything else on this page proves that the clock is running: a setInterval fires, a timer writes the title, the
// rotation counts its 250 ms ticks. None of that proves a single pixel has changed. When the TV is switched off or to
// another input, or the graphics chip gives up, Chromium keeps the timers running and stops painting. That is the
// frozen half-drawn screen: a transition that started, no frame to finish it, and a heartbeat still saying all is well.
//
// So this file asks the browser for a frame now and then and writes down when one arrived.
//   lastFrameAt    when a frame was last painted
//   refreshMs      how far apart two frames of this screen are, measured, not assumed
//   a stall        frames stopped for longer than stallSeconds and then came back
//
// The probe asks for two frames in a row every two seconds. Two in a row is what gives the refresh interval; asking at
// every refresh instead would keep the screen drawing all day for no other reason (docs/performance.md). On the 4K 30 Hz
// output of the TV in the lab that is 33.3 ms, not the 16.7 ms a page is usually written for, which is why nothing here
// takes 60 Hz for granted.
//
// core/heartbeat.js will not write a healthy title unless a frame arrived recently, so the watchdog on the computer
// restarts a page that has stopped painting. core/recover.js listens for a stall and puts the page right.
// computer/scripts/page-command.py reads window.__teletraanFrameAge() over the debugging port, which is how the health
// timer on the computer knows the same thing.

export const probeEveryMs = 2000;
export const stallSeconds = 5;
const keptSamples = 15;
// A screen nobody has measured yet is assumed to be the slower of the two kinds, so nothing is judged harshly before
// the first measurement lands
export const assumedRefreshMs = 33.4;

// A probe whose frame never arrives is not left in the way of the next one. A browser that has stopped painting keeps
// the request queued and runs it when painting comes back, which is how a stall is noticed at all; but a browser that
// drops it instead would leave this flag set for ever and the probe would never ask again.
const probeStuckMs = 4000;

let lastFrameAt = 0;
let waiting = false;
let waitingSince = 0;
let started = false;
const samples = [];
const stallListeners = [];

function now() {
  return typeof performance === 'object' && performance && typeof performance.now === 'function' ? performance.now() : Date.now();
}

// When a frame was last painted, in milliseconds of the page clock. 0 means none has been seen yet.
export function lastFrame() {
  return lastFrameAt;
}

// How long ago the last frame was painted, in seconds. Before the first frame it is how long the page has been open,
// so a page that never painted at all reads as badly as one that stopped.
export function frameAgeSeconds() {
  return Math.round((now() - lastFrameAt) / 1000);
}

// Has a frame been painted inside this many seconds?
export function framesFresh(withinSeconds = stallSeconds * 2) {
  return lastFrameAt > 0 && frameAgeSeconds() <= withinSeconds;
}

// The measured gap between two frames of this screen, in milliseconds: the middle of the samples, so one long frame
// does not move it. The assumed value until enough has been measured.
export function refreshMs() {
  if (samples.length < 3) return assumedRefreshMs;

  const sorted = samples.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// Told when frames come back after a gap of more than stallSeconds. The gap in seconds is passed on.
export function onStall(listener) {
  stallListeners.push(listener);
}

function noteStall(gapSeconds) {
  stallListeners.forEach(listener => {
    try {
      listener(gapSeconds);
    } catch (error) {
      console.error('A frame stall could not be acted on', error);
    }
  });
}

// One probe: a frame, then the frame after it. The first says the screen is painting and when; the pair says how far
// apart its frames are.
function probe() {
  if (typeof requestAnimationFrame !== 'function') return;
  if (waiting && now() - waitingSince < probeStuckMs) return;

  waiting = true;
  waitingSince = now();
  requestAnimationFrame(first => {
    const gapSeconds = lastFrameAt > 0 ? Math.round((first - lastFrameAt) / 1000) : 0;
    lastFrameAt = first;
    requestAnimationFrame(second => {
      waiting = false;
      lastFrameAt = second;
      const gap = second - first;
      // A gap of a whole second is the page being given back time after a pause, not a refresh interval
      if (gap > 0 && gap < 1000) {
        samples.push(gap);
        if (samples.length > keptSamples) samples.shift();
      }
    });
    if (gapSeconds > stallSeconds) {
      console.warn('No frame was painted for ' + gapSeconds + ' seconds. Putting the page right.');
      noteStall(gapSeconds);
    }
  });
}

// Starts the probe, and nothing else. Called once, early, so that the age of the last frame is known before anything
// asks. A timeout that asks again, not an interval, so the page keeps its count of intervals.
export function startFrames() {
  if (started || typeof requestAnimationFrame !== 'function') return;

  started = true;
  lastFrameAt = now();
  const again = () => {
    setTimeout(again, probeEveryMs);
    probe();
  };
  probe();
  setTimeout(again, probeEveryMs);

  // The computer reads this over the debugging port (computer/scripts/page-command.py frames), which is how the health
  // timer there can tell a page that is painting from one that only looks alive.
  try {
    window.__teletraanFrameAge = () => frameAgeSeconds();
  } catch (error) {
    // nothing else needs it; the title still carries the same fact
  }
}

// For the tests
export function forgetFrames() {
  lastFrameAt = 0;
  waiting = false;
  waitingSince = 0;
  started = false;
  samples.length = 0;
  stallListeners.length = 0;
}
