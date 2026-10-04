// Counts down to Kickoff, then to Rollout. The nearer the date, the more
// serious the panel looks (see data-level in countdown.css).

import * as frame from '../../frame.js';
import { plateMarkup, scanMarkup } from '../../core/plate.js';
import { timeLeft, monthName, parseLocalDateTime, pad } from '../../core/time.js';
import { escapeHtml } from '../../core/text.js';
import { threat } from '../../config.js';

const SEGMENTS = 12; // the bar under the numbers fills 5 seconds at a time
const states = new WeakMap();

export function mount(host, content) {
  const segments = Array.from({ length: SEGMENTS }, (item, index) => {
    return `<span class="segment" data-part="segment" data-index="${index}"></span>`;
  }).join('');

  host.innerHTML = `
    <section class="panel countdown" data-sequence="countdown" data-level="calm">
      ${plateMarkup('countdown')}
      ${scanMarkup('countdown')}

      <div class="top-line">
        <div class="label-group" data-part="label">
          <span class="lamp" data-part="lamp" data-idle="pulse"></span>
          <span class="label"></span>
        </div>
        <span class="date" data-part="label"></span>
      </div>
      <div class="stripes" data-part="stripes"></div>

      <div class="days-row">
        <div class="days">
          <svg class="chevron chevron-left" data-part="chevron-left" width="40" height="136" viewBox="0 0 40 136">
            <polyline points="6,6 29,68 6,130"/>
          </svg>
          <div class="days-window">
            <div class="days-number" data-part="days"><span></span></div>
          </div>
          <svg class="chevron chevron-right" data-part="chevron-right" width="40" height="136" viewBox="0 0 40 136">
            <polyline points="34,6 11,68 34,130"/>
          </svg>
        </div>
        <div class="days-word" data-part="days-word"></div>
      </div>

      <div class="time-row" data-part="time">
        <span class="digits hours"><span></span></span><span class="unit">HRS</span>
        <span class="digits minutes"><span></span></span><span class="unit">MIN</span>
        <span class="digits seconds"><span></span></span><span class="unit">SEC</span>
      </div>

      <div class="segments">${segments}</div>
    </section>`;

  const element = host.firstElementChild;
  const state = {
    content: content,
    lastMinute: null,
    days: element.querySelector('.days-number span'),
    daysWord: element.querySelector('.days-word'),
    hours: element.querySelector('.hours span'),
    minutes: element.querySelector('.minutes span'),
    seconds: element.querySelector('.seconds span'),
    label: element.querySelector('.label'),
    date: element.querySelector('.date'),
    segments: element.querySelectorAll('.segment'),
    chevronLeft: element.querySelector('.chevron-left'),
    chevronRight: element.querySelector('.chevron-right'),
  };
  states.set(element, state);

  refresh(element, new Date());
  frame.onSecond(now => refresh(element, now), element);
}

// New content from the editors, for example a changed date
export function update(element, content) {
  const state = states.get(element);
  if (state) state.content = content;
}

// The date being counted down to: Kickoff first, then Rollout, then nothing
function currentTarget(settings, now) {
  const kickoff = parseLocalDateTime(settings.kickoff);
  if (kickoff && now < kickoff) return { label: settings.kickoffLabel, target: kickoff };

  const rollout = parseLocalDateTime(settings.rollout);
  if (rollout && now < rollout) return { label: settings.rolloutLabel, target: rollout };

  if (!kickoff && !rollout) return { label: 'DATE NOT SET', target: null };
  return { label: 'COUNTDOWN COMPLETE', target: null };
}

function threatLevel(days) {
  if (days <= threat.criticalDays) return 'critical';
  if (days <= threat.tenseDays) return 'tense';
  return 'calm';
}

function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

// The first time a number is shown it just appears. After that a new
// number slams in, but only when it really is different.
function show(element, text) {
  if (element.textContent === text) return;
  if (element.textContent === '') {
    element.textContent = text;
  } else {
    frame.slam(element, text);
  }
}

function refresh(element, now) {
  const state = states.get(element);
  const goal = currentTarget(state.content.settings.countdown, now);
  const left = goal.target ? timeLeft(goal.target, now) : timeLeft(now, now);

  setText(state.label, goal.label);
  setText(state.date, goal.target ? monthName(goal.target) + ' ' + goal.target.getDate() : '');

  show(state.days, String(left.days));
  state.days.parentNode.classList.toggle('long', left.days > 99); // three digits do not fit at the big size
  setText(state.daysWord, left.days === 1 ? 'DAY' : 'DAYS');
  show(state.hours, pad(left.hours));
  show(state.minutes, pad(left.minutes));
  show(state.seconds, pad(left.seconds));

  const level = goal.target ? threatLevel(left.days) : 'calm';
  if (element.dataset.level !== level) element.dataset.level = level;

  // The bar under the numbers fills up through each minute and empties at the next
  const lit = Math.floor((60 - left.seconds) / (60 / SEGMENTS));
  state.segments.forEach((segment, index) => {
    segment.classList.toggle('lit', index < lit);
  });

  if (state.lastMinute !== null && state.lastMinute !== left.minutes) {
    frame.nudge(state.chevronLeft, state.chevronRight);
  }
  state.lastMinute = left.minutes;
}
