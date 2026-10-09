// The night screen, the screensaver. From 11:30 pm to 11:30 am (the fixed times
// in core/constants.js, in the time zone of the Look page) the screen is black
// with the team logo and the team number under it. The switch and the style are
// in the night mode settings of Dashboard Settings, in the Advanced tab. The
// signal is never turned off: the Mini keeps sending a picture, and the kiosk
// script keeps the TV from blanking (deploy/scripts/kiosk.sh).
//
// This file only shows, hides and tells the stylesheet what to do. When it is
// night comes from core/night.js, and every move is in frame.css ("Night mode").
// Nothing here runs per frame. It looks at the clock once a second, and
// otherwise answers two events: an alert or announcement starting or ending
// (watchTakeovers), and the logo bouncing on a wall (animationiteration).
//
// Behind the night screen the dashboard carries on: the content keeps being
// read and the pages keep changing. The stage is not drawn while the screen
// covers it, and no logo effect or screen glitch starts, to spare the Mini.
//
// The address switch ?night=on shows the screen whatever the time, ?night=off
// never shows it. A demo (core/demo-screens.js) shows it for a while with
// showNightNow() and gives it back to the clock with endNightNow(). That wins
// over the time, the Use night mode switch, Night style and ?night=off.

import * as frame from '../frame.js';
import { defaultTeam, nightStyles } from '../config.js';
import { emblemMarkup } from './logo.js';
import { teamShown } from './teams.js';
import { cornerWindowMs, makeCornerDetector, nextPair, nightPlan, nightWanted } from './night.js';
import { takeoverRunning, watchTakeovers } from './takeover.js';

const root = document.documentElement;
const layer = document.getElementById('night');
const fadeMs = 1000; // the same second as the fade in frame.css

let getContent = null;
let override = ''; // 'on', 'off' or '' from the address
let demoStyle = ''; // while a demo shows the screen, the style it asked for. Otherwise empty.
let block = null; // the logo and the number together
let numbers = []; // the number's two copies: white, and the gold one that flashes
let shown = false; // the layer is up, or fading in
let covering = false; // the layer has faded in and the dashboard under it is not drawn
let speedInUse = ''; // the name of the speed the bounce was started with
let corners = makeCornerDetector(cornerWindowMs);
let drawn = { style: '', width: 0, number: '' }; // what the layer has been told, so it is only told again when it changes

// getContent() returns the newest content. switchText is the ?night= switch.
export function startNight(contentGetter, switchText) {
  getContent = contentGetter;
  override = switchText === 'on' || switchText === 'off' ? switchText : '';

  build();
  watchTakeovers(settle);
  frame.onSecond(look);
  look(new Date());
}

// The logo is drawn once, here. Its colours are CSS variables, so a change of
// colour is a change of data-pair and nothing is drawn again.
function build() {
  layer.innerHTML =
    '<div class="night-x"><div class="night-y"><div class="night-block" data-pair="0">' +
    '<div class="night-logo">' + emblemMarkup() + '</div>' +
    '<div class="night-number"></div>' +
    '<div class="night-number night-flash" aria-hidden="true"></div>' +
    '</div></div></div>';

  block = layer.querySelector('.night-block');
  numbers = Array.from(layer.querySelectorAll('.night-number'));
  layer.addEventListener('animationiteration', onBounce);
  layer.addEventListener('animationend', onSpinEnd);
}

// True while the night screen is up, from the moment it starts to fade in until
// it has faded out. The hidden transitions (core/hidden-run.js) ask, so they
// never play while it is up.
export function nightIsUp() {
  return shown;
}

// A demo shows the night screen now, in this style, whatever the time says.
// Nothing happens when the night screen has not been started.
export function showNightNow(style) {
  demoStyle = nightStyles.includes(style) ? style : 'bounce';
  look(new Date());
}

// The demo is over. The screen goes back to what the clock and the settings say.
export function endNightNow() {
  demoStyle = '';
  look(new Date());
}

// Once a second: is it night?
function look(now) {
  if (!getContent) return;

  const content = getContent();
  if (!content) return;

  if (demoStyle !== '' || nightWanted(content.settings, content.theme.timeZone, now, override)) show(content);
  else hide();
  settle();
}

