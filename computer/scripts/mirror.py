#!/usr/bin/env python3
"""A picture of the TV for the control page.

Reads the page list of the kiosk browser at http://127.0.0.1:<port>/json, opens the page's DevTools
WebSocket by hand (RFC 6455), asks for a screencast and writes the newest frame to
<data>/mirror/frame.jpg, with a counter in <data>/mirror/frame.n. Both are replaced by renaming a
finished file over the old one, so a reader never sees half a picture.

It runs only on demand (teletraan-mirror.service) and stops by itself when
  - <data>/mirror/watch is older than 120 seconds (the control page touches it while someone looks),
  - the browser closes the socket, or
  - 30 minutes have passed.

Standard library only. The debug port is on 127.0.0.1 and nothing here exposes it.

Settings from the environment, all optional:
  MIRROR_PORT   the browser's debug port (default 9222)
  MIRROR_DATA   the data folder (default: TELETRAAN_DATA from local.env, else /var/lib/teletraan/data)
  MIRROR_IDLE   seconds without a touch of the watch file before it stops (default 120)
  MIRROR_MAX    seconds it may run at most (default 1800)
"""

import base64
import hashlib
import json
import os
import resource
import socket
import struct
import sys
import time
import urllib.request

PORT = int(os.environ.get('MIRROR_PORT', '9222'))
IDLE_SECONDS = float(os.environ.get('MIRROR_IDLE', '120'))
MAX_SECONDS = float(os.environ.get('MIRROR_MAX', '1800'))
GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
ENV_FILE = os.environ.get('MIRROR_ENV', '/opt/teletraan/local.env')


def data_folder():
    given = os.environ.get('MIRROR_DATA')
    if given:
        return given
    # Only the one name is read from local.env, the other lines hold keys
    try:
        with open(ENV_FILE, encoding='utf-8') as lines:
            found = ''
            for line in lines:
                if line.startswith('TELETRAAN_DATA='):
                    found = line.split('=', 1)[1].strip().strip('\'"')
            if found:
                return found
    except OSError:
        pass
    return '/var/lib/teletraan/data'


def say(text):
    sys.stderr.write('mirror: ' + text + '\n')
    sys.stderr.flush()


def find_page():
    with urllib.request.urlopen('http://127.0.0.1:%d/json' % PORT, timeout=5) as answer:
        pages = json.loads(answer.read().decode('utf-8'))
    pages = [p for p in pages if p.get('type') == 'page' and p.get('webSocketDebuggerUrl')]
    for page in pages:
        if '/dashboard' in page.get('url', '') or page.get('url', '').startswith('http://localhost'):
            return page
    if pages:
        return pages[0]
    raise RuntimeError('the browser has no page to copy')


