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

A screencast can come out black on a kiosk browser that has no window manager. The size of a frame cannot tell
that for sure, so at the start and every 30 seconds (never more often) the script takes one small PNG with
Page.captureScreenshot, decodes it with zlib and the PNG filters, and looks at about 400 pixels on a grid. If more
than 99 percent of them are near black (every channel under 12) the picture is black. Then it tries the other way of
making pictures (screencast or screenshots) and says which one gave a picture. Three frames in a row under
MIRROR_BLACK_BYTES bytes (a black 960 by 540 JPEG is about 2 KB) also switch a screencast to
Page.captureScreenshot about 4 times a second. <data>/mirror/state.json says
{"state": "ok" or "black", "mode": "screencast" or "screenshots", "fps": n, "bytes": n, "width": n, "height": n,
"sampled": true or false, "tried": {...}}. sampled is true when a PNG was read.

Standard library only. The debug port is on 127.0.0.1 and nothing here exposes it.

Settings from the environment, all optional:
  MIRROR_PORT   the browser's debug port (default 9222)
  MIRROR_DATA   the data folder (default: TELETRAAN_DATA from local.env, else /var/lib/teletraan/data)
  MIRROR_IDLE   seconds without a touch of the watch file before it stops (default 120)
  MIRROR_MAX    seconds it may run at most (default 1800)
  MIRROR_BLACK_BYTES  a frame under this many bytes counts as black (default 3000)
  MIRROR_PROBE  seconds between two PNG probes (default 30, which is also the least that should be used)
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
import zlib

PORT = int(os.environ.get('MIRROR_PORT', '9222'))
IDLE_SECONDS = float(os.environ.get('MIRROR_IDLE', '120'))
MAX_SECONDS = float(os.environ.get('MIRROR_MAX', '1800'))
BLACK_BYTES = int(os.environ.get('MIRROR_BLACK_BYTES', '3000'))
BLACK_RUN = 3
# One PNG probe at the start and then at most one in this many seconds
PROBE_SECONDS = float(os.environ.get('MIRROR_PROBE', '30'))
# The probe is drawn at a quarter size, so the pure Python decoder has little to read
PROBE_CLIP = {'x': 0, 'y': 0, 'width': 1920, 'height': 1080, 'scale': 0.25}
NEAR_BLACK = 12
BLACK_SHARE = 0.99
GRID = 20
SHOT_SECONDS = 0.25
# A screencast that sends nothing at all for this long is treated like a black one
SILENT_SECONDS = 5.0
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
    # The web server runs as another user and the service's umask may be strict
    os.chmod(path, 0o644)


def decode_png(data):
    """(width, height, channels, rows) of an 8 bit RGB or RGBA PNG that is not interlaced. Raises ValueError otherwise."""
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('not a PNG')
    at = 8
    header = None
    parts = []
    while at + 8 <= len(data):
        size, kind = struct.unpack('>I4s', data[at:at + 8])
        body = data[at + 8:at + 8 + size]
        at += 12 + size
        if kind == b'IHDR':
            header = struct.unpack('>IIBBBBB', body)
        elif kind == b'IDAT':
            parts.append(body)
        elif kind == b'IEND':
            break
    if header is None or not parts:
        raise ValueError('the PNG has no picture')
    width, height, depth, color, _, _, interlace = header
    if depth != 8 or color not in (2, 6) or interlace != 0:
        raise ValueError('the PNG is not 8 bit RGB or RGBA without interlace')
    channels = 3 if color == 2 else 4
    stride = width * channels
    raw = zlib.decompress(b''.join(parts))
    if len(raw) < height * (stride + 1):
        raise ValueError('the PNG is cut short')
    rows = []
    before = bytearray(stride)
    at = 0
    for _ in range(height):
        kind = raw[at]
        line = bytearray(raw[at + 1:at + 1 + stride])
        at += 1 + stride
        if kind == 1:
            for i in range(channels, stride):
                line[i] = (line[i] + line[i - channels]) & 255
        elif kind == 2:
            for i in range(stride):
                line[i] = (line[i] + before[i]) & 255
        elif kind == 3:
            for i in range(stride):
                left = line[i - channels] if i >= channels else 0
                line[i] = (line[i] + ((left + before[i]) >> 1)) & 255
        elif kind == 4:
            for i in range(stride):
                a = line[i - channels] if i >= channels else 0
                b = before[i]
                c = before[i - channels] if i >= channels else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else (b if pb <= pc else c))) & 255
        elif kind != 0:
            raise ValueError('the PNG has an unknown filter')
        rows.append(line)
        before = line
    return width, height, channels, rows


