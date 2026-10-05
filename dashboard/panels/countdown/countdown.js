// Counts down to Kickoff, then to Rollout. The nearer the date, the more
// serious the panel looks (see data-level in countdown.css).

import * as frame from '../../frame.js';
import { plateMarkup, scanMarkup } from '../../core/plate.js';
import { timeLeft, monthName, parseLocalDateTime, pad } from '../../core/time.js';
import { hasText } from '../../core/text.js';
import { threat } from '../../config.js';

const SEGMENTS = 12; // the bar under the numbers fills 5 seconds at a time
const LINE_ROOM = 528; // px for the label and the date: the 564px top line, less the lamp (20) and the gap after it (16)
const LINE_GAP = 24; // the least space between the label and the date
const states = new WeakMap();

// The row of red slanted bars under the top line: 24 wide, 12 high, one every
// 36px, drawn as one path. The last one is cut off by the edge of the picture.
function barsMarkup() {
  let path = '';
  for (let x = 0; x < 564; x += 36) {
    path += `M${x + 7} 0h24l-7 12h-24z`;
  }
  return `<svg class="stripes" data-part="stripes" width="564" height="12" viewBox="0 0 564 12"><path d="${path}"/></svg>`;
}

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
      ${barsMarkup()}

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
    shown: {}, // what each part shows now, so a part is written only when it changes
    lineKey: '', // what the top line was worked out from
    line: { label: '', date: '' },
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

  watchFonts();
  refresh(element, new Date());
  frame.onSecond(now => refresh(element, now), element);
}

// New content from the editors, for example a changed date
export function update(element, content) {
  const state = states.get(element);
  if (state) state.content = content;
}

// The label as typed, in capitals, without a closing " IN". The panel adds
// the IN itself (and drops it when there is no room), and the older starting
// labels had it in the words, so both ways of writing it work.
function cleanLabel(text, fallback) {
  const label = hasText(text) ? String(text).trim().toUpperCase().replace(/\s+IN$/, '') : '';
  return label || fallback;
}

// The first moment after the day the date falls on
function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

// Which date the panel is on: Kickoff first, then Rollout. A date that has
// just arrived stays on screen as NOW until the end of that day, so the team
// sees it, and then the panel moves on. When there is no date left it says so.
// reached is true during that NOW.
function currentStage(settings, now) {
  const stages = [
    { label: cleanLabel(settings.kickoffLabel, 'KICKOFF'), target: parseLocalDateTime(settings.kickoff) },
    { label: cleanLabel(settings.rolloutLabel, 'ROLLOUT'), target: parseLocalDateTime(settings.rollout) },
  ];

  for (const stage of stages) {
    if (!stage.target) continue;

    // timeLeft counts whole seconds, so NOW starts in the same second as the zeros
    if (timeLeft(stage.target, now).total > 0) return Object.assign(stage, { reached: false });
    if (now < endOfDay(stage.target)) return Object.assign(stage, { reached: true });
  }

  const anyDate = stages.some(stage => stage.target);
  return { label: anyDate ? 'COUNTDOWN OVER' : 'DATE NOT SET', target: null, reached: false };
}

// A width measured before a font arrived is wrong, so the top line is worked
// out again whenever a font finishes loading (see drawTopLine)
let fontLoads = 0;
let watchingFonts = false;
function watchFonts() {
  if (watchingFonts || !document.fonts || !document.fonts.addEventListener) return;
  watchingFonts = true;
  document.fonts.addEventListener('loadingdone', () => { fontLoads += 1; });
}

// How wide text is on the top line, in px. A canvas measures it because the
// text is not on the page yet. The font must match .top-line in countdown.css.
let pen = null;
function lineWidth(text) {
  if (!pen) pen = document.createElement('canvas').getContext('2d');
  pen.font = "700 44px Tomorrow, 'Trebuchet MS', sans-serif";
  return pen.measureText(text).width;
}

// The two pieces of the top line: "KICKOFF IN" on the left and the date on
// the right ("JAN 9", or NOW once the time has come). When both do not fit in
// the room, the IN goes first, then the date. A label too long even by itself
// is cut off with an ellipsis by the stylesheet.
function topLine(stage) {
  const date = stage.reached ? 'NOW' : monthName(stage.target) + ' ' + stage.target.getDate();
  const fits = text => lineWidth(text) + LINE_GAP + lineWidth(date) <= LINE_ROOM;

  const withIn = stage.label + ' IN';
  const label = !stage.reached && fits(withIn) ? withIn : stage.label;
  return { label: label, date: fits(label) ? date : '' };
}

function threatLevel(days) {
  if (days <= threat.criticalDays) return 'critical';
  if (days <= threat.tenseDays) return 'tense';
  return 'calm';
}

// True the first time a part is given a value and each time the value is
// different from the one before. The countdown runs every second, and almost
// everything on it stays the same from one second to the next, so each part
// is written only when this says it changed.
function isNew(state, name, value) {
  if (state.shown[name] === value) return false;
  state.shown[name] = value;
  return true;
}

// Shows a number, but only when it is different from the one shown. The
// first time it just appears. After that the new number slams in. Says
// whether it wrote anything.
function showNumber(state, name, text) {
  const first = state.shown[name] === undefined;
  if (!isNew(state, name, text)) return false;

  if (first) state[name].textContent = text;
  else frame.slam(state[name], text);
  return true;
}

// The words on the top line. Fitting them measures text, which is the one
// slow thing here, so it is done only when the words could be different: a new
// label, a new date, or the stage going from counting to NOW.
function drawTopLine(state, stage) {
  const key = [stage.label, stage.reached, stage.target ? stage.target.getTime() : 'none', fontLoads].join('|');
  if (key !== state.lineKey) {
    state.lineKey = key;
    // a message with no date has no IN and nothing to fit beside it
    state.line = stage.target ? topLine(stage) : { label: stage.label, date: '' };
  }

  if (isNew(state, 'label', state.line.label)) state.label.textContent = state.line.label;
  if (isNew(state, 'date', state.line.date)) state.date.textContent = state.line.date;
}

function refresh(element, now) {
  const state = states.get(element);
  const stage = currentStage(state.content.settings.countdown, now);
  const left = stage.target ? timeLeft(stage.target, now) : timeLeft(now, now);

  drawTopLine(state, stage);

  // Only the seconds change on most ticks, and each part is written only
  // when it is different from last time
  const daysChanged = showNumber(state, 'days', String(left.days));
  if (daysChanged) state.days.parentNode.classList.toggle('long', left.days > 99); // three digits do not fit at the big size
  const daysWord = left.days === 1 ? 'DAY' : 'DAYS';
  if (isNew(state, 'daysWord', daysWord)) state.daysWord.textContent = daysWord;

  showNumber(state, 'hours', pad(left.hours));
  showNumber(state, 'minutes', pad(left.minutes));
  showNumber(state, 'seconds', pad(left.seconds));

  const level = stage.target ? threatLevel(left.days) : 'calm';
  if (isNew(state, 'level', level)) element.dataset.level = level;

  // The bar under the numbers loses one block every 5 seconds and is full again at the next minute
  const lit = Math.floor((60 - left.seconds) / (60 / SEGMENTS));
  if (isNew(state, 'lit', lit)) {
    state.segments.forEach((segment, index) => {
      segment.classList.toggle('lit', index < lit);
    });
  }

  if (state.lastMinute !== null && state.lastMinute !== left.minutes) {
    frame.nudge(state.chevronLeft, state.chevronRight);
  }
  state.lastMinute = left.minutes;
}
