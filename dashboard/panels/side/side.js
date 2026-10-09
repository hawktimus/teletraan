// The sidebar of the sidebar layout (docs/layouts.md). The column holds the
// countdown and, under it, the logo, the TEAM plate and the school. The team
// name, the clock with the date, and the weather are part of the same panel, but
// they are drawn in the strip across the top of the screen (placeInStrip below),
// because the column is not high enough for them at 44 px or more
// (docs/layouts.md, "The vertical budget"). It is the one panel that stays on
// screen in that layout, in place of the banner and the countdown (registry.js),
// and it is drawn into #region-banner. Every part has a class that starts with
// side-, so a theme can style it (docs/layouts.md has the list and the size of
// each).

import * as frame from '../../frame.js';
import { formatClock, formatDate } from '../../core/time.js';
import { weatherIcon } from '../../core/weather-icons.js';
import { logoMarkup, showTeamLogo } from '../../core/logo.js';
import { nameMarkup } from '../../core/name.js';
import { teamPlateMarkup } from '../../core/plate.js';
import { countdownParts, startCountdown, updateCountdown } from '../../core/countdown.js';
import { teamShown } from '../../core/teams.js';

// Sizes that the stylesheet repeats. Change them together.
const TEAM_PLATE_WIDTH = 384; // .side-team in side.css: the whole column
const STRIPES_WIDTH = 182; // .stripes in side.css: the bars between the word DAYS (118) and the lamp (20), with 16 round them

// core/countdown.js puts the label and the date on one line, and this panel puts
// them on two, the label with the whole 352 px line to itself and the date under
// it. The room is that line, plus the gap that countdown.js keeps between the
// two (24) and the widest date (177 px, MAR 29 at 44 px). The IN and the date
// then go only when the label itself is too wide for its line, and one still too
// wide goes on to a second line, or is cut off (side.css).
const COUNTDOWN_LINE_ROOM = 553;

const ICON_SIZE = 48; // the weather picture, in px

// The markup of the whole panel, with every part empty. update() fills it in.
// The parts of the column have data-part names that frame.js knows
// (sequences.side), so they arrive one after another. The name, the clock and the
// weather have none: they are moved into the strip, outside the panel, and do not
// arrive with it.
export function sideMarkup() {
  return `
    <section class="panel side" data-sequence="side">
      <h1 class="side-name" data-name-effect></h1>

      <div class="side-clock">
        <span class="time"></span>
        <span class="suffix"></span>
        <span class="date"></span>
      </div>

      <div class="side-weather">
        <span class="weather-icon"></span>
        <span class="temperature"></span>
      </div>

      <div class="side-countdown" data-level="calm">
        <span class="countdown-face" data-part="body"></span>
        ${countdownParts(STRIPES_WIDTH)}
      </div>

      <div class="side-brand">
        <div class="logo side-logo">${logoMarkup()}</div>
        <span class="side-sample" data-part="sample-badge"></span>
        <div class="side-team" data-part="team-plate">
          ${teamPlateMarkup(TEAM_PLATE_WIDTH)}
          <span>TEAM <b class="team-number"></b></span>
        </div>
        <div class="side-school" data-part="school"><span class="school-text"></span></div>
      </div>
    </section>`;
}

export function mount(host, content) {
  host.innerHTML = sideMarkup();

  const element = host.firstElementChild;
  placeInStrip(element);
  update(element, content);

  // The text only changes once a minute, so the page is touched only when the
  // minute is a different one. The minute is counted from the clock itself, so
  // a new day, or the clock being set, always counts as a different minute.
  let shownMinute = null;
  const showClock = now => {
    const minute = Math.floor(now.getTime() / 60000);
    if (minute === shownMinute) return;

    shownMinute = minute;
    drawClock(element, now);
  };
  showClock(new Date());
  frame.onSecond(showClock, element);

  // Its own second listener, and the element it is given is the one that goes
  // when the panel does
  startCountdown(element.querySelector('.side-countdown'), content, { lineRoom: COUNTDOWN_LINE_ROOM });
}

// The part is in the panel, or in the strip once placeInStrip has moved it
function part(element, selector) {
  return element.querySelector(selector) || document.querySelector('#region-strip ' + selector);
}

function setText(element, selector, text) {
  const target = part(element, selector);
  if (target.textContent !== text) target.textContent = text;
}

// The strip across the top (#strip-name and #strip-clock in index.html) is a
// block of its own for the hidden transitions, so the team name, the clock and the
// weather are moved there. They stay this panel's: it still builds them and
// updates them, and the name effect finds the name by data-name-effect. They do
// not arrive with the panel's parts (frame.js, sequences.side), because they are
// no longer inside the panel. A page with no strip keeps them in the panel.
function placeInStrip(element) {
  moveTo('strip-name', element, ['.side-name']);
  moveTo('strip-clock', element, ['.side-clock', '.side-weather']);
}

function moveTo(id, element, selectors) {
  const slot = document.getElementById(id);
  if (!slot) return;

  slot.innerHTML = '';
  selectors.forEach(selector => slot.appendChild(element.querySelector(selector)));
}

// The name is made of letters so the name effect can split each one. It is
// only rebuilt when the name changes, because a rebuild in the middle of the
// effect would start it again. It is one line: a name too long for the strip
// squeezes its letters together (layouts/sidebar.css).
function setName(element, name) {
  const heading = part(element, '.side-name');
  if (heading.dataset.name === name) return;

  heading.dataset.name = name;
  heading.innerHTML = nameMarkup(name);
}

// New content: the team, the weather, the countdown's dates, and whether it is
// the sample. The team is the one on the screen (core/teams.js): its name, number
// and logo, with the hawk when it has no logo. The label shows only while it is the
// sample, and is gone the moment the content is not. The weather is dashes until
// there is a reading. Whether Sanity can be reached is not said here but in the
// connection status text at the bottom right (core/connection.js).
export function update(element, content) {
  const team = teamShown(content);
  setName(element, team.name);
  setText(element, '.team-number', team.number);
  setText(element, '.school-text', content.team.school);
  showTeamLogo(element.querySelector('.side-logo'), team.logo);

  const weather = content.weather;
  setText(element, '.temperature', weather ? weather.temperature + '°F' : '--°F');

  const icon = part(element, '.weather-icon');
  const markup = weather ? weatherIcon(weather.code, weather.isDay, ICON_SIZE) : '';
  if (icon.innerHTML !== markup) icon.innerHTML = markup;

  const status = content.status || {};
  setText(element, '.side-sample', status.source === 'sample' ? 'SAMPLE CONTENT' : '');

  updateCountdown(element.querySelector('.side-countdown'), content);
}

function drawClock(element, now) {
  const clock = formatClock(now);
  setText(element, '.time', clock.time);
  setText(element, '.suffix', clock.suffix);
  setText(element, '.side-clock .date', formatDate(now)); // the countdown has a .date of its own
}
