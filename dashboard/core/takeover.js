// Full screen messages that cover everything else: an alert typed in by the
// editors, and the announcements at set times of the day. While one is
// showing, the normal panels are paused and hidden.

import * as frame from '../frame.js';
import { mountPanel } from './panels.js';
import { pauseRotation, resumeRotation } from './schedule.js';
import { hasText } from './text.js';
import { parseLocalDateTime, pad } from './time.js';

const stage = document.getElementById('stage');
let running = null; // 'alert' or 'announcement' while something covers the screen
let alertInterrupts = false; // an alert came on while an announcement was showing
let lastAnnouncement = ''; // which announcement ran last, so it runs once
let alertCount = 0; // how many alerts have started since the page loaded

// True while an alert or an announcement covers the screen
export function takeoverRunning() {
  return running !== null;
}

// How many alerts have started so far. A demo (core/demo.js) counts them, so it
// can tell that a real alert came and took the screen from it.
export function alertsStarted() {
  return alertCount;
}

// One function that is called each time an alert or announcement starts or
// ends, so the night screen (core/night-screen.js) can step aside at once and
// come back at once, and not at its next look a second later.
let watcher = null;

export function watchTakeovers(listener) {
  watcher = listener;
}

function tellWatcher() {
  try {
    if (watcher) watcher();
  } catch (error) {
    console.error('Something watching the alerts failed', error);
  }
}

// Checks every second whether an alert or an announcement should start.
// getContent() returns the newest content.
export function startTakeovers(getContent) {
  frame.onSecond(now => {
    const settings = getContent().settings;

    // An alert overrides everything, so it ends a running announcement early
    if (running === 'announcement' && alertWanted(settings, now)) alertInterrupts = true;
    if (running) return;

    if (alertWanted(settings, now)) {
      runAlert(getContent);
      return;
    }

    const due = dueAnnouncement(settings, now);
    if (due) {
      lastAnnouncement = due.key;
      runAnnouncement(due.config, getContent);
    }
  });
}

function alertWanted(settings, now) {
  const alert = settings.alert;
  if (!alert || !alert.on) return false;

  const until = parseLocalDateTime(alert.until);
  return !until || now < until;
}

// The announcement that should start this very second, or null.
// It must start within 3 seconds of its time, so a page that is reloaded
// at 2:30:20 does not start one late. One badly filled in announcement
// must not stop the others, so each is checked on its own.
function dueAnnouncement(settings, now) {
  const today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());

  for (const config of settings.announcements || []) {
    try {
      if (config.show === false || !(config.days || []).includes(now.getDay())) continue;

      const time = config.time.split(':');
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(time[0]), Number(time[1]), 0);
      const late = now - target;
      const key = today + ' ' + config.time;

      if (late >= 0 && late < 3000 && key !== lastAnnouncement) {
        return { config: config, key: key };
      }
    } catch (error) {
      console.error('An announcement setting could not be read', error);
    }
  }
  return null;
}

// Shows a panel over the screen. Once it has arrived the normal screen is
// hidden underneath, so it costs nothing while it is covered.
async function cover(id, content) {
  const element = mountPanel(id, content);
  await frame.enter(element);
  stage.style.visibility = 'hidden';
  return element;
}

async function uncover(element) {
  stage.style.visibility = '';
  await frame.exit(element);
  element.remove();
}

// One full screen panel swaps for another with the normal screen kept hidden
async function replace(element, id, content) {
  await frame.exit(element);
  element.remove();
  return cover(id, content);
}

function begin(kind) {
  running = kind;
  pauseRotation();
  tellWatcher();
}

function finish() {
  stage.style.visibility = '';
  document.getElementById('overlay').innerHTML = '';
  alertInterrupts = false;
  resumeRotation();
  running = null;
  tellWatcher();
}

function withAnnouncement(content, text, phase) {
  return Object.assign({}, content, { announcement: { text: text, phase: phase } });
}

// An alert stays until the editors turn it off or its "until" time passes.
// If they change its words while it is showing, the new words replace the old.
async function runAlert(getContent) {
  alertCount += 1;
  begin('alert');
  try {
    const element = await cover('alert', getContent());
    await keepAlertShowing(element, getContent);
  } catch (error) {
    console.error('The alert failed', error);
  }
  finish();
}

// Keeps the alert on screen while it is wanted, then takes it away
async function keepAlertShowing(first, getContent) {
  const key = () => JSON.stringify(getContent().settings.alert);
  let shownKey = key();
  let element = first;

  while (alertWanted(getContent().settings, new Date())) {
    await frame.wait(1000);

    // switched off during that second: leave now, with no flash of an empty alert
    if (!alertWanted(getContent().settings, new Date())) break;

    if (key() !== shownKey) {
      shownKey = key();
      element = await replace(element, 'alert', getContent());
    }
  }
  await uncover(element);
}

// Waits, but ends early if an alert needs the screen or stopped() says so
async function waitUnlessInterrupted(seconds, stopped) {
  let left = seconds * 1000;
  while (left > 0 && !stopped()) {
    await frame.wait(250);
    left -= 250;
  }
}

// The announcement: the first line, then the second, then back to normal.
// The old television effect plays in between. A second line left empty means
// there is only the first. A demo (core/demo-screens.js) passes shouldStop, a
// function that says true when the announcement should end early.
export async function runAnnouncement(config, getContent, shouldStop) {
  const stopped = () => alertInterrupts || Boolean(shouldStop && shouldStop());

  begin('announcement');
  try {
    let element = await cover('announcement', withAnnouncement(getContent(), config.title, 'title'));
    await waitUnlessInterrupted(config.titleSeconds, stopped);

    if (hasText(config.followUp) && !stopped()) {
      frame.playCrt();
      await frame.wait(400);
      element = await replace(element, 'announcement', withAnnouncement(getContent(), config.followUp, 'follow-up'));
      await waitUnlessInterrupted(config.followUpSeconds, stopped);
    }

    if (alertInterrupts && alertWanted(getContent().settings, new Date())) {
      // The alert takes the screen straight from the announcement, so the
      // normal screen is not seen for a moment in between
      alertCount += 1;
      running = 'alert';
      alertInterrupts = false;
      element = await replace(element, 'alert', getContent());
      await keepAlertShowing(element, getContent);
    } else {
      await uncover(element);
    }
  } catch (error) {
    console.error('The announcement failed', error);
  }
  finish();
}
