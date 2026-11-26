// The printer service: watches the Elegoo Centauri Carbon printers on the network and writes what the dashboard needs into
// the data folder of the Teletraan computer (docs/printers.md).
//
//   <data>/printers/status.json         one entry for each printer: is it printing, what, how far, how long to go
//   <data>/printers/<id>/frame.jpg      the newest picture of the printer's camera, kept only while it prints
//
// The printers speak SDCP v3 over a WebSocket (ws://<ip>:3030/websocket, a JSON message each way) and give their camera as
// a Motion JPEG stream (http://<ip>:3031/video). The dashboard reads only files of its own address, so this service turns the
// two into the two kinds of file above. The addresses of the printers are in the printers file (computer/config/printers.example.json),
// never in the repository.
//
// Careful with the printers: each takes only a few WebSocket clients at once, a camera stream only a few, and a command it does
// not know can stop a print. So this service holds ONE connection for each printer, asks only for the status (command 0) and, if
// the camera needs it, to switch the camera on (command 386), and it opens the camera only while the printer is printing.
//
// Nothing here may stop the screen: a printer that is off, away or silent is simply "offline", and the dashboard shows no
// printer frame for it.

import crypto from 'node:crypto';
import dgram from 'node:dgram';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { WebSocketLite } from './printer-ws.mjs';

// SDCP print states of the Centauri Carbon (PrintInfo.Status). Only 13 is printing.
export const printingCode = 13;
const stateNames = { 0: 'idle', 1: 'homing', 5: 'pausing', 6: 'paused', 7: 'stopping', 8: 'stopped', 9: 'complete', 13: 'printing', 14: 'error', 15: 'leveling', 16: 'preheating' };
const notPrinting = [0, 5, 6, 7, 8, 9, 10, 14, 20];

// A printer that has said nothing for this long is offline
export const onlineSeconds = 20;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function number(value) {
  return typeof value === 'number' && isFinite(value) ? value : null;
}

// The printers file, tidy: { id, name, ip, port, videoPort, mainboardId } for each printer that has a valid id and address
export function tidyPrinters(raw) {
  const list = isRecord(raw) && Array.isArray(raw.printers) ? raw.printers : [];
  const seen = new Set();
  const printers = [];

  list.forEach((item, index) => {
    if (!isRecord(item) || printers.length >= 8) return;

    const id = typeof item.id === 'string' && /^[a-z0-9-]{1,12}$/.test(item.id) ? item.id : String(index + 1);
    const ip = typeof item.ip === 'string' ? item.ip.trim() : '';
    const octets = ip.split('.');
    if (octets.length !== 4 || !octets.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255) || seen.has(id)) return;

    const name = typeof item.name === 'string' && item.name.trim() !== '' ? item.name.trim().slice(0, 24) : 'Printer ' + id;
    const port = value => (Number.isInteger(value) && value > 0 && value < 65536 ? value : null);
    seen.add(id);
    printers.push({
      id: id,
      name: name,
      ip: ip,
      port: port(item.port) || 3030,
      videoPort: port(item.videoPort) || 3031,
      mainboardId: typeof item.mainboardId === 'string' && /^[0-9a-f]{8,40}$/i.test(item.mainboardId) ? item.mainboardId : '',
    });
  });
  return printers;
}

// The name of a file as people read it: no folder, no .gcode
export function fileLabel(name) {
  if (typeof name !== 'string') return '';
  const base = name.trim().split(/[\\/]/).pop();
  return base.replace(/\.(gcode|3mf|goo|ctb)$/i, '').slice(0, 80);
}

// The status of a printer from a message it sent, or null when the message holds none
function statusOf(message) {
  if (!isRecord(message)) return null;
  if (isRecord(message.Status)) return message.Status;
  return isRecord(message.Data) && isRecord(message.Data.Status) ? message.Data.Status : null;
}