function fadeTime() {
  return root.dataset.motion === 'none' ? 0 : fadeMs;
}

// Puts the settings on the layer, and starts it if it is not up
function show(content) {
  const settings = content.settings;
  drawSettings(settings, teamShown(content));

  if (!shown) {
    shown = true;
    layer.hidden = false;
    layer.dataset.state = 'in';
    startBounce(settings.nightSpeed);
    coverStage();
  } else if (settings.nightSpeed !== speedInUse) {
    startBounce(settings.nightSpeed); // a new speed means new durations, so it starts again
  }
}

function drawSettings(settings, team) {
  const style = demoStyle || settings.nightStyle;
  if (style !== drawn.style) {
    layer.dataset.style = style;
    drawn.style = style;
  }
  if (settings.nightLogoWidth !== drawn.width) {
    layer.style.setProperty('--night-logo-w', settings.nightLogoWidth + 'px');
    drawn.width = settings.nightLogoWidth;
  }

  const number = (team && team.number) || defaultTeam.number;
  if (number !== drawn.number) {
    numbers.forEach(element => { element.textContent = number; });
    drawn.number = number;
  }
}

// Once the layer has faded in the dashboard under it is hidden. The effects
// stop while it covers (frame.setNightCovers).
async function coverStage() {
  await frame.wait(fadeTime());
  if (!shown) return;

  covering = true;
  root.dataset.night = 'on';
  settle();
}

function hide() {
  if (!shown) return;

  shown = false;
  covering = false;
  delete root.dataset.night; // the dashboard is drawn again, under the fade
  layer.dataset.state = 'out';
  layer.dataset.run = 'stopped';
  block.classList.remove('hit');
  uncoverLater();
}

async function uncoverLater() {
  await frame.wait(fadeTime());
  if (!shown) layer.hidden = true;
}

// An alert or announcement covers everything, so the night screen steps aside
// and waits, and comes back when it is over. Called by the takeovers and once
// a second.
function settle() {
  const stepAside = takeoverRunning();
  layer.classList.toggle('yielding', stepAside);
  frame.setNightCovers(covering && !stepAside);
}

// Starts the bounce, or starts it again: new durations and delays from
// nightPlan, and the colours at the first pair
function startBounce(speedName) {
  const plan = nightPlan(speedName, Math.random);
  speedInUse = speedName;
  corners = makeCornerDetector(cornerWindowMs);
  block.classList.remove('hit');

  layer.dataset.run = 'stopped';
  void layer.offsetWidth; // lets the browser see the animations stop, so they start again from the beginning
  layer.style.setProperty('--night-x-seconds', plan.across + 's');
  layer.style.setProperty('--night-y-seconds', plan.down + 's');
  layer.style.setProperty('--night-x-delay', -plan.acrossDelay + 's');
  layer.style.setProperty('--night-y-delay', -plan.downDelay + 's');
  layer.dataset.run = 'moving';
}

// The logo reached a wall, sideways (night-x) or downwards (night-y)
function onBounce(event) {
  const axis = event.animationName === 'night-x' ? 'x' : event.animationName === 'night-y' ? 'y' : '';
  if (!axis) return;

  block.dataset.pair = String(nextPair(Number(block.dataset.pair)));

  // Both walls within 100 ms of each other is a corner. Calm and none never
  // get here, because nothing moves, but the spin is skipped in them anyway.
  if (corners.bounce(axis, event.timeStamp) && root.dataset.motion === 'full') playCornerHit();
}

// The spin and the gold flash are frame.css's, played by adding the class hit
function playCornerHit() {
  // which corner it is in, so the spin moves in from it and stays on the screen
  const rect = block.getBoundingClientRect();
  block.style.setProperty('--hit-x', rect.left < window.innerWidth / 2 ? '1' : '-1');
  block.style.setProperty('--hit-y', rect.top < window.innerHeight / 2 ? '1' : '-1');

  block.classList.remove('hit');
  void block.offsetWidth; // so a second hit starts the spin again
  block.classList.add('hit');
}

function onSpinEnd(event) {
  if (event.animationName === 'night-spin') block.classList.remove('hit');
}
