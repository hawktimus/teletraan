// A pretend Elegoo Centauri Carbon for the tests of the printer service and for trying the dashboard by hand. It answers the
// way the real printer is described to answer (docs/printers.md): a WebSocket on one port that sends a status message when it is
// asked for it (command 0), and a Motion JPEG camera on another.
//
//   node tests/helpers/printer-sim.mjs 3030 3031 printing     one printer, printing, on those two ports
//
// From a test:
//   const sim = await startPrinterSim();      sim.port, sim.videoPort
//   sim.print({ file: 'gear.gcode', elapsed: 600, total: 3600 });   sim.idle();
//   await sim.stop();

import crypto from 'node:crypto';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { decodeFrame } from '../../computer/scripts/printer-ws.mjs';

const guid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
export const simBoardId = '608715130105041800009c0000000000';

// One frame from the printer: not masked
function serverFrame(opcode, text) {
  const data = Buffer.from(text, 'utf8');
  const header = data.length < 126 ? Buffer.from([0x80 | opcode, data.length]) : Buffer.from([0x80 | opcode, 126, data.length >> 8, data.length & 0xff]);
  return Buffer.concat([header, data]);
}

export async function startPrinterSim(options = {}) {
  const sim = {
    mainboardId: simBoardId,
    info: { Status: 0, CurrentLayer: 0, TotalLayer: 0, CurrentTicks: 0, TotalTicks: 0, Filename: '', TaskId: '', PrintSpeedPct: 100, Progress: 0 },
    machine: [0],
    commands: [], // the commands the printer was sent, in order
    sockets: new Set(),
    videoRequests: 0,
    videoStatus: 200,
    refuse: options.refuse === true, // answers an upgrade with an HTTP error, as a printer with all its clients does
    silent: false, // takes the requests and says nothing
    frame: 0,
  };

  function statusMessage() {
    return JSON.stringify({
      Status: { CurrentStatus: sim.machine, TimeLapseStatus: 0, PlatFormType: 0, TempOfNozzle: 25, PrintInfo: Object.assign({}, sim.info) },
      MainboardID: sim.mainboardId,
      TimeStamp: Math.floor(Date.now() / 1000),
      Topic: 'sdcp/status/' + sim.mainboardId,
    });
  }

  const server = http.createServer((request, response) => {
    response.writeHead(404);
    response.end();
  });

  server.on('upgrade', (request, socket) => {
    if (sim.refuse) {
      socket.end('HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\n\r\n');
      return;
    }

    const accept = crypto.createHash('sha1').update(request.headers['sec-websocket-key'] + guid).digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    sim.sockets.add(socket);
    socket.on('close', () => sim.sockets.delete(socket));
    socket.on('error', () => {});

    let buffer = Buffer.alloc(0);
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      for (let found = decodeFrame(buffer); found !== null; found = decodeFrame(buffer)) {
        buffer = found.rest;
        const frame = found.frame;
        if (frame.opcode === 8) {
          socket.end();
          return;
        }
        if (frame.opcode !== 1) continue;

        let message = null;
        try {
          message = JSON.parse(frame.payload.toString('utf8'));
        } catch (error) {
          continue;
        }
        const command = message && message.Data ? message.Data.Cmd : undefined;
        sim.commands.push(command);
        if (sim.silent) continue;
        if (command === 0) socket.write(serverFrame(1, statusMessage()));
        if (command === 386) {
          socket.write(serverFrame(1, JSON.stringify({ Id: '', Data: { Cmd: 386, Data: { Ack: 0, VideoUrl: 'http://127.0.0.1:' + sim.videoPort + '/video' }, RequestID: message.Data.RequestID, MainboardID: sim.mainboardId }, Topic: 'sdcp/response/' + sim.mainboardId })));
        }
      }
    });
  });

  // The camera: a pretend picture 20 times a second. A picture is a start marker, the number of the picture and an end marker.
  const video = http.createServer((request, response) => {
    sim.videoRequests += 1;
    if (sim.videoStatus !== 200 || request.url !== '/video') {
      response.writeHead(sim.videoStatus === 200 ? 404 : sim.videoStatus);
      response.end();
      return;
    }

    response.writeHead(200, { 'Content-Type': 'multipart/x-mixed-replace; boundary=frame' });
    const timer = setInterval(() => {
      sim.frame += 1;
      const picture = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from('frame-' + sim.frame + '-'), Buffer.alloc(200, 0x41), Buffer.from([0xff, 0xd9])]);
      response.write('--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ' + picture.length + '\r\n\r\n');
      response.write(picture);
      response.write('\r\n');
    }, 50);
    response.on('close', () => clearInterval(timer));
  });

  await new Promise(resolve => server.listen(options.port || 0, '127.0.0.1', resolve));
  await new Promise(resolve => video.listen(options.videoPort || 0, '127.0.0.1', resolve));
  sim.port = server.address().port;
  sim.videoPort = video.address().port;

  sim.print = ({ file = 'benchy.gcode', elapsed = 600, total = 3600, layer = 20, totalLayer = 200, code = 13 } = {}) => {
    sim.machine = [1];
    sim.info = Object.assign({}, sim.info, { Status: code, Filename: file, TaskId: 'task-1', CurrentTicks: elapsed, TotalTicks: total, CurrentLayer: layer, TotalLayer: totalLayer, Progress: total > 0 ? Math.round((elapsed / total) * 100) : 0 });
  };
  // The state of a printer that has just finished: the numbers stay, the status goes back to idle and the file name goes
  sim.idle = () => {
    sim.machine = [0];
    sim.info = Object.assign({}, sim.info, { Status: 0, Filename: '', TaskId: '' });
  };
  sim.dropClients = () => sim.sockets.forEach(socket => socket.destroy());
  sim.stop = async () => {
    sim.dropClients();
    await new Promise(resolve => server.close(resolve));
    video.closeAllConnections();
    await new Promise(resolve => video.close(resolve));
  };
  return sim;
}

// By hand: node tests/helpers/printer-sim.mjs 3030 3031 printing
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sim = await startPrinterSim({ port: Number(process.argv[2]) || 3030, videoPort: Number(process.argv[3]) || 3031 });
  if (process.argv[4] === 'printing') sim.print({ file: 'Pit crew bracket v7.gcode', elapsed: 2400, total: 9000, layer: 96, totalLayer: 360 });
  setInterval(() => {
    if (sim.info.Status === 13) {
      sim.info.CurrentTicks += 1;
      sim.info.Progress = Math.round((sim.info.CurrentTicks / sim.info.TotalTicks) * 100);
    }
  }, 1000);
  console.log('Pretend printer: status on port ' + sim.port + ', camera on port ' + sim.videoPort);
}
