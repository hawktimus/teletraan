// The printer service (computer/scripts/printer-sync.mjs): what it makes of a printer's status message, what it lets the dashboard
// know, how it cuts the camera stream, and the whole of it against a pretend printer (tests/helpers/printer-sim.mjs).
//
//   node tests/printer-sync.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, finish } from './helpers/runner.mjs';
import { startPrinterSim } from './helpers/printer-sim.mjs';
import { createFrameSplitter, fileLabel, publicEntry, snapshotOf, startService, tidyPrinters } from '../computer/scripts/printer-sync.mjs';
import { decodeFrame, encodeFrame } from '../computer/scripts/printer-ws.mjs';

function message(info, machine = [1]) {
  return { Status: { CurrentStatus: machine, PrintInfo: info }, MainboardID: 'abc12345', Topic: 'sdcp/status/abc12345' };
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function until(check, seconds = 6) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    const value = check();
    if (value) return value;
    await wait(40);
  }
  return check();
}

test('the printers file is tidied: valid addresses only, names and ids made up when missing', () => {
  const printers = tidyPrinters({ printers: [
    { id: '1', name: 'Centauri A', ip: '192.168.0.101' },
    { ip: '192.168.0.102' },
    { id: 'bad id', ip: '192.168.0.103', name: '  ' },
    { id: '4', ip: '999.1.1.1' },
    { id: '5', ip: 'printer.local' },
    { id: '1', ip: '192.168.0.105' },
    'nonsense',
  ] });
  assert.deepEqual(printers.map(printer => [printer.id, printer.name, printer.ip]), [['1', 'Centauri A', '192.168.0.101'], ['2', 'Printer 2', '192.168.0.102'], ['3', 'Printer 3', '192.168.0.103']]);
  assert.equal(printers[0].port, 3030);
  assert.equal(printers[0].videoPort, 3031);
  assert.deepEqual(tidyPrinters(null), []);
  assert.deepEqual(tidyPrinters({ printers: 'x' }), []);
});

test('a file name is shown the way people read it', () => {
  assert.equal(fileLabel('/local/Pit crew bracket v7.gcode'), 'Pit crew bracket v7');
  assert.equal(fileLabel('gear.3mf'), 'gear');
  assert.equal(fileLabel(''), '');
  assert.equal(fileLabel(null), '');
});

test('a printing status gives the file, the layers and the times', () => {
  const snapshot = snapshotOf(message({ Status: 13, Filename: 'bracket.gcode', CurrentLayer: 96, TotalLayer: 360, CurrentTicks: 2400, TotalTicks: 9000, PrintSpeedPct: 100, Progress: 27 }), new Date(1000000));
  assert.equal(snapshot.printing, true);
  assert.equal(snapshot.state, 'printing');
  assert.equal(snapshot.file, 'bracket');
  assert.equal(snapshot.progress, 27);
  assert.equal(snapshot.layer, 96);
  assert.equal(snapshot.totalLayer, 360);
  assert.equal(snapshot.elapsedSeconds, 2400);
  assert.equal(snapshot.remainingSeconds, 6600);
  assert.equal(snapshot.totalSeconds, 9000);
  assert.equal(snapshot.mainboardId, 'abc12345');
  assert.equal(snapshot.at, 1000000);
});

test('an idle printer is not printing, even with the numbers of the print that ended still in it', () => {
  const snapshot = snapshotOf(message({ Status: 0, Filename: '', CurrentTicks: 9000, TotalTicks: 9000, CurrentLayer: 360, TotalLayer: 360 }, [0]));
  assert.equal(snapshot.printing, false);
  assert.equal(snapshot.state, 'idle');
  assert.equal(snapshotOf(message({ Status: 9, Filename: 'x.gcode' }, [0])).state, 'complete');
  assert.equal(snapshotOf(message({ Status: 8 }, [0])).state, 'stopped');
  assert.equal(snapshotOf(message({ Status: 14 }, [0])).state, 'error');
});

test('a paused print is not printing, and a machine that says printing with a file and no code is', () => {
  assert.equal(snapshotOf(message({ Status: 6, Filename: 'a.gcode' }, [1])).printing, false);
  assert.equal(snapshotOf(message({ Status: 6, Filename: 'a.gcode' }, [1])).state, 'paused');
  assert.equal(snapshotOf(message({ Filename: 'a.gcode' }, [1])).printing, true);
  assert.equal(snapshotOf(message({ Filename: '' }, [1])).printing, false);
  assert.equal(snapshotOf(message({ Status: 0, Filename: 'a.gcode' }, [1])).printing, false);
});

