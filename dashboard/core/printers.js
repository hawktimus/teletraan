// The printer frame: which printers are printing right now, and the steps that put them in the rotation. These are the plain
// functions and the reader. computer/scripts/printer-sync.mjs, on the Teletraan computer, watches the 3D printers and writes
// printers/status.json into the data folder (docs/printers.md). The screen reads only that file and the camera picture
// printers/<id>/frame.jpg beside it, both of its own address.
//
// A printer that is printing gets a step in the large panel's rotation (the Printer panel: its camera) paired with a step in the
// small panel (Printer file: the file, the times). Each printing printer has its turn, two minutes long. Nothing is added while no
// printer prints, so the rotation is the rotation it always was. The steps are mixed into the large panel's list each time it is
// read (withPrinters, called by shell-content.js), as the competition cards are (core/competition.js).
//
// Nothing here breaks the screen. A file that is missing, old or broken means no printer is printing.

import { liveFolder } from '../config.js';
import { mixIn } from './competition.js';
import { isRecord } from './text.js';
import { dateIn, timeZoneOf } from './theme.js';

export const printersFile = 'printers/status.json';

// How long a printer takes the large panel each time its turn comes
export const printerSeconds = 120;

// The file is called old after this long, as the service writes it every 2 seconds. An old file means the service has stopped,
// and its last word, that a printer was printing, can no longer be believed.
export const staleSeconds = 30;

// How often the screen reads the file
const refreshSeconds = 3;

const most = { printers: 8, name: 24, file: 80 };

function number(value) {
  return typeof value === 'number' && isFinite(value) ? value : null;
}

function text(value, longest) {
  return typeof value === 'string' ? value.trim().slice(0, longest) : '';
}

function time(value) {
  if (typeof value !== 'string') return null;
  const moment = Date.parse(value);
  return isNaN(moment) ? null : moment;
}

// One printer of the file, tidy, or null when it has no id
function tidyPrinter(raw) {
  if (!isRecord(raw)) return null;

  const id = typeof raw.id === 'string' && /^[a-z0-9-]{1,12}$/.test(raw.id) ? raw.id : '';
  if (id === '') return null;

  const printer = { id: id, name: text(raw.name, most.name) || 'Printer ' + id, online: raw.online === true, printing: raw.printing === true && raw.online === true, state: text(raw.state, 20) };
  if (!printer.printing) return printer;

  const asOf = time(raw.asOf);
  return Object.assign(printer, {
    file: text(raw.file, most.file),
    progress: number(raw.progress),
    layer: number(raw.layer),
    totalLayer: number(raw.totalLayer),
    elapsedSeconds: Math.max(0, number(raw.elapsedSeconds) || 0),
    remainingSeconds: number(raw.remainingSeconds) === null ? null : Math.max(0, number(raw.remainingSeconds)),
    totalSeconds: number(raw.totalSeconds),
    asOf: asOf,
    etaAt: time(raw.etaAt),
    camera: raw.camera === true,
  });
}

// The file as the screen keeps it: { at, printers }, at being when the service wrote it, in milliseconds. A file with no time,
// or not a file of ours, gives null.
export function tidyPrinters(raw) {
  if (!isRecord(raw) || !Array.isArray(raw.printers)) return null;

  const at = time(raw.updatedAt);
  if (at === null) return null;
  return { at: at, printers: raw.printers.map(tidyPrinter).filter(printer => printer !== null).slice(0, most.printers) };
}

let current = null;
let sampleMode = false;

export function setPrinters(data) {
  current = data;
}

export function currentPrinters() {
  return current;
}

// The printers that are printing, in the order of the file, when the file is fresh
export function printingPrinters(now = new Date(), data = current) {
  if (!data || now.getTime() - data.at > staleSeconds * 1000) return [];
  return data.printers.filter(printer => printer.printing);
}

export function printerById(id, now = new Date(), data = current) {
  return printingPrinters(now, data).find(printer => printer.id === id) || null;
}

// The printer a page is for: the one the step names, or the first that is printing when the step names none (a row put in the
// Rotation by hand has no printer in it)
export function printerOf(page, now = new Date()) {
  const wanted = isRecord(page) && typeof page.printer === 'string' ? page.printer : '';
  return (wanted !== '' ? printerById(wanted, now) : null) || (wanted === '' ? printingPrinters(now)[0] || null : null);
}

export function hasPrinter(page, now = new Date()) {
  return printerOf(page, now) !== null;
}

// The printer with this id while it is printing, or null once it has stopped (or the file has gone old). A page that is on screen
// asks this every second, to know when to say that the print has ended.
export function printerStillPrinting(id, now = new Date()) {
  return printerById(id, now);
}