// What one status message says: { printing, state, file, progress, layer, totalLayer, elapsedSeconds, remainingSeconds,
// totalSeconds, speedPct, mainboardId, at }, or null when it is not a status message. at is the time in milliseconds.
//
// The printer counts ticks in seconds. A number too big for that many seconds (more than a week) is taken as milliseconds, so a
// firmware that changes the unit does not give a print of a thousand hours. When the printer has no total, the total is worked out
// from the time so far and the progress it reports.
export function snapshotOf(message, now = new Date()) {
  const status = statusOf(message);
  if (!status) return null;

  const info = isRecord(status.PrintInfo) ? status.PrintInfo : {};
  const machine = Array.isArray(status.CurrentStatus) ? status.CurrentStatus.filter(item => typeof item === 'number') : [];
  const code = number(info.Status);
  const file = fileLabel(info.Filename);
  // 13 is printing. Where a firmware reports the machine as printing (1) with a file and no code that says otherwise, so is that.
  const printing = code === printingCode || (machine.includes(1) && file !== '' && (code === null || !notPrinting.includes(code)));

  const rawElapsed = Math.max(0, number(info.CurrentTicks) || 0);
  const rawTotal = Math.max(0, number(info.TotalTicks) || 0);
  const scale = Math.max(rawElapsed, rawTotal) > 7 * 86400 ? 1000 : 1;
  const elapsed = rawElapsed / scale;
  let total = rawTotal / scale;

  const reported = number(info.Progress);
  let progress = total > 0 ? (elapsed / total) * 100 : reported;
  if (total === 0 && reported !== null && reported > 0 && elapsed > 0) total = (elapsed * 100) / reported;
  if (progress !== null) progress = Math.max(0, Math.min(100, Math.round(progress)));

  return {
    printing: printing,
    state: printing ? 'printing' : stateNames[code] || (code === null ? 'idle' : 'other'),
    file: file,
    progress: progress,
    layer: number(info.CurrentLayer),
    totalLayer: number(info.TotalLayer),
    elapsedSeconds: Math.round(elapsed),
    remainingSeconds: total > 0 ? Math.max(0, Math.round(total - elapsed)) : null,
    totalSeconds: total > 0 ? Math.round(total) : null,
    speedPct: number(info.PrintSpeedPct),
    mainboardId: typeof message.MainboardID === 'string' ? message.MainboardID : '',
    at: now.getTime(),
  };
}

// What the dashboard may know about a printer: no address, no board id. Job fields only while it is printing.
export function publicEntry(config, state, now = Date.now()) {
  const online = state.lastMessageAt > 0 && now - state.lastMessageAt <= onlineSeconds * 1000;
  const snap = online ? state.snapshot : null;
  const entry = { id: config.id, name: config.name, online: online, printing: false, state: snap ? snap.state : 'offline' };
  if (!snap || !snap.printing) return entry;

  return Object.assign(entry, {
    printing: true,
    file: snap.file,
    progress: snap.progress,
    layer: snap.layer,
    totalLayer: snap.totalLayer,
    elapsedSeconds: snap.elapsedSeconds,
    remainingSeconds: snap.remainingSeconds,
    totalSeconds: snap.totalSeconds,
    speedPct: snap.speedPct,
    asOf: new Date(snap.at).toISOString(),
    etaAt: snap.remainingSeconds === null ? null : new Date(snap.at + snap.remainingSeconds * 1000).toISOString(),
    camera: state.frameAt > 0 && now - state.frameAt < 15000,
    frameN: state.frameN,
  });
}

// Cuts a Motion JPEG stream into pictures. The function it returns takes the chunks as they come and calls onFrame with each
// whole JPEG (from its FF D8 to its FF D9). A picture too big to be one is dropped.
export function createFrameSplitter(onFrame, largest = 4 * 1024 * 1024) {
  const start = Buffer.from([0xff, 0xd8]);
  const end = Buffer.from([0xff, 0xd9]);
  let buffer = Buffer.alloc(0);

  return chunk => {
    buffer = Buffer.concat([buffer, chunk]);

    for (;;) {
      const from = buffer.indexOf(start);
      if (from < 0) {
        buffer = buffer.subarray(Math.max(0, buffer.length - 1));
        return;
      }
      const to = buffer.indexOf(end, from + 2);
      if (to < 0) {
        buffer = buffer.subarray(from);
        if (buffer.length > largest) buffer = Buffer.alloc(0);
        return;
      }
      onFrame(buffer.subarray(from, to + 2));
      buffer = buffer.subarray(to + 2);
    }
  };
}

function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(temporary, data);
  fs.renameSync(temporary, file);
}

// Asks a printer for its board id with the discovery message of the SDCP protocol. '' when it does not answer.
export function discover(ip, port = 3000, seconds = 3) {
  return new Promise(resolve => {
    const socket = dgram.createSocket('udp4');
    const done = value => {
      clearTimeout(timer);
      try {
        socket.close();
      } catch (error) {
        // already closed
      }
      resolve(value);
    };
    const timer = setTimeout(() => done(''), seconds * 1000);

    socket.on('error', () => done(''));
    socket.on('message', buffer => {
      try {
        const answer = JSON.parse(buffer.toString('utf8'));
        const id = isRecord(answer) && isRecord(answer.Data) ? answer.Data.MainboardID : '';
        done(typeof id === 'string' ? id : '');
      } catch (error) {
        done('');
      }
    });
    socket.send('M99999', port, ip, error => {
      if (error) done('');
    });
  });
}