def sample_black(data):
    """(black, width, height): whether more than 99 percent of about 400 grid pixels are near black."""
    width, height, channels, rows = decode_png(data)
    near = 0
    total = 0
    for gy in range(GRID):
        row = rows[min(height - 1, (gy * height) // GRID + height // (GRID * 2))]
        for gx in range(GRID):
            x = min(width - 1, (gx * width) // GRID + width // (GRID * 2)) * channels
            total += 1
            if row[x] < NEAR_BLACK and row[x + 1] < NEAR_BLACK and row[x + 2] < NEAR_BLACK:
                near += 1
    return near > BLACK_SHARE * total, width, height


def jpeg_size(data):
    """(width, height) from the first frame header of a JPEG, or (0, 0) when there is none."""
    at = 2
    while at + 9 < len(data):
        if data[at] != 0xFF:
            return 0, 0
        marker = data[at + 1]
        if marker in (0xC0, 0xC1, 0xC2):
            height, width = struct.unpack('>HH', data[at + 5:at + 9])
            return width, height
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            at += 2
            continue
        at += 2 + struct.unpack('>H', data[at + 2:at + 4])[0]
    return 0, 0


def remove_all(paths):
    for old in paths:
        try:
            os.remove(old)
        except OSError:
            pass


def main():
    folder = os.path.join(data_folder(), 'mirror')
    os.makedirs(folder, mode=0o755, exist_ok=True)
    os.chmod(folder, 0o755)
    watch = os.path.join(folder, 'watch')
    jpeg = os.path.join(folder, 'frame.jpg')
    counter = os.path.join(folder, 'frame.n')
    state_file = os.path.join(folder, 'state.json')

    # A picture left by an earlier run must not look live
    remove_all((jpeg, counter, state_file))
    # Started with no one watching: give it the usual idle time instead of stopping at once
    if not os.path.exists(watch):
        open(watch, 'a').close()
    os.chmod(watch, 0o644)

    page = find_page()
    link = Socket(page['webSocketDebuggerUrl'])
    started = time.time()
    frames = 0
    drawn = []
    next_id = 0
    mode = 'screencast'
    size_state = 'ok'
    small_run = 0
    last_bytes = 0
    last_size = (0, 0)
    # What the PNG probe found: None until one was read, then 'ok' or 'black'
    probe_state = None
    probe_size = (0, 0)
    tried = {}
    flipped = False
    written = None
    written_at = 0.0

    def ask(method, params=None):
        nonlocal next_id
        next_id += 1
        link.send_json({'id': next_id, 'method': method, 'params': params or {}})
        return next_id

    def state_now():
        return probe_state if probe_state is not None else size_state

    def write_state(force=False):
        nonlocal written, written_at
        now = time.time()
        drawn[:] = [t for t in drawn if now - t <= 3.0]
        fps = round(len(drawn) / 3.0, 1) if now - started >= 3.0 else round(len(drawn) / max(now - started, 0.5), 1)
        width, height = last_size if last_size != (0, 0) else probe_size
        body = {
            'state': state_now(), 'mode': mode, 'fps': fps, 'bytes': last_bytes, 'width': width, 'height': height,
            'sampled': probe_state is not None, 'tried': dict(tried),
        }
        if not force and written == (body['state'], mode) and now - written_at < 2.0:
            return
        written, written_at = (body['state'], mode), now
        replace_file(state_file, json.dumps(body).encode('utf-8'))

    def keep(picture):
        nonlocal frames, last_bytes, last_size
        frames += 1
        drawn.append(time.time())
        last_bytes = len(picture)
        last_size = jpeg_size(picture)
        replace_file(jpeg, picture)
        replace_file(counter, str(frames).encode('ascii'))

    def take_frame(event):
        """Handles one screencast frame message: keeps it, answers it, and notes a run of small ones."""
        nonlocal small_run, size_state
        params = event.get('params', {})
        picture = base64.b64decode(params.get('data', ''))
        if picture:
            keep(picture)
            small_run = small_run + 1 if len(picture) < BLACK_BYTES else 0
            size_state = 'black' if small_run >= BLACK_RUN else 'ok'
            if mode == 'screencast':
                tried['screencast'] = size_state
        ask('Page.screencastFrameAck', {'sessionId': params.get('sessionId', 0)})
        write_state()

    def result_of(wanted, seconds=4.0):
        """The result of one command, or None when it fails or does not answer. A screencast frame that comes
        meanwhile is kept and answered, so the stream does not stall."""
        end = time.time() + seconds
        while time.time() < end:
            message = link.receive()
            if message is None or isinstance(message, bytes):
                continue
            try:
                event = json.loads(message)
            except ValueError:
                continue
            if event.get('method') == 'Page.screencastFrame' and mode == 'screencast':
                take_frame(event)
            if event.get('id') == wanted:
                return event.get('result')
        return None

    def start_screencast():
        ask('Page.startScreencast', {'format': 'jpeg', 'quality': 45, 'maxWidth': 960, 'maxHeight': 540, 'everyNthFrame': 2})

    def probe():
        """One PNG of the page, read for black. Changes the way the pictures are made when the page is black."""
        nonlocal probe_state, probe_size, mode, flipped, small_run, next_shot
        answer = result_of(ask('Page.captureScreenshot', {'format': 'png', 'fromSurface': True, 'captureBeyondViewport': False, 'clip': PROBE_CLIP}))
        try:
            black, width, height = sample_black(base64.b64decode(answer.get('data', ''))) if answer else (None, 0, 0)
        except (ValueError, zlib.error, struct.error, IndexError) as error:
            say('the probe picture could not be read: %s' % error)
            black = None
        if black is None:
            return
        probe_state = 'black' if black else 'ok'
        probe_size = (width, height)
        # A screencast is judged by the size of its frames, the screenshots by the PNG
        if mode == 'screenshots':
            tried['screenshots'] = probe_state
        if not black:
            flipped = False
        elif not flipped:
            flipped = True
            if mode == 'screencast':
                say('the page is black in the screencast, trying screenshots')
                ask('Page.stopScreencast')
                mode = 'screenshots'
                next_shot = 0.0
            else:
                say('the page is black in screenshots, trying the screencast')
                mode = 'screencast'
                small_run = 0
                start_screencast()
        else:
            say('the page is black in both ways of making pictures')
        write_state(True)

    # A browser that lacks one of these methods answers with an error, which is not read
    for method, params in (
        ('Page.enable', {}),
        ('Page.bringToFront', {}),
        ('Emulation.setFocusEmulationEnabled', {'enabled': True}),
        ('Page.setWebLifecycleState', {'state': 'active'}),
    ):
        ask(method, params)
    start_screencast()
    say('copying %s' % page.get('url', '')[:80])
    reason = 'stopped'
    next_shot = 0.0
    next_probe = 0.0

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

            if now >= next_probe:
                next_probe = now + PROBE_SECONDS
                probe()
                continue

            if mode == 'screencast' and small_run >= BLACK_RUN:
                say('screencast was black, using screenshots')
                ask('Page.stopScreencast')
                mode = 'screenshots'
                small_run = 0
                write_state(True)
                continue

            if mode == 'screenshots':
                if now < next_shot:
                    time.sleep(min(0.05, next_shot - now))
                    continue
                next_shot = now + SHOT_SECONDS
                answer = result_of(ask('Page.captureScreenshot', {'format': 'jpeg', 'quality': 50, 'fromSurface': True, 'captureBeyondViewport': False}))
                picture = base64.b64decode(answer.get('data', '')) if answer else b''
                if picture:
                    keep(picture)
                    small_run = small_run + 1 if len(picture) < BLACK_BYTES else 0
                    size_state = 'black' if small_run >= BLACK_RUN else 'ok'
                write_state()
                continue

            if frames == 0 and now - started > SILENT_SECONDS:
                say('screencast gave no frames, using screenshots')
                ask('Page.stopScreencast')
                mode = 'screenshots'
                write_state(True)
                continue

            message = link.receive()
            if message is None or isinstance(message, bytes):
                continue
            try:
                event = json.loads(message)
            except ValueError:
                continue
            if event.get('method') != 'Page.screencastFrame':
                continue
            take_frame(event)
    except EOFError as error:
        reason = str(error)
    finally:
        link.close()
        remove_all((jpeg, counter, state_file))
        spent = time.time() - started
        used = resource.getrusage(resource.RUSAGE_SELF)
        say('%s after %.1f s, %d frames, %.1f frames a second, cpu %.2f s' % (reason, spent, frames, frames / spent if spent else 0, used.ru_utime + used.ru_stime))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:  # a plain line in the journal is the whole report
        say('could not run: %s' % error)
        sys.exit(1)
