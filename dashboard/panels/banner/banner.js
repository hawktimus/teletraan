// The top of the screen: logo, team name, clock, date, weather and school.

import * as frame from '../../frame.js';
import { formatClock, formatDate } from '../../core/time.js';
import { weatherIcon } from '../../core/weather-icons.js';
import { logoMarkup } from '../../core/logo.js';
import { nameMarkup } from '../../core/name.js';
import { teamPlateMarkup } from '../../core/plate.js';

export function mount(host, content) {
  host.innerHTML = `
    <section class="panel banner" data-sequence="banner">
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
          <span class="status" data-part="status"></span>
          <span class="school" data-part="school"></span>
        </div>
      </div>
    </section>`;

  const element = host.firstElementChild;
  update(element, content);
  tickClock(element, new Date());
  frame.onSecond(now => tickClock(element, now), element);
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

// New content: the names, the weather, whether the content is old, and
// whether it is the sample. The badge shows only while it is the sample, and
// is gone the moment the content is not.
export function update(element, content) {
  setName(element, content.team.name);
  setText(element, '.team-number', content.team.number);
  setText(element, '.school', content.team.school);

  const weather = content.weather;
  setText(element, '.temperature', weather ? weather.temperature + '°F' : '--°F');

  const icon = element.querySelector('.weather-icon');
  const markup = weather ? weatherIcon(weather.code, weather.isDay) : '';
  if (icon.innerHTML !== markup) icon.innerHTML = markup;

  const status = content.status || {};
  setText(element, '.status', status.offline ? 'OFFLINE' : '');
  element.querySelector('.status').classList.toggle('offline', Boolean(status.offline));
  setText(element, '.sample-badge', status.source === 'sample' ? 'SAMPLE CONTENT' : '');
}

// The text only changes once a minute, so only touch the page when it does.
function tickClock(element, now) {
  const clock = formatClock(now);
  setText(element, '.time', clock.time);
  setText(element, '.suffix', clock.suffix);
  setText(element, '.date', formatDate(now));
}