// One printer: its connection, its status and its camera. options: dataDir, log, pollMs, frameMs, retryMs, graceMs.
export function createMonitor(config, options) {
  const settings = Object.assign({ log: () => {}, pollMs: 4000, frameMs: 400, retryMs: 5000, graceMs: 10000, silentMs: 30000 }, options);
  const state = {
    snapshot: null,
    lastMessageAt: 0,
    mainboardId: config.mainboardId,
    frameN: 0,
    frameAt: 0,
  };
  const framePath = path.join(settings.dataDir, 'printers', config.id, 'frame.jpg');
  let socket = null;
  let stopped = false;
  let reconnect = null;
  let backoff = settings.retryMs;
  let video = null; // { request, retry }
  let latestFrame = null;
  let writtenFrame = null;
  let notPrintingSince = 0;
  let cameraUrl = ''; // the address the printer gave when the camera had to be switched on (command 386)
  let askedCamera = false;

  function request(command, data) {
    if (!socket || state.mainboardId === '') return false;

    return socket.send(JSON.stringify({
      Id: '',
      Data: { Cmd: command, Data: data || {}, RequestID: crypto.randomBytes(16).toString('hex'), MainboardID: state.mainboardId, TimeStamp: Date.now(), From: 1 },
      Topic: 'sdcp/request/' + state.mainboardId,
    }));
  }

  function handle(text) {
    let message;
    try {
      message = JSON.parse(text);
    } catch (error) {
      return;
    }
    if (!isRecord(message)) return;

    if (state.mainboardId === '' && typeof message.MainboardID === 'string') state.mainboardId = message.MainboardID;

    const snapshot = snapshotOf(message);
    if (snapshot) {
      state.snapshot = snapshot;
      state.lastMessageAt = Date.now();
      return;
    }

    // The answer to the request that switches the camera on holds its address
    const answer = isRecord(message.Data) && isRecord(message.Data.Data) ? message.Data.Data : null;
    if (answer && typeof answer.VideoUrl === 'string' && answer.VideoUrl !== '') {
      try {
        const given = new URL(answer.VideoUrl.indexOf('://') < 0 ? 'http://' + answer.VideoUrl : answer.VideoUrl);
        cameraUrl = 'http://' + config.ip + ':' + (given.port || config.videoPort) + (given.pathname || '/video');
      } catch (error) {
        cameraUrl = '';
      }
    }
  }

  function open() {
    if (stopped) return;

    const find = state.mainboardId !== '' ? Promise.resolve(state.mainboardId) : discover(config.ip);
    find.then(id => {
      if (stopped) return;
      if (id !== '') state.mainboardId = id;
      connect();
    });
  }

  function connect() {
    const own = new WebSocketLite('ws://' + config.ip + ':' + config.port + '/websocket');
    socket = own;
    let poll = null;
    let watch = null;

    own.on('open', () => {
      backoff = settings.retryMs;
      request(0);
      poll = setInterval(() => request(0), settings.pollMs);
      watch = setInterval(() => {
        // A connection that has gone quiet is closed and made again
        if (state.lastMessageAt > 0 && Date.now() - state.lastMessageAt > settings.silentMs) own.close();
      }, 5000);
    });
    own.on('message', handle);
    own.on('error', error => settings.log('printer ' + config.id + ': ' + error.message));
    own.on('close', () => {
      clearInterval(poll);
      clearInterval(watch);
      if (socket === own) socket = null;
      if (stopped) return;

      reconnect = setTimeout(open, backoff);
      backoff = Math.min(backoff * 2, 60000);
    });
  }

  function stopVideo() {
    if (video) {
      clearTimeout(video.retry);
      if (video.request) video.request.destroy();
      video = null;
    }
    latestFrame = null;
    writtenFrame = null;
    try {
      fs.unlinkSync(framePath);
    } catch (error) {
      // there was no picture
    }
    state.frameAt = 0;
    askedCamera = false;
    cameraUrl = '';
  }

  function startVideo() {
    const own = { request: null, retry: null };
    video = own;

    const again = () => {
      if (video !== own || stopped) return;
      own.retry = setTimeout(startVideo2, settings.retryMs);
    };

    const startVideo2 = () => {
      if (video !== own || stopped) return;

      const target = cameraUrl !== '' ? new URL(cameraUrl) : { hostname: config.ip, port: config.videoPort, pathname: '/video' };
      const get = http.get({ host: target.hostname, port: target.port, path: target.pathname }, response => {
        if (response.statusCode !== 200) {
          response.resume();
          if (!askedCamera) {
            askedCamera = true;
            request(386, { Enable: 1 });
          }
          again();
          return;
        }

        const split = createFrameSplitter(frame => {
          latestFrame = Buffer.from(frame);
        });
        response.on('data', split);
        response.on('end', again);
        response.on('error', again);
      });
      own.request = get;
      get.setTimeout(10000, () => get.destroy());
      get.on('error', error => {
        settings.log('printer ' + config.id + ' camera: ' + error.message);
        if (!askedCamera) {
          askedCamera = true;
          request(386, { Enable: 1 });
        }
        again();
      });
    };

    startVideo2();
  }

  // Once a second: the camera on while printing, off a little after it stops, and a new picture on disk when there is one
  function tick() {
    const now = Date.now();
    const printing = Boolean(state.snapshot && state.snapshot.printing && state.lastMessageAt > 0 && now - state.lastMessageAt <= onlineSeconds * 1000);

    if (printing) {
      notPrintingSince = 0;
      if (!video) startVideo();
    } else if (video) {
      if (notPrintingSince === 0) notPrintingSince = now;
      if (now - notPrintingSince >= settings.graceMs) stopVideo();
    }
  }

  function writeFrame() {
    if (!video || latestFrame === null || latestFrame === writtenFrame) return;

    try {
      writeAtomic(framePath, latestFrame);
      writtenFrame = latestFrame;
      state.frameN += 1;
      state.frameAt = Date.now();
    } catch (error) {
      settings.log('printer ' + config.id + ' could not write its picture: ' + error.message);
    }
  }

  const clock = setInterval(tick, 1000);
  const frames = setInterval(writeFrame, settings.frameMs);
  open();

  return {
    config: config,
    state: state,
    entry: () => publicEntry(config, state),
    tick: tick,
    stop() {
      stopped = true;
      clearInterval(clock);
      clearInterval(frames);
      clearTimeout(reconnect);
      stopVideo();
      if (socket) socket.close();
    },
  };
}