test('ticks in milliseconds are taken as such, so a print never lasts a thousand hours', () => {
  const snapshot = snapshotOf(message({ Status: 13, Filename: 'a.gcode', CurrentTicks: 2400000, TotalTicks: 9000000 }));
  assert.equal(snapshot.elapsedSeconds, 2400);
  assert.equal(snapshot.remainingSeconds, 6600);
});

test('with no total the total is worked out from the progress, and with neither the time left is unknown', () => {
  const worked = snapshotOf(message({ Status: 13, Filename: 'a.gcode', CurrentTicks: 600, TotalTicks: 0, Progress: 20 }));
  assert.equal(worked.totalSeconds, 3000);
  assert.equal(worked.remainingSeconds, 2400);
  assert.equal(worked.progress, 20);

  const unknown = snapshotOf(message({ Status: 13, Filename: 'a.gcode', CurrentTicks: 0, TotalTicks: 0 }));
  assert.equal(unknown.remainingSeconds, null);
  assert.equal(unknown.totalSeconds, null);
});

test('the time left never goes below zero, and the progress stays between 0 and 100', () => {
  const late = snapshotOf(message({ Status: 13, Filename: 'a.gcode', CurrentTicks: 5000, TotalTicks: 4000 }));
  assert.equal(late.remainingSeconds, 0);
  assert.equal(late.progress, 100);
});

test('a message that is not a status gives nothing, and the status of an answer is found too', () => {
  assert.equal(snapshotOf(null), null);
  assert.equal(snapshotOf({ Data: { Cmd: 386 } }), null);
  assert.equal(snapshotOf('x'), null);
  const wrapped = snapshotOf({ Data: { Status: { CurrentStatus: [1], PrintInfo: { Status: 13, Filename: 'w.gcode' } } } });
  assert.equal(wrapped.printing, true);
  assert.equal(wrapped.file, 'w');
});

test('what the dashboard may know has no address and no board id, and has the job only while it prints', () => {
  const config = { id: '2', name: 'Printer 2', ip: '192.168.0.102' };
  const printing = snapshotOf(message({ Status: 13, Filename: 'a.gcode', CurrentTicks: 100, TotalTicks: 1000 }), new Date(5000000));
  const state = { snapshot: printing, lastMessageAt: 5000000, frameAt: 4999000, frameN: 12, mainboardId: 'secret' };

  const entry = publicEntry(config, state, 5002000);
  assert.equal(entry.printing, true);
  assert.equal(entry.etaAt, new Date(5000000 + 900 * 1000).toISOString());
  assert.equal(entry.asOf, new Date(5000000).toISOString());
  assert.equal(entry.camera, true);
  assert.equal(entry.frameN, 12);
  const text = JSON.stringify(entry);
  assert.ok(!text.includes('192.168') && !text.includes('secret') && !text.includes('abc12345'));

  const idle = publicEntry(config, Object.assign({}, state, { snapshot: snapshotOf(message({ Status: 0, CurrentTicks: 1000, TotalTicks: 1000 }, [0])) }), 5002000);
  assert.deepEqual(Object.keys(idle).sort(), ['id', 'name', 'online', 'printing', 'state']);
  assert.equal(idle.printing, false);
});

test('a printer that has said nothing for 20 seconds is offline and not printing', () => {
  const config = { id: '1', name: 'Printer 1' };
  const state = { snapshot: snapshotOf(message({ Status: 13, Filename: 'a.gcode', CurrentTicks: 1, TotalTicks: 10 })), lastMessageAt: 1000, frameAt: 0, frameN: 0 };
  assert.equal(publicEntry(config, state, 1000 + 19000).printing, true);

  const gone = publicEntry(config, state, 1000 + 21000);
  assert.equal(gone.printing, false);
  assert.equal(gone.online, false);
  assert.equal(gone.state, 'offline');
  assert.equal(publicEntry(config, { snapshot: null, lastMessageAt: 0, frameAt: 0, frameN: 0 }, 5).state, 'offline');
});

test('the camera stream is cut into pictures, however the chunks fall', () => {
  const pictures = [];
  const feed = createFrameSplitter(frame => pictures.push(frame.toString('latin1')));
  const make = text => Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from(text), Buffer.from([0xff, 0xd9])]);
  const stream = Buffer.concat([Buffer.from('--frame\r\nContent-Type: image/jpeg\r\n\r\n'), make('one'), Buffer.from('\r\n--frame\r\n\r\n'), make('two'), Buffer.from('\r\n'), make('three')]);

  for (let at = 0; at < stream.length; at += 7) feed(stream.subarray(at, at + 7));
  assert.equal(pictures.length, 3);
  assert.ok(pictures[0].includes('one') && pictures[1].includes('two') && pictures[2].includes('three'));
});

