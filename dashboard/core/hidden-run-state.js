// What the parts of a hidden transition share: the elements it works on, its timings and its state (part of hidden-run.js).

export const hiddenState = {
  getContent: null,
  storage: null,
  handled: '', // the push handled before, as a time
  lastFired: 0, // when a hidden transition last started, in milliseconds since 1970. 0 is none yet.
  addressKind: '', // a kind that ?hidden= asked for and that has not played yet
  addressOff: false, // ?hidden=off
  asked: '', // the push the large panel has been asked to move on for
  playing: false,
  demoRunning: () => false, // set in startHidden, when the pieces are there
  nightIsUp: () => false,
  chooser: null, // picks the picture of each play, so the two of a set take turns
  showing: null, // the img on the backdrop now, or null
  pile: null, // the frames that collapse in this transition, or null
  plan: null, // what pile.release() planned: when each piece rises, and when the last one is home
  rotationHeld: false, // this transition has paused the rotation clock
  pictureFacts: {}, // file name -> what loading it gave: { ok, ms, width, height, why }. A picture that failed is here too.
  shownAt: 0, // when a picture went on the screen in this transition, in performance.now() milliseconds. 0 is none.
  pending: { key: '', since: 0, why: '', retryAt: 0 }, // the push that waits to play, when it was first seen and what held it
};

// How long the frames take to collapse, at normal speed. frame.css has the same number as
// --hidden-seconds in tokens.css (pileTimes.fallMs in core/transitions.js).
export const flySeconds = 1.7;
export const contentGoneAfter = 0.35; // seconds. The content has faded away by then (.3), so the pages can be swapped unseen
export const longestRest = 3000; // milliseconds to wait for the three areas to stop moving before giving up

export const world = document.getElementById('world');
export const backdrop = document.getElementById('backdrop');
export const redWash = document.getElementById('red-wash');
export const blueGlitch = document.getElementById('blue-glitch');

export const pictureElements = {}; // file name -> the img in #backdrop, once the picture has loaded. A picture that failed is not here.

export class Stopped extends Error {}