// Runs update every so many seconds while the page is on screen. The page is made away from the screen, so the first runs wait
// until it has been put there; once it has been on screen and has left, or if it never arrives (the step was skipped), the timer
// stops. A fault in update is never allowed to stop the screen.
export function keepFresh(element, update, seconds = 1) {
  const started = Date.now();
  let seen = false;

  const timer = setInterval(() => {
    if (element.isConnected) {
      seen = true;
    } else if (seen || Date.now() - started > 10 * 60 * 1000) {
      clearInterval(timer);
      return;
    } else {
      return;
    }

    try {
      update();
    } catch (error) {
      console.error('The printer frame could not update', error);
    }
  }, Math.max(0.1, seconds) * 1000);
  return timer;
}

// The steps for the printers that are printing. A step is the large panel's step, and its side is the small panel's.
export function printerSteps(now = new Date(), data = current) {
  if (sampleMode) return [];

  return printingPrinters(now, data).map(printer => ({
    panel: 'printer',
    side: 'printer-file',
    show: true,
    seconds: printerSeconds,
    page: { printer: printer.id },
    sidePage: { printer: printer.id },
  }));
}

let complained = false; // a problem is written in the console once, not at every page

// The playlist of the large panel with the printers that are printing in it, spread evenly among the panels. A problem leaves the
// playlist as it is, because the rotation asks for it each time and must never be stopped by it.
export function withPrinters(playlist, content, now = new Date()) {
  try {
    return mixIn(playlist, printerSteps(now), false);
  } catch (error) {
    if (!complained) console.error('The printer frame could not be planned, so the panels run without it', error);
    complained = true;
    return playlist;
  }
}

// The numbers the panels draw, as they are at this moment. The service writes the file every 2 seconds, and a number is worked
// out forward from when it was written (asOf) for as long as that is believable, so the clock on the wall runs smoothly.
export function liveTimes(printer, now = new Date()) {
  const since = printer.asOf === null ? 0 : Math.max(0, Math.min(staleSeconds, Math.round((now.getTime() - printer.asOf) / 1000)));
  const elapsed = printer.elapsedSeconds + since;
  const remaining = printer.remainingSeconds === null ? null : Math.max(0, printer.remainingSeconds - since);
  const total = remaining === null ? null : elapsed + remaining;

  return {
    elapsed: elapsed,
    remaining: remaining,
    progress: total !== null && total > 0 ? Math.max(0, Math.min(100, Math.round((elapsed / total) * 100))) : printer.progress,
    etaAt: printer.etaAt !== null ? printer.etaAt : remaining === null ? null : now.getTime() + remaining * 1000,
  };
}

// 2H 05M, 45M, 40S. Nothing known is --.
export function durationWords(seconds) {
  if (seconds === null || seconds === undefined || !isFinite(seconds)) return '--';

  const whole = Math.max(0, Math.round(seconds));
  if (whole >= 3600) return Math.floor(whole / 3600) + 'H ' + String(Math.floor((whole % 3600) / 60)).padStart(2, '0') + 'M';
  if (whole >= 60) return Math.floor(whole / 60) + 'M';
  return whole + 'S';
}

// The time of day a print will be done, in the time zone of the Look page: 3:42 PM, TOMORROW 1:10 AM, or the weekday and the
// time when it is further off. Nothing known is --.
export function finishWords(etaAt, now, zone) {
  if (etaAt === null || etaAt === undefined || !isFinite(etaAt)) return '--';

  const moment = new Date(etaAt);
  const clock = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit', hour12: true }).format(moment).replace(/\s/g, ' ');
  const today = dateIn(zone, now);
  const day = dateIn(zone, moment);
  if (day === today) return clock;

  const tomorrow = dateIn(zone, new Date(now.getTime() + 24 * 3600 * 1000));
  if (day === tomorrow) return 'TOMORROW ' + clock;
  return new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short' }).format(moment).toUpperCase() + ' ' + clock;
}

export function zoneOf(content) {
  return timeZoneOf(content);
}

// The address of the camera picture of a printer. The number makes the browser ask again.
export function frameAddress(printerId, stamp = Date.now()) {
  return liveFolder + 'printers/' + printerId + '/frame.jpg?t=' + stamp;
}

// Reading the file

// Gives { data } when the file was read (data is null when it is missing or not usable), and null when the read failed, so the
// caller keeps what it had. fetchFunction is fetch.
export async function readPrinters(fetchFunction, folder = liveFolder, seconds = 10) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), seconds * 1000) : null;

  try {
    const answer = await fetchFunction(folder + printersFile, { cache: 'no-store', signal: controller ? controller.signal : undefined });
    if (answer.status === 404) return { data: null };
    if (!answer.ok) return null;
    try {
      return { data: tidyPrinters(await answer.json()) };
    } catch (error) {
      return { data: null };
    }
  } catch (error) {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Starts the reader: the file every 3 seconds. A page with ?sample=1 draws no printer. Never throws.
export async function startPrinters(fetchFunction, useSample) {
  sampleMode = useSample === true;
  if (sampleMode) return;

  async function again() {
    const result = await readPrinters(fetchFunction);
    if (result) current = result.data;
  }
  await again();
  setInterval(again, refreshSeconds * 1000);
}