class Socket:
    """The few parts of a WebSocket client that the DevTools protocol needs."""

    def __init__(self, url):
        rest = url.split('://', 1)[1]
        host_port, _, path = rest.partition('/')
        host, _, port = host_port.partition(':')
        self.sock = socket.create_connection((host, int(port or 80)), timeout=5)
        key = base64.b64encode(os.urandom(16)).decode('ascii')
        self.sock.sendall((
            'GET /%s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
            'Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n' % (path, host_port, key)
        ).encode('ascii'))
        head = b''
        while b'\r\n\r\n' not in head:
            chunk = self.sock.recv(1024)
            if not chunk:
                raise RuntimeError('the browser closed the connection')
            head += chunk
            if len(head) > 16384:
                raise RuntimeError('the answer to the handshake is too long')
        head, _, self.buffer = head.partition(b'\r\n\r\n')
        lines = head.decode('latin-1').split('\r\n')
        if ' 101 ' not in lines[0] + ' ':
            raise RuntimeError('the browser refused the WebSocket: ' + lines[0][:80])
        wanted = base64.b64encode(hashlib.sha1((key + GUID).encode('ascii')).digest()).decode('ascii')
        accepted = [l.split(':', 1)[1].strip() for l in lines[1:] if l.lower().startswith('sec-websocket-accept:')]
        if accepted != [wanted]:
            raise RuntimeError('the browser did not answer the handshake correctly')
        self.sock.settimeout(1.0)

    def send_frame(self, opcode, payload):
        header = bytes([0x80 | opcode])
        size = len(payload)
        if size < 126:
            header += bytes([0x80 | size])
        elif size < 65536:
            header += bytes([0x80 | 126]) + struct.pack('>H', size)
        else:
            header += bytes([0x80 | 127]) + struct.pack('>Q', size)
        mask = os.urandom(4)
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        self.sock.sendall(header + mask + masked)

    def send_json(self, value):
        self.send_frame(1, json.dumps(value).encode('utf-8'))

    def _take(self, count, first=False):
        """count bytes. With first set, None when the second runs out before a frame began."""
        while len(self.buffer) < count:
            try:
                chunk = self.sock.recv(65536)
            except socket.timeout:
                if first and not self.buffer:
                    return None
                continue
            if not chunk:
                raise EOFError('the browser closed the socket')
            self.buffer += chunk
        taken, self.buffer = self.buffer[:count], self.buffer[count:]
        return taken

    def _frame(self):
        first = self._take(2, True)
        if first is None:
            return None
        fin, opcode = bool(first[0] & 0x80), first[0] & 0x0F
        size = first[1] & 0x7F
        masked = bool(first[1] & 0x80)
        if size == 126:
            size = struct.unpack('>H', self._take(2))[0]
        elif size == 127:
            size = struct.unpack('>Q', self._take(8))[0]
        mask = self._take(4) if masked else None
        payload = self._take(size) if size else b''
        if mask:
            payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        return fin, opcode, payload

    def receive(self):
        """The next whole text or binary message, or None after a quiet second. Answers pings, joins fragments."""
        parts = []
        kind = 0
        while True:
            got = self._frame()
            if got is None:
                if parts:
                    continue
                return None
            fin, opcode, payload = got
            if opcode == 9:
                self.send_frame(10, payload)
                continue
            if opcode == 10:
                continue
            if opcode == 8:
                raise EOFError('the browser closed the socket')
            if opcode in (1, 2):
                kind, parts = opcode, [payload]
            elif opcode == 0:
                parts.append(payload)
            if fin:
                data = b''.join(parts)
                return data.decode('utf-8') if kind == 1 else data

    def close(self):
        try:
            self.send_frame(8, b'')
        except OSError:
            pass
        self.sock.close()


def replace_file(path, content):
    temporary = path + '.tmp'
    with open(temporary, 'wb') as out:
        out.write(content)
    os.replace(temporary, path)


def main():
    folder = os.path.join(data_folder(), 'mirror')
    os.makedirs(folder, exist_ok=True)
    watch = os.path.join(folder, 'watch')
    jpeg = os.path.join(folder, 'frame.jpg')
    counter = os.path.join(folder, 'frame.n')

    # A picture left by an earlier run must not look live
    for old in (jpeg, counter):
        try:
            os.remove(old)
        except OSError:
            pass
    # Started with no one watching: give it the usual idle time instead of stopping at once
    if not os.path.exists(watch):
        open(watch, 'a').close()

    page = find_page()
    link = Socket(page['webSocketDebuggerUrl'])
    started = time.time()
    frames = 0
    next_id = 1
    link.send_json({'id': next_id, 'method': 'Page.startScreencast',
                    'params': {'format': 'jpeg', 'quality': 45, 'maxWidth': 960, 'maxHeight': 540, 'everyNthFrame': 2}})
    say('copying %s' % page.get('url', '')[:80])
    reason = 'stopped'

    try:
        while True:
            now = time.time()
            if now - started > MAX_SECONDS:
                reason = 'ran for the longest time allowed'
                break
            try:
                idle = now - os.path.getmtime(watch)
            except OSError:
                idle = IDLE_SECONDS + 1
            if idle > IDLE_SECONDS:
                reason = 'nobody is watching'
                break

            message = link.receive()
            if message is None or isinstance(message, bytes):
                continue
            try:
                event = json.loads(message)
            except ValueError:
                continue
            if event.get('method') != 'Page.screencastFrame':
                continue
            params = event.get('params', {})
            picture = base64.b64decode(params.get('data', ''))
            if picture:
                frames += 1
                replace_file(jpeg, picture)
                replace_file(counter, str(frames).encode('ascii'))
            next_id += 1
            link.send_json({'id': next_id, 'method': 'Page.screencastFrameAck', 'params': {'sessionId': params.get('sessionId', 0)}})
    except EOFError as error:
        reason = str(error)
    finally:
        link.close()
        for old in (jpeg, counter):
            try:
                os.remove(old)
            except OSError:
                pass
        spent = time.time() - started
        used = resource.getrusage(resource.RUSAGE_SELF)
        say('%s after %.1f s, %d frames, %.1f frames a second, cpu %.2f s' % (reason, spent, frames, frames / spent if spent else 0, used.ru_utime + used.ru_stime))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:  # a plain line in the journal is the whole report
        say('could not run: %s' % error)
        sys.exit(1)
