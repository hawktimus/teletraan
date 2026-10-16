// What each key and mouse button does during a talk (part of presentation.js).

import { defaultTalk } from '../config.js';
import { graceMinutes } from './constants.js';
import { asDate } from './time.js';

export const states = ['idle', 'title', 'presenting', 'thanks', 'skipped'];

// Seconds, fixed by how the screen works and not by Dashboard Settings
export const thanksSeconds = 5;
export const notReadySeconds = 60; // how long "Slides are not ready" shows before the mode lets go
export const escapeSeconds = 2; // the second Esc must come within this time of the first
export const chipSeconds = 3; // the slide number shows this long after a key
export const preloadAhead = 3; // how many slides are decoded before they are needed

// What each key does, by the name the browser gives it (event.key). A letter is
// looked up in lower case, so Caps Lock does no harm.
export const keyActions = {
  PageDown: 'forward',
  ArrowRight: 'forward',
  ArrowDown: 'forward',
  ' ': 'forward',
  Enter: 'forward',
  n: 'forward',
  F5: 'forward',
  PageUp: 'back',
  ArrowLeft: 'back',
  ArrowUp: 'back',
  p: 'back',
  b: 'black',
  '.': 'black',
  Home: 'home',
  End: 'end',
  Escape: 'escape',
};

// 'forward', 'back', 'black', 'home', 'end' or 'escape', or null for a key that
// presentation mode leaves alone
export function keyAction(key) {
  const name = typeof key === 'string' && key.length === 1 ? key.toLowerCase() : key;
  return Object.prototype.hasOwnProperty.call(keyActions, name) ? keyActions[name] : null;
}

// What each button of the mouse does, by the name mouseButton() gives it. A tap on a touch
// screen is a left click. null is nothing: the middle button is not used. A double click is
// not a button, see secondOfDoubleClick.
export const clickActions = {
  left: 'forward',
  right: 'back',
  middle: null,
};

// A second left click this many milliseconds or fewer after the click before it is half of a
// double click, and does nothing
export const doubleClickMs = 500;

const buttonNames = { 0: 'left', 1: 'middle', 2: 'right' };

// 'left', 'middle' or 'right' for the number the browser gives in event.button, or null for
// any other button
export function mouseButton(number) {
  return Object.prototype.hasOwnProperty.call(buttonNames, number) ? buttonNames[number] : null;
}

// 'forward' or 'back', or null for a button that presentation mode leaves alone
export function clickAction(button) {
  return Object.prototype.hasOwnProperty.call(clickActions, button) ? clickActions[button] : null;
}

// When a talk is over, as a Date: its start, its minutes and the overrun it is
// allowed. The overrun is graceMinutes unless the caller names another one.
export function talkEnd(talk, overrunMinutes = graceMinutes) {
  const minutes = typeof talk.minutes === 'number' && talk.minutes > 0 ? talk.minutes : defaultTalk.minutes;
  return new Date(asDate(talk.start).getTime() + (minutes + overrunMinutes) * 60000);
}

// The key that the skipped set holds for a talk. It has the start in it, so a
// talk moved to another time in Studio is a new talk and can run again.
export function skipKey(talk) {
  return talk.id + ' ' + asDate(talk.start).getTime();
}
