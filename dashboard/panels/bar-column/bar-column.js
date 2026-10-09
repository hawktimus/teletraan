// The side column of the bar layout (docs/layouts.md, "The bar layout"): the clock with
// the date and the weather, the TEAM plate, the school and, at the bottom, the logo.
// A rail of ticks runs along the edge of the screen beside it. It is one of the two
// panels that stay on screen in that layout, and it is drawn into #region-column. The
// team name is in the banner (panels/bar-banner). Every part has a class that starts
// with bar-, so a style can look after it (docs/layouts.md has the list and the size of
// each).

import * as frame from '../../frame.js';
import { formatClock, formatDate } from '../../core/time.js';
import { weatherIcon } from '../../core/weather-icons.js';
import { logoMarkup, showTeamLogo } from '../../core/logo.js';
import { teamPlateMarkup } from '../../core/plate.js';
import { teamShown } from '../../core/teams.js';
import { packExtras } from '../../core/theme.js';

// Sizes that the stylesheet repeats. Change them together.
const TEAM_PLATE_WIDTH = 300; // .bar-team in bar-column.css: the whole column
const ICON_SIZE = 48; // the weather picture, in px

// The data-part names are the ones frame.js knows (sequences['bar-column']), so the
// parts arrive one after another. The rail is a plain box, and so is the logo, which
// has a show of its own (frame.startLogo).
export function mount(host, content) {
  host.innerHTML = `
    <section class="panel bar-column" data-sequence="bar-column">
      <div class="bar-rail"></div>

      <div class="bar-body">
        <div class="bar-clock" data-part="clock">
          <div class="bar-time">
            <span class="time"></span>
            <span class="suffix"></span>
          </div>
          <div class="bar-date"></div>
          <div class="bar-weather">
            <span class="weather-icon"></span>
            <span class="temperature"></span>
          </div>
        </div>
        <div class="bar-line" data-part="line"></div>

        <div class="bar-team" data-part="team-plate">
          ${teamPlateMarkup(TEAM_PLATE_WIDTH)}
          <span>TEAM <b class="team-number"></b></span>
        </div>
        <div class="bar-school" data-part="school"><span class="school-text"></span></div>
        <span class="bar-sample" data-part="sample-badge"></span>

        <div class="logo bar-logo">${logoMarkup()}</div>
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

// New content: the team, the weather, the banner line and whether it is the sample. The
// team is the one on the screen (core/teams.js): its number and logo, with the hawk when
// it has no logo. The school is the same for both teams. The label shows only while it is
// the sample, and is gone the moment the content is not. The weather is dashes until
// there is a reading. Whether Sanity can be reached is not said here but in the
// connection status text at the bottom right (core/connection.js).
export function update(element, content) {
  const team = teamShown(content);
  setText(element, '.team-number', team.number);
  setText(element, '.school-text', content.team.school);
  showTeamLogo(element.querySelector('.bar-logo'), team.logo);

  const weather = content.weather;
  setText(element, '.temperature', weather ? weather.temperature + '°F' : '--°F');

  const icon = element.querySelector('.weather-icon');
  const markup = weather ? weatherIcon(weather.code, weather.isDay, ICON_SIZE) : '';
  if (icon.innerHTML !== markup) icon.innerHTML = markup;

  const status = content.status || {};
  setText(element, '.bar-sample', status.source === 'sample' ? 'SAMPLE CONTENT' : '');

  // The banner line of the seasonal pack on the screen. While there is one, the parts under
  // it move down (bar-column.css, data-line)
  const line = packExtras(content).bannerLine;
  setText(element, '.bar-line', line);

  const wanted = line === '' ? 'off' : 'on';
  if (element.dataset.line !== wanted) element.dataset.line = wanted;
}

function drawClock(element, now) {
  const clock = formatClock(now);
  setText(element, '.time', clock.time);
  setText(element, '.suffix', clock.suffix);
  setText(element, '.bar-date', formatDate(now));
}