// The printers file as text to tidy printers. A file that is missing or broken means no printers.
export function readPrinters(file) {
  try {
    return tidyPrinters(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (error) {
    return [];
  }
}

// The file the dashboard reads
export function statusDocument(monitors, now = new Date()) {
  return { version: 1, updatedAt: now.toISOString(), printers: monitors.map(monitor => monitor.entry()) };
}

// Starts the service: the printers file is read again every minute, so a printer added to it joins without a restart.
export function startService(options) {
  const dataDir = options.dataDir;
  const log = options.log || (message => console.error(message));
  const statusFile = path.join(dataDir, 'printers', 'status.json');
  let monitors = [];
  let known = '';

  function sync() {
    const printers = readPrinters(options.printersFile);
    const key = JSON.stringify(printers);
    if (key === known) return;

    known = key;
    monitors.forEach(monitor => monitor.stop());
    monitors = printers.map(printer => createMonitor(printer, Object.assign({}, options.monitor, { dataDir: dataDir, log: log })));
    log('watching ' + printers.length + ' printer' + (printers.length === 1 ? '' : 's'));
  }

  function write() {
    try {
      writeAtomic(statusFile, JSON.stringify(statusDocument(monitors)) + '\n');
    } catch (error) {
      log('could not write ' + statusFile + ': ' + error.message);
    }
  }

  sync();
  write();
  const writer = setInterval(write, options.writeMs || 2000);
  const reader = setInterval(sync, options.reloadMs || 60000);

  return {
    monitors: () => monitors,
    stop() {
      clearInterval(writer);
      clearInterval(reader);
      monitors.forEach(monitor => monitor.stop());
      monitors = [];
      write();
    },
  };
}

// Run as a service
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  const dataDir = process.env.TELETRAAN_DATA || '/var/lib/teletraan/data';
  const printersFile = process.env.TELETRAAN_PRINTERS_FILE || '/var/lib/teletraan/printers.json';
  const service = startService({ dataDir: dataDir, printersFile: printersFile });

  const leave = () => {
    service.stop();
    process.exit(0);
  };
  process.on('SIGTERM', leave);
  process.on('SIGINT', leave);
}
