// The wait for the screen of an install that runs from the command line (control/bin/install-tree.js, which the git push and
// the Mac tool use). That install is a program of its own, so the screen's reports, which go to the running control service, never
// reach it, and "the screen reports the new build" could not come true: every such install was rolled back. The running service
// writes one line to the control log for each page load of the wall ("wall page load at <time>: ..."), so this reads the log and
// takes a page load that began after the screen was restarted as the screen coming up on the new release. The page is loaded from
// the release that was switched to, so a fresh load is the new files. The page's own build is not in the log.

import fs from 'node:fs';

const loadLine = /wall page load at (\d{4}-\d\d-\d\dT[\d:.]+Z)/g;
// A page that began a little before the restart call returned still counts: the clocks are the same computer's, so this is only slack
const slackMs = 2000;

// True when the log text has a page load at or after sinceMs
export function wallLoadedSince(text, sinceMs) {
  const body = String(text || '');
  let match;
  loadLine.lastIndex = 0;
  while ((match = loadLine.exec(body)) !== null) {
    const at = Date.parse(match[1]);
    if (Number.isFinite(at) && at >= sinceMs - slackMs) return true;
  }
  return false;
}

// The text of the end of the log, at most the last 64 KB, or '' when it cannot be read
export function readLogTail(file) {
  try {
    const size = fs.statSync(file).size;
    const length = Math.min(size, 64 * 1024);
    const fd = fs.openSync(file, 'r');
    try {
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, size - length);
      return buffer.toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch (error) {
    return '';
  }
}

// A waitForBuild for the install: getSince() gives the time (ms) the screen was restarted, 0 while it has not been. Checks every 2 seconds.
export function makeLogWaiter(file, getSince, options = {}) {
  const read = options.read || (() => readLogTail(file));
  const pause = options.pause || (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  const clock = options.clock || Date.now;

  return async function waitForBuild(build, milliseconds) {
    const end = clock() + milliseconds;
    while (clock() < end) {
      const since = getSince();
      if (since > 0 && wallLoadedSince(read(), since)) return true;
      await pause(2000);
    }
    return false;
  };
}