test('a stream with no picture in it does not grow without end', () => {
  const feed = createFrameSplitter(() => assert.fail('no picture'), 1000);
  for (let index = 0; index < 100; index += 1) feed(Buffer.alloc(500, 0x42));
  feed(Buffer.from([0xff, 0xd8]));
  for (let index = 0; index < 100; index += 1) feed(Buffer.alloc(500, 0x42));
});

test('a WebSocket frame is encoded and read back, at the three lengths', () => {
  [5, 300, 70000].forEach(length => {
    const text = 'x'.repeat(length);
    const found = decodeFrame(encodeFrame(1, text));
    assert.equal(found.frame.payload.toString('utf8'), text);
    assert.equal(found.frame.opcode, 1);
    assert.equal(found.rest.length, 0);
  });
  assert.equal(decodeFrame(encodeFrame(1, 'hello').subarray(0, 3)), null);
});

// The whole service against pretend printers

function makeFolder() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'printers-'));
}

function writeConfig(folder, printers) {
  const file = path.join(folder, 'printers.json');
  fs.writeFileSync(file, JSON.stringify({ printers: printers }));
  return file;
}

function statusOf(folder) {
  try {
    return JSON.parse(fs.readFileSync(path.join(folder, 'data', 'printers', 'status.json'), 'utf8'));
  } catch (error) {
    return null;
  }
}

const quick = { pollMs: 100, frameMs: 60, retryMs: 100, graceMs: 300, silentMs: 5000 };

test('the service shows a printing printer with its job and its camera, and an idle one without', async () => {
  const folder = makeFolder();
  const busy = await startPrinterSim();
  const quiet = await startPrinterSim();
  busy.print({ file: 'Pit crew bracket v7.gcode', elapsed: 2400, total: 9000, layer: 96, totalLayer: 360 });
  const file = writeConfig(folder, [
    { id: '1', name: 'Centauri 1', ip: '127.0.0.1', port: busy.port, videoPort: busy.videoPort, mainboardId: busy.mainboardId },
    { id: '2', name: 'Centauri 2', ip: '127.0.0.1', port: quiet.port, videoPort: quiet.videoPort, mainboardId: quiet.mainboardId },
  ]);
  const service = startService({ dataDir: path.join(folder, 'data'), printersFile: file, writeMs: 100, monitor: quick, log: () => {} });

  try {
    const seen = await until(() => {
      const status = statusOf(folder);
      return status && status.printers.length === 2 && status.printers[0].printing && status.printers[0].camera ? status : null;
    });
    assert.ok(seen, 'the printing printer was never seen with a camera');
    const [first, second] = seen.printers;
    assert.equal(first.name, 'Centauri 1');
    assert.equal(first.file, 'Pit crew bracket v7');
    assert.equal(first.elapsedSeconds, 2400);
    assert.equal(first.remainingSeconds, 6600);
    assert.equal(first.layer, 96);
    assert.equal(second.printing, false);
    assert.equal(second.online, true);
    assert.equal(second.state, 'idle');
    assert.ok(!JSON.stringify(seen).includes('127.0.0.1'));

    const picture = fs.readFileSync(path.join(folder, 'data', 'printers', '1', 'frame.jpg'));
    assert.deepEqual([picture[0], picture[1], picture[picture.length - 2], picture[picture.length - 1]], [0xff, 0xd8, 0xff, 0xd9]);
    assert.equal(fs.existsSync(path.join(folder, 'data', 'printers', '2', 'frame.jpg')), false);
    assert.equal(quiet.videoRequests, 0, 'the camera of an idle printer must not be opened');
    assert.ok(busy.commands.every(command => command === 0), 'only the status was asked for: ' + busy.commands.join(','));
    assert.ok(busy.sockets.size === 1, 'one connection for a printer');
  } finally {
    service.stop();
    await busy.stop();
    await quiet.stop();
  }
});

test('when the print ends the printer frame goes, and the camera is closed and its picture removed', async () => {
  const folder = makeFolder();
  const sim = await startPrinterSim();
  sim.print({ elapsed: 100, total: 1000 });
  const file = writeConfig(folder, [{ id: '1', name: 'Centauri 1', ip: '127.0.0.1', port: sim.port, videoPort: sim.videoPort, mainboardId: sim.mainboardId }]);
  const service = startService({ dataDir: path.join(folder, 'data'), printersFile: file, writeMs: 100, monitor: quick, log: () => {} });
  const frame = path.join(folder, 'data', 'printers', '1', 'frame.jpg');

  try {
    assert.ok(await until(() => statusOf(folder) && statusOf(folder).printers[0] && statusOf(folder).printers[0].camera), 'no camera while printing');
    sim.idle();
    const over = await until(() => {
      const status = statusOf(folder);
      return status && !status.printers[0].printing && !fs.existsSync(frame) ? status : null;
    });
    assert.ok(over, 'the printer was still shown printing, or its picture stayed');
    assert.equal(over.printers[0].state, 'idle');
    assert.equal(over.printers[0].file, undefined);
  } finally {
    service.stop();
    await sim.stop();
  }
});

