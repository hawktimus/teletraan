// A small WebSocket client for the printer service (printer-sync.mjs). The Teletraan computers run Node 20, which has no
// WebSocket that is ready to use, and the repository adds no packages, so this is the little that the Elegoo printers
// need: text messages in both directions, pings answered, and a close. It is the client side of RFC 6455 and nothing more.
//
//   const socket = new WebSocketLite('ws://192.168.0.101:3030/websocket');
//   socket.on('open', () => socket.send('{"Cmd":0}'));
//   socket.on('message', text => ...);
//   socket.on('close', () => ...);   // always comes once, after an error too
//   socket.on('error', error => ...);
//
// tests/printer-sync.test.mjs runs it against a pretend printer (tests/helpers/printer-sim.mjs).

import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import http from 'node:http';

const guid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// The most one message may hold. A status message is a few kilobytes.
export const largestMessage = 1024 * 1024;

// One frame as bytes, masked as a client must
export function encodeFrame(opcode, payload) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8');
  const mask = crypto.randomBytes(4);
  let header;

  if (data.length < 126) {
    header = Buffer.from([0x80 | opcode, 0x80 | data.length]);
  } else if (data.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(data.length), 2);
  }

  const masked = Buffer.alloc(data.length);
  for (let index = 0; index < data.length; index += 1) masked[index] = data[index] ^ mask[index % 4];
  return Buffer.concat([header, mask, masked]);
}

// Takes the next whole frame off the front of a buffer: { frame: { fin, opcode, payload }, rest }, or null when the
// buffer does not hold a whole one yet. A frame the client must not get (too big) throws.
export function decodeFrame(buffer) {
  if (buffer.length < 2) return null;

  const fin = (buffer[0] & 0x80) !== 0;
  const opcode = buffer[0] & 0x0f;
  const masked = (buffer[1] & 0x80) !== 0;
  let length = buffer[1] & 0x7f;
  let offset = 2;

  if (length === 126) {
    if (buffer.length < 4) return null;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buffer.length < 10) return null;
    const big = buffer.readBigUInt64BE(2);
    if (big > BigInt(largestMessage)) throw new Error('a message is too big');
    length = Number(big);
    offset = 10;
  }
  if (length > largestMessage) throw new Error('a message is too big');

  const maskBytes = masked ? 4 : 0;
  if (buffer.length < offset + maskBytes + length) return null;

  let payload = buffer.subarray(offset + maskBytes, offset + maskBytes + length);
  if (masked) {
    const key = buffer.subarray(offset, offset + 4);
    payload = Buffer.from(payload.map((byte, index) => byte ^ key[index % 4]));
  }
  return { frame: { fin: fin, opcode: opcode, payload: payload }, rest: buffer.subarray(offset + maskBytes + length) };
}

export class WebSocketLite extends EventEmitter {
  constructor(url, options = {}) {
    super();
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.pieces = [];
    this.pieceOpcode = 0;
    this.ended = false;
    this.opened = false;

    const target = new URL(url);
    const key = crypto.randomBytes(16).toString('base64');
    const request = http.request({
      host: target.hostname,
      port: target.port || 80,
      path: target.pathname + target.search,
      headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': key },
    });
    this.request = request;

    const timer = setTimeout(() => request.destroy(new Error('the printer did not answer in time')), options.timeoutMs || 8000);
    request.on('close', () => clearTimeout(timer));

    request.on('upgrade', (response, socket, head) => {
      clearTimeout(timer);
      const expected = crypto.createHash('sha1').update(key + guid).digest('base64');
      if (response.headers['sec-websocket-accept'] !== expected) {
        socket.destroy();
        this.finish(new Error('the printer did not complete the WebSocket handshake'));
        return;
      }

      this.socket = socket;
      socket.setNoDelay(true);
      socket.setKeepAlive(true, 15000);
      socket.on('data', chunk => this.take(chunk));
      socket.on('error', error => this.finish(error));
      socket.on('close', () => this.finish(null));
      this.opened = true;
      this.emit('open');
      if (head && head.length > 0) this.take(head);
    });

    // A printer that already has all its clients answers with an HTTP error ("too many client") and not an upgrade
    request.on('response', response => {
      response.resume();
      this.finish(new Error('the printer refused the connection: HTTP ' + response.statusCode));
    });
    request.on('error', error => this.finish(error));
    request.end();
  }

  // Gives the one 'close' there is, after an 'error' when there was one
  finish(error) {
    if (this.ended) return;
    this.ended = true;
    // an 'error' with nobody listening would stop the process, so it is only given to a listener
    if (error && this.listenerCount('error') > 0) this.emit('error', error);
    this.emit('close');
  }

  take(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    try {
      for (let found = decodeFrame(this.buffer); found !== null; found = decodeFrame(this.buffer)) {
        this.buffer = found.rest;
        this.handle(found.frame);
      }
    } catch (error) {
      this.close();
      this.finish(error);
    }
  }

  handle(frame) {
    if (frame.opcode === 9) {
      this.write(10, frame.payload);
      return;
    }
    if (frame.opcode === 10) return;
    if (frame.opcode === 8) {
      this.close();
      return;
    }

    // 1 is text, 2 is binary, 0 goes on with the message before it
    if (frame.opcode === 1 || frame.opcode === 2) {
      this.pieces = [];
      this.pieceOpcode = frame.opcode;
    }
    this.pieces.push(frame.payload);
    if (this.pieces.reduce((sum, piece) => sum + piece.length, 0) > largestMessage) {
      this.pieces = [];
      throw new Error('a message is too big');
    }
    if (!frame.fin) return;

    const whole = Buffer.concat(this.pieces);
    this.pieces = [];
    if (this.pieceOpcode === 1) this.emit('message', whole.toString('utf8'));
  }

  write(opcode, payload) {
    if (!this.socket || this.socket.destroyed) return false;
    this.socket.write(encodeFrame(opcode, payload));
    return true;
  }

  // Sends one text message. False when the socket is not open.
  send(text) {
    return this.write(1, String(text));
  }

  close() {
    if (this.socket && !this.socket.destroyed) {
      try {
        this.socket.write(encodeFrame(8, Buffer.alloc(0)));
      } catch (error) {
        // the socket is going anyway
      }
      this.socket.end();
      setTimeout(() => this.socket && this.socket.destroy(), 500).unref();
    } else if (!this.opened) {
      this.request.destroy();
    }
  }
}
