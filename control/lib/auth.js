// The PIN, the cookie and the lockout. CONTROL_PIN is 6 to 12 digits in local.env. A good PIN gives a
// signed cookie (HMAC-SHA-256) that lasts 30 days. Six wrong tries from one address in ten minutes block
// that address for an hour. The secret is made on the first start and kept in a file with mode 600.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const cookieName = 'teletraan_control';
const cookieDays = 30;
export const triesAllowed = 6;
export const triesWindow = 10 * 60 * 1000;
export const blockTime = 60 * 60 * 1000;

const pinPattern = /^[0-9]{6,12}$/;

export function validPin(pin) {
  return pinPattern.test(String(pin || ''));
}

function same(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// options: getPin() the PIN now in local.env, secretFile, now() in ms
export function createAuth(options) {
  const getPin = options.getPin;
  const now = options.now || Date.now;
  const failures = new Map();
  const blocked = new Map();
  let secret = null;

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

  // The cookie holds the end time and a signature over the end time and the PIN, so a new PIN ends every old cookie
  function sign(expires, pin) {
    return crypto.createHmac('sha256', readSecret()).update(expires + '.' + pin).digest('hex');
  }

  function makeCookie(pin) {
    const expires = now() + cookieDays * 86400000;
    return expires + '.' + sign(expires, pin);
  }

  function checkCookie(value) {
    const pin = getPin();
    if (!validPin(pin)) return false;
    const found = /^([0-9]{10,16})\.([0-9a-f]{64})$/.exec(String(value || ''));
    if (!found) return false;
    if (Number(found[1]) < now()) return false;
    return same(found[2], sign(found[1], pin));
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
      return 0;
    }
    return Math.ceil((until - now()) / 1000);
  }

  // Tries a PIN. Returns { ok, cookie } or { ok: false, blockedSeconds, triesLeft, noPin }
  function attempt(address, pin) {
    const real = getPin();
    if (!validPin(real)) return { ok: false, noPin: true };
    const wait = blockedFor(address);
    if (wait > 0) return { ok: false, blockedSeconds: wait };

    if (same(String(pin || ''), real)) {
      failures.delete(address);
      return { ok: true, cookie: makeCookie(real) };
    }
    const recent = (failures.get(address) || []).filter(time => time > now() - triesWindow);
    recent.push(now());
    failures.set(address, recent);
    if (recent.length >= triesAllowed) {
      blocked.set(address, now() + blockTime);
      failures.delete(address);
      return { ok: false, blockedSeconds: Math.ceil(blockTime / 1000), triesLeft: 0 };
    }
    return { ok: false, triesLeft: triesAllowed - recent.length };
  }

  function cookieHeader(value) {
    return cookieName + '=' + value + '; Path=/control; HttpOnly; SameSite=Strict; Max-Age=' + cookieDays * 86400;
  }

  return { isAuthed: isAuthed, attempt: attempt, blockedFor: blockedFor, cookieHeader: cookieHeader, cookieOf: cookieOf, hasPin: () => validPin(getPin()) };
}

// The address a request came from. nginx sets X-Real-IP to the address it saw and nothing else sets it.
export function clientAddress(req) {
  const real = req.headers && req.headers['x-real-ip'];
  if (real && /^[0-9a-fA-F:.]{3,45}$/.test(real)) return real;
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}