test('a printer that is not there is offline, and the service keeps going', async () => {
  const folder = makeFolder();
  const file = writeConfig(folder, [{ id: '1', name: 'Gone', ip: '127.0.0.1', port: 9, videoPort: 9, mainboardId: 'aabbccdd11' }]);
  const service = startService({ dataDir: path.join(folder, 'data'), printersFile: file, writeMs: 100, monitor: quick, log: () => {} });

  try {
    const status = await until(() => statusOf(folder));
    assert.equal(status.printers[0].online, false);
    assert.equal(status.printers[0].printing, false);
    assert.equal(status.printers[0].state, 'offline');
  } finally {
    service.stop();
  }
});

test('a printer that refuses the connection is tried again, and found when it lets one in', async () => {
  const folder = makeFolder();
  const sim = await startPrinterSim({ refuse: true });
  sim.print({ elapsed: 10, total: 100 });
  const file = writeConfig(folder, [{ id: '1', name: 'Busy', ip: '127.0.0.1', port: sim.port, videoPort: sim.videoPort, mainboardId: sim.mainboardId }]);
  const service = startService({ dataDir: path.join(folder, 'data'), printersFile: file, writeMs: 100, monitor: quick, log: () => {} });

  try {
    await wait(400);
    assert.equal(statusOf(folder).printers[0].online, false);
    sim.refuse = false;
    assert.ok(await until(() => statusOf(folder) && statusOf(folder).printers[0].printing), 'never found again');
  } finally {
    service.stop();
    await sim.stop();
  }
});

test('a connection the printer drops is made again', async () => {
  const folder = makeFolder();
  const sim = await startPrinterSim();
  sim.print({ elapsed: 10, total: 100 });
  const file = writeConfig(folder, [{ id: '1', name: 'P', ip: '127.0.0.1', port: sim.port, videoPort: sim.videoPort, mainboardId: sim.mainboardId }]);
  const service = startService({ dataDir: path.join(folder, 'data'), printersFile: file, writeMs: 100, monitor: quick, log: () => {} });

  try {
    assert.ok(await until(() => statusOf(folder) && statusOf(folder).printers[0].printing));
    const before = sim.commands.length;
    sim.dropClients();
    assert.ok(await until(() => sim.commands.length > before + 1 && sim.sockets.size === 1), 'no new connection');
  } finally {
    service.stop();
    await sim.stop();
  }
});

test('when the camera is not on, the printer is asked once to switch it on and its address is used', async () => {
  const folder = makeFolder();
  const sim = await startPrinterSim();
  sim.print({ elapsed: 10, total: 100 });
  sim.videoStatus = 503;
  const file = writeConfig(folder, [{ id: '1', name: 'P', ip: '127.0.0.1', port: sim.port, videoPort: sim.videoPort, mainboardId: sim.mainboardId }]);
  const service = startService({ dataDir: path.join(folder, 'data'), printersFile: file, writeMs: 100, monitor: quick, log: () => {} });

  try {
    assert.ok(await until(() => sim.commands.includes(386)), 'the camera was never asked for');
    sim.videoStatus = 200;
    assert.ok(await until(() => statusOf(folder) && statusOf(folder).printers[0].camera), 'no camera after it was switched on');
    assert.equal(sim.commands.filter(command => command === 386).length, 1);
  } finally {
    service.stop();
    await sim.stop();
  }
});

test('the printers file is read again, so a printer added to it joins and a missing file means none', async () => {
  const folder = makeFolder();
  const sim = await startPrinterSim();
  sim.print({ elapsed: 10, total: 100 });
  const file = path.join(folder, 'printers.json');
  const service = startService({ dataDir: path.join(folder, 'data'), printersFile: file, writeMs: 100, reloadMs: 150, monitor: quick, log: () => {} });

  try {
    await wait(300);
    assert.deepEqual(statusOf(folder).printers, []);
    fs.writeFileSync(file, JSON.stringify({ printers: [{ id: '1', name: 'Late', ip: '127.0.0.1', port: sim.port, videoPort: sim.videoPort, mainboardId: sim.mainboardId }] }));
    assert.ok(await until(() => statusOf(folder).printers.length === 1 && statusOf(folder).printers[0].printing), 'the new printer never joined');
    fs.writeFileSync(file, '{ broken');
    assert.ok(await until(() => statusOf(folder).printers.length === 0), 'a broken file should mean no printers');
  } finally {
    service.stop();
    await sim.stop();
  }
});

await finish();
