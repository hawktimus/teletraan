// The top of the screen: logo, team name, clock, date, weather and school.

import * as frame from '../../frame.js';
import { formatClock, formatDate } from '../../core/time.js';
import { weatherIcon } from '../../core/weather-icons.js';
import { logoMarkup } from '../../core/logo.js';
import { boltMarkup } from '../../core/plate.js';

export function mount(host, content) {
  host.innerHTML = `
    <section class="panel banner" data-sequence="banner">
      <div class="logo">${logoMarkup()}</div>

      <div class="banner-text">
        <div class="banner-top">
          <div class="banner-left">
            <h1 class="team-name" data-part="title"></h1>
            <div class="team-plate" data-part="team-plate">
              <svg width="520" height="76" viewBox="0 0 520 76">
                <polygon points="4,4 516,4 516,40 476,72 4,72"/>
                <polyline class="tab-lit" points="12,11 510,11"/>
                ${boltMarkup(494, 24, 24, 'brass')}
              </svg>
              <span>TEAM <b class="team-number"></b></span>
            </div>
          </div>

          <div class="banner-right" data-part="clock">
            <div class="clock">
              <span class="time"></span>
              <span class="suffix"></span>
            </div>
            <div class="date-row">
              <span class="date"></span>
              <span class="weather-icon"></span>
              <span class="temperature"></span>
            </div>
          </div>
        </div>

        <div class="banner-bottom">
          <img class="wordmark" data-part="wordmark" src="assets/teletraan-wordmark.svg" alt="Teletraan I">
          <span class="subtitle" data-part="subtitle">DASHBOARD</span>
          <span class="rule" data-part="rule"></span>
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

// New content: the names, the weather, and whether the content is old
export function update(element, content) {
  setText(element, '.team-name', content.team.name);
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
}

// The text only changes once a minute, so only touch the page when it does.
function tickClock(element, now) {
  const clock = formatClock(now);
  setText(element, '.time', clock.time);
  setText(element, '.suffix', clock.suffix);
  setText(element, '.date', formatDate(now));
}
