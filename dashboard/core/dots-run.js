// Draws the three dots (core/dots.js) into #status-dots and keeps them current. They are always
// there, in every view and theme, and say nothing in words. The sample content has no real reads,
// so they stay hidden on ?sample=1.

import { dotNames, dotStates } from './dots.js';
import { lastContentRead } from './content.js';

const redrawSeconds = 5;

function build(host) {
  host.textContent = '';
  dotNames.forEach(name => {
    const dot = document.createElement('span');
    dot.className = 'status-dot';
    dot.dataset.dot = name;
    dot.dataset.state = 'amber';
    host.appendChild(dot);
  });
}

export function startDots(getContent, isSample) {
  const host = document.getElementById('status-dots');
  if (!host || isSample) return;

  build(host);
  host.hidden = false;

  function redraw() {
    const content = getContent() || {};
    const read = lastContentRead();
    const mini = content.mini || {};
    const states = dotStates({
      monday: content.monday,
      everyMinutes: content.settings ? content.settings.mondayEveryMinutes : undefined,
      calendarAt: mini.lastCalendarSyncAt,
      calendarErrors: mini.calendarErrors,
      sanityAt: read.at,
      sanityFailed: read.failed,
    }, new Date());

    dotNames.forEach(name => {
      const dot = host.querySelector('[data-dot="' + name + '"]');
      if (!dot) return;
      dot.dataset.state = states[name].color;
      dot.title = states[name].reason;
    });
  }

  redraw();
  setInterval(redraw, redrawSeconds * 1000);
}
