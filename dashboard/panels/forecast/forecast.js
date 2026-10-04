// The weather now and today's high and low, in the small panel under the
// countdown.

import { plateMarkup, scanMarkup } from '../../core/plate.js';
import { weatherIcon } from '../../core/weather-icons.js';
import { escapeHtml } from '../../core/text.js';

// Keep in step with the .icon size in forecast.css
const ICON_SIZE = 120;

export function hasContent(content) {
  return Boolean(content.weather);
}

export function mount(host, content) {
  const weather = content.weather;

  host.innerHTML = `
    <section class="panel forecast" data-sequence="grid2">
      ${plateMarkup('grid2')}
      ${scanMarkup('grid2')}

      <div class="label" data-part="label">FORECAST</div>

      <div class="content" data-part="content">${weather ? weatherMarkup(weather) : ''}</div>
    </section>`;
}

// A missing number shows as dashes, never as the word undefined
function degrees(value) {
  return typeof value === 'number' && !isNaN(value) ? Math.round(value) + '°' : '--°';
}

function weatherMarkup(weather) {
  const condition = weather.condition ? `<div class="condition">${escapeHtml(weather.condition)}</div>` : '';

  return `
    <div class="now">
      <div class="icon">${weatherIcon(weather.code, weather.isDay, ICON_SIZE)}</div>
      <div class="temperature">${degrees(weather.temperature)}</div>
    </div>
    ${condition}
    <div class="range">
      <span>H ${degrees(weather.high)}</span>
      <span>L ${degrees(weather.low)}</span>
    </div>`;
}
