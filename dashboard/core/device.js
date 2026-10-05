// The Mini's name and addresses, shown on the wall only while the banner says
// OFFLINE. With no network access at the school, this is how someone finds the
// Mini to log in to it. The kiosk script on the Mini writes data/live/device.json
// every minute (deploy/scripts/kiosk.sh). Nothing is read while the status is
// not showing, and a missing file or bad JSON shows nothing.

import { liveFolder } from '../config.js';

export const deviceFile = liveFolder + 'device.json';
export const refreshSeconds = 60;

// The account to log in with, as printed in the ssh line
const loginName = 'hawktimus';

// What a name or address must look like to be shown. device.json is written by
// the Mini, but an odd value is dropped here, so the ssh line is always one
// that can be copied and run.
const hostnamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const addressPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const longestHostname = 24; // a longer name is cut, so the addresses after it still fit on the line

// The three values of device.json, each a string. Anything missing, not a
// string or not shaped like a name or address comes out as ''.
export function tidyDevice(raw) {
  const device = raw && typeof raw === 'object' ? raw : {};
  return {
    hostname: textMatching(device.hostname, hostnamePattern).slice(0, longestHostname),
    wifi: textMatching(device.wifi, addressPattern),
    tailscale: textMatching(device.tailscale, addressPattern),
  };
}

function textMatching(value, pattern) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return pattern.test(text) ? text : '';
}

// The address to log in to. Tailscale works from anywhere, so it comes first.
export function loginAddress(device) {
  return device.tailscale || device.wifi;
}

// What the screen says: up to two lines, and none at all when nothing is known.
//   hawktimus-mini · Wi-Fi 192.168.1.23 · Tailscale 100.101.102.103
//   ssh hawktimus@100.101.102.103
export function deviceLines(raw) {
  const device = tidyDevice(raw);

  const parts = [];
  if (device.hostname) parts.push(device.hostname);
  if (device.wifi) parts.push('Wi-Fi ' + device.wifi);
  if (device.tailscale) parts.push('Tailscale ' + device.tailscale);

  const lines = [];
  if (parts.length > 0) lines.push(parts.join(' · '));

  const address = loginAddress(device);
  if (address) lines.push('ssh ' + loginName + '@' + address);
  return lines;
}

// The strip on the screen is #device-info in index.html. While it is shown,
// the file is read again every minute.
let timer = null;
let requests = 0; // counts the reads, so an answer that comes after the strip was hidden is dropped

// Called with true while the OFFLINE status is showing and false otherwise.
// Calling it again with the same answer does nothing, so it is safe to call
// every time the content changes.
export function showDeviceInfo(shown) {
  if (shown === (timer !== null)) return;

  if (shown) {
    readDevice();
    timer = setInterval(readDevice, refreshSeconds * 1000);
  } else {
    clearInterval(timer);
    timer = null;
    requests += 1;
    draw([]);
  }
}

async function readDevice() {
  requests += 1;
  const mine = requests;

  let lines = [];
  try {
    const response = await fetch(deviceFile, { cache: 'no-store' });
    if (response.ok) lines = deviceLines(await response.json());
  } catch (error) {
    // no file yet, or it could not be read: show nothing
  }

  if (mine === requests) draw(lines);
}

// Two lines in the strip. The strip is hidden when there is nothing to say.
function draw(lines) {
  const strip = document.getElementById('device-info');
  if (!strip) return;

  const rows = strip.children;
  for (let index = 0; index < rows.length; index++) {
    const text = lines[index] || '';
    if (rows[index].textContent !== text) rows[index].textContent = text;
  }
  strip.hidden = lines.length === 0;
}
