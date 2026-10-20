// The PIN, the cookie and the lockout. The page accepts the two PINs in fixedPins and nothing else. If
// CONTROL_PIN is in local.env (typed by hand over SSH, 4 to 12 digits), the page accepts only that one.
// A good PIN gives a signed cookie (HMAC-SHA-256) that lasts 30 days. Six wrong tries from one address in
// ten minutes block that address for an hour. The tries are kept in a file (options.stateFile), so a restart of the
// service or of the computer does not give an attacker six fresh tries. The secret is made on the first start and
// kept in a file with mode 600.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const cookieName = 'teletraan_control';
const cookieDays = 30;
export const triesAllowed = 6;
export const triesWindow = 10 * 60 * 1000;
export const blockTime = 60 * 60 * 1000;

// 3229 and 3426 are the two team numbers
export const fixedPins = ['3229', '3426'];
const pinPattern = /^[0-9]{4,12}$/;

export function validPin(pin) {
  return pinPattern.test(String(pin || ''));
}

function same(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// options: getOverride() the CONTROL_PIN now in local.env or nothing, secretFile, now() in ms
export function createAuth(options) {
  const getOverride = options.getOverride || (() => '');
  const now = options.now || Date.now;
  const failures = new Map();
  const blocked = new Map();
  let secret = null;

  // The tries and blocks survive a restart. A file that is missing or damaged means a clean start, and a file that
  // cannot be written must not stop a sign-in.
  function loadTries() {
    if (!options.stateFile) return;
    try {
      const saved = JSON.parse(fs.readFileSync(options.stateFile, 'utf8'));
      Object.keys(saved.blocked || {}).forEach(address => {
        if (Number(saved.blocked[address]) > now()) blocked.set(address, Number(saved.blocked[address]));
      });
      Object.keys(saved.failures || {}).forEach(address => {
        const recent = (Array.isArray(saved.failures[address]) ? saved.failures[address] : []).map(Number).filter(time => time > now() - triesWindow);
        if (recent.length) failures.set(address, recent);
      });
    } catch (error) {
      // no saved tries
    }
  }

  function saveTries() {
    if (!options.stateFile) return;
    try {
      const recent = {};
      failures.forEach((times, address) => {
        const live = times.filter(time => time > now() - triesWindow);
        if (live.length) recent[address] = live;
      });
      const saved = { blocked: Object.fromEntries(blocked), failures: recent };
      fs.mkdirSync(path.dirname(options.stateFile), { recursive: true });
      fs.writeFileSync(options.stateFile + '.new', JSON.stringify(saved), { mode: 0o600 });
      fs.renameSync(options.stateFile + '.new', options.stateFile);
    } catch (error) {
      // the tries still count in memory
    }
  }
  loadTries();

  function readSecret() {
    if (secret) return secret;
    try {
      secret = fs.readFileSync(options.secretFile, 'utf8').trim();
    } catch (error) {
      secret = '';
    }
    if (secret.length < 32) {
      secret = crypto.randomBytes(32).toString('hex');
      fs.mkdirSync(path.dirname(options.secretFile), { recursive: true });
      fs.writeFileSync(options.secretFile, secret + '\n', { mode: 0o600 });
      fs.chmodSync(options.secretFile, 0o600);
    }
    return secret;
  }

  // The PINs that open the page now. A usable CONTROL_PIN replaces the two fixed ones; one that is not 4 to 12
  // digits is ignored, so a typing mistake cannot lock everybody out.
  function acceptedPins() {
    const typed = String(getOverride() || '');
    return validPin(typed) ? [typed] : fixedPins;
  }

  // The cookie holds the end time and a signature over the end time and the PIN, so a changed CONTROL_PIN ends every old cookie
  function sign(expires, pin) {
    return crypto.createHmac('sha256', readSecret()).update(expires + '.' + pin).digest('hex');
  }

  function makeCookie(pin) {
    const expires = now() + cookieDays * 86400000;
    return expires + '.' + sign(expires, pin);
  }

  function checkCookie(value) {
    const found = /^([0-9]{10,16})\.([0-9a-f]{64})$/.exec(String(value || ''));
    if (!found) return false;
    if (Number(found[1]) < now()) return false;
    let good = false;
    acceptedPins().forEach(pin => {
      if (same(found[2], sign(found[1], pin))) good = true;
    });
    return good;
  }

  function cookieOf(req) {
    const header = (req.headers && req.headers.cookie) || '';
    for (const part of header.split(';')) {
      const index = part.indexOf('=');
      if (index > 0 && part.slice(0, index).trim() === cookieName) return part.slice(index + 1).trim();
    }
    return '';
  }

  function isAuthed(req) {
    return checkCookie(cookieOf(req));
  }

  // Seconds this address is blocked for, or 0
  function blockedFor(address) {
    const until = blocked.get(address);
    if (!until) return 0;
    if (until <= now()) {
      blocked.delete(address);
      saveTries();
      return 0;
    }
    return Math.ceil((until - now()) / 1000);
  }

  // Tries a PIN. Returns { ok, cookie } or { ok: false, blockedSeconds, triesLeft }
  function attempt(address, pin) {
    const wait = blockedFor(address);
    if (wait > 0) return { ok: false, blockedSeconds: wait };

    const typed = String(pin || '');
    let match = '';
    acceptedPins().forEach(real => {
      if (same(typed, real)) match = real;
    });
    if (match) {
      if (failures.delete(address)) saveTries();
      return { ok: true, cookie: makeCookie(match) };
    }
    const recent = (failures.get(address) || []).filter(time => time > now() - triesWindow);
    recent.push(now());
    failures.set(address, recent);
    if (recent.length >= triesAllowed) {
      blocked.set(address, now() + blockTime);
      failures.delete(address);
      saveTries();
      return { ok: false, blockedSeconds: Math.ceil(blockTime / 1000), triesLeft: 0 };
    }
    saveTries();
    return { ok: false, triesLeft: triesAllowed - recent.length };
  }

  function cookieHeader(value) {
    return cookieName + '=' + value + '; Path=/control; HttpOnly; SameSite=Strict; Max-Age=' + cookieDays * 86400;
  }

  return { isAuthed: isAuthed, attempt: attempt, blockedFor: blockedFor, cookieHeader: cookieHeader, cookieOf: cookieOf };
}

// The address a request came from. nginx sets X-Real-IP to the address it saw and nothing else sets it.
export function clientAddress(req) {
  const real = req.headers && req.headers['x-real-ip'];
  if (real && /^[0-9a-fA-F:.]{3,45}$/.test(real)) return real;
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

// A call that changes something must come from the page itself. A browser sends Origin on every POST and names the
// site that made the call; when it is another address than the one asked, the call is refused. A call with no
// Origin (the Mac tool, curl) is not made by a web page, and still needs the cookie.
export function sameOrigin(req) {
  const headers = req.headers || {};
  const site = headers['sec-fetch-site'];
  if (site === 'cross-site') return false;
  const origin = headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === String(headers.host || '');
  } catch (error) {
    return false;
  }
}
