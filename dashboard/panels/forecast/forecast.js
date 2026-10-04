// The weather now and today's high and low, in the small panel under the
// countdown.

import { rowBarMarkup } from '../../core/plate.js';
import { weatherIcon } from '../../core/weather-icons.js';
import { escapeHtml } from '../../core/text.js';

// Keep in step with the .icon size in forecast.css
const ICON_SIZE = 112;

export function hasContent(content) {
  return Boolean(content.weather);
}

export function mount(host, content) {
  const weather = content.weather;

  host.innerHTML = `
    <section class="page forecast">
      <div class="label" data-slat="label">FORECAST</div>

      <div class="content" data-slat="content">${weather ? weatherMarkup(weather) : ''}</div>
    </section>`;
}

// A missing number shows as dashes, never as the word undefined
function degrees(value) {
  return typeof value === 'number' && !isNaN(value) ? Math.round(value) + '°' : '--°';
}

// The metal bar is 628 long, 14px short of the frame on each side. It belongs
// to the range row so it turns over with the rest of the content.
function weatherMarkup(weather) {
  const condition = weather.condition ? `<div class="condition">${escapeHtml(weather.condition)}</div>` : '';

  return `
    <div class="now">
      <div class="icon">${weatherIcon(weather.code, weather.isDay, ICON_SIZE)}</div>
      <div class="temperature">${degrees(weather.temperature)}</div>
    </div>
    ${condition}
    <div class="range">
      ${rowBarMarkup(628)}
      <span>H ${degrees(weather.high)}</span>
      <span>L ${degrees(weather.low)}</span>
    </div>`;
}
