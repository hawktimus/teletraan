// The top of the screen: logo, team name, clock, date, weather and school. In Cybertron
// it stands on a plate (frameKind in core/plate.js, with the corners the page's style has).

import * as frame from '../../frame.js';
import { formatClock, formatDate } from '../../core/time.js';
import { weatherIcon } from '../../core/weather-icons.js';
import { logoMarkup, showTeamLogo } from '../../core/logo.js';
import { nameMarkup } from '../../core/name.js';
import { frameKind, plateMarkup, teamPlateMarkup } from '../../core/plate.js';
import { layoutNow } from '../../core/layout.js';
import { shapesNow } from '../../core/style.js';
import { teamShown } from '../../core/teams.js';
import { packExtras } from '../../core/theme.js';

export function mount(host, content) {
  const kind = frameKind('banner', layoutNow(), shapesNow());

  host.innerHTML = `
    <section class="panel banner" data-sequence="banner">
      ${kind === 'banner' ? '' : plateMarkup(kind)}
      <div class="logo">${logoMarkup()}</div>

      <div class="banner-text">
        <div class="banner-top">
          <div class="banner-left">
            <h1 class="team-name" data-part="title" data-name-effect></h1>
            <div class="team-plate" data-part="team-plate">
              ${teamPlateMarkup()}
              <span>TEAM <b class="team-number"></b></span>
            </div>
            <span class="sample-badge" data-part="sample-badge"></span>
          </div>

          <div class="banner-right" data-part="clock">
            <div class="clock">
              <span class="time"></span>
              <span class="suffix"></span>
            </div>
            <div class="date-row">
              <span class="date-rule bar bar-thin"></span>
              <span class="date"></span>
              <span class="weather-icon"></span>
              <span class="temperature"></span>
            </div>
          </div>
        </div>

        <div class="banner-bottom">
          <img class="wordmark" data-part="wordmark" src="assets/teletraan-wordmark.svg" alt="Teletraan I">
          <span class="subtitle" data-part="subtitle">DASHBOARD</span>
          <span class="rule bar" data-part="rule"></span>
          <span class="banner-line" data-part="line"></span>
          <span class="school" data-part="school"></span>
        </div>
      </div>
    </section>`;

  const element = host.firstElementChild;
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
}

function setText(element, selector, text) {
  const target = element.querySelector(selector);
  if (target.textContent !== text) target.textContent = text;
}

// The name is made of letters so the name effect can split each one. It is
// only rebuilt when the name changes, because a rebuild in the middle of the
// effect would start it again.
function setName(element, name) {
  const heading = element.querySelector('.team-name');
  if (heading.dataset.name === name) return;

  heading.dataset.name = name;
  heading.innerHTML = nameMarkup(name);
}

// New content: the team, the weather, the banner line and whether it is the sample. The
// team is the one on the screen (core/teams.js): its name, number and logo, with the hawk
// when it has no logo. The school is the same for both teams. The badge shows only while
// it is the sample, and is gone the moment the content is not. Whether Sanity can be
// reached is not said here but in the connection status text at the bottom right
// (core/connection.js).
export function update(element, content) {
  const team = teamShown(content);
  setName(element, team.name);
  setText(element, '.team-number', team.number);
  setText(element, '.school', content.team.school);
  showTeamLogo(element.querySelector('.logo'), team.logo);

  const weather = content.weather;
  setText(element, '.temperature', weather ? weather.temperature + '°F' : '--°F');

  const icon = element.querySelector('.weather-icon');
  const markup = weather ? weatherIcon(weather.code, weather.isDay) : '';
  if (icon.innerHTML !== markup) icon.innerHTML = markup;

  const status = content.status || {};
  setText(element, '.sample-badge', status.source === 'sample' ? 'SAMPLE CONTENT' : '');

  // The line of the seasonal pack on the screen takes the place of DASHBOARD and the bar
  const line = packExtras(content).bannerLine;
  setText(element, '.banner-line', line);
  setLine(element, line);
}

// banner.css reads data-line to give the line its place
function setLine(element, line) {
  const wanted = line === '' ? 'off' : 'on';
  if (element.dataset.line !== wanted) element.dataset.line = wanted;
}

function drawClock(element, now) {
  const clock = formatClock(now);
  setText(element, '.time', clock.time);
  setText(element, '.suffix', clock.suffix);
  setText(element, '.date', formatDate(now));
}
