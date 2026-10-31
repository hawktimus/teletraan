// Draws the four dots (core/dots.js) into #status-dots and keeps them current. They are always
// there, in every view and theme, and say nothing in words. The sample content has no real reads,
// so they stay hidden on ?sample=1.

import { dotNames, dotStates } from './dots.js';
import { lastContentRead } from './content.js';
import { networkReading, sanityReadTime, watchSyncStatus } from './sync-status.js';

const redrawSeconds = 5;

// A dot is made when it has something to say, so a file without a network member draws only three
function dotFor(host, name) {
  let dot = host.querySelector('[data-dot="' + name + '"]');
  if (!dot) {
    dot = document.createElement('span');
    dot.className = 'status-dot';
    dot.dataset.dot = name;
    host.appendChild(dot);
  }
  return dot;
}

export function startDots(getContent, isSample) {
  const host = document.getElementById('status-dots');
  if (!host || isSample) return;

  host.textContent = '';
  host.hidden = false;
  watchSyncStatus(() => {}); // keeps the status file read, for the Sanity dot below

  function redraw() {
    const content = getContent() || {};
    const read = lastContentRead();
    const mini = content.mini || {};
    const states = dotStates({
      monday: content.monday,
      everyMinutes: content.settings ? content.settings.mondayEveryMinutes : undefined,
      calendarAt: mini.lastCalendarSyncAt,
      calendarErrors: mini.calendarErrors,
      // The dot says how fresh the sync service's read of Sanity is. Without the status file (a laptop) it is the local read.
      sanityAt: sanityReadTime() || read.at,
      sanityFailed: false,
      network: networkReading(),
    }, new Date());

    dotNames.forEach(name => {
      if (!states[name]) {
        const old = host.querySelector('[data-dot="' + name + '"]');
        if (old) old.remove();
        return;
      }
      const dot = dotFor(host, name);
      dot.dataset.state = states[name].color;
      dot.title = states[name].reason;
    });
  }

  redraw();
  setInterval(redraw, redrawSeconds * 1000);
}
