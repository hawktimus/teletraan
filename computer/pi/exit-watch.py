#!/usr/bin/env python3
"""Closes the Teletraan browser on the Raspberry Pi when someone asks to leave.

It leaves on any of these:
  - Select + Start together on a controller
  - Ctrl + Alt + Backspace on a keyboard
  - Esc on a keyboard while the control page is up
  - the dashboard asking for it, which it does for Esc when no talk and no list has the screen
    (dashboard/core/console-keys.js)

The dashboard talks to this through the web server: /pi/leave and /pi/page/<name> reach the small listener below,
which is open to this computer only. /pi/page/control is how the dashboard says that it is handing over to the
control page.

The browser is found by its profile folder (the first argument), so nothing else on the Pi is touched. The second
argument is the page the browser starts on: dashboard or control. session.sh starts this and stops it.
"""
import os
import selectors
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import evdev
from evdev import ecodes

PAD = {ecodes.BTN_SELECT, ecodes.BTN_START}
KEYS_CTRL = {ecodes.KEY_LEFTCTRL, ecodes.KEY_RIGHTCTRL}
KEYS_ALT = {ecodes.KEY_LEFTALT, ecodes.KEY_RIGHTALT}
RESCAN_SECONDS = 3
LISTEN = ('127.0.0.1', 8079)
PAGES = ('dashboard', 'control')

state = {'page': 'dashboard', 'profile': ''}


def wanted(device):
    keys = set(device.capabilities().get(ecodes.EV_KEY, []))
    return PAD <= keys or ecodes.KEY_BACKSPACE in keys


def leave():
    # only the processes of this user: the browser itself, not the sudo that started it
    subprocess.run(['pkill', '-U', str(os.getuid()), '-f', '--', '--user-data-dir=' + state['profile']], check=False)


def asked(held):
    if PAD <= held:
        return True
    return ecodes.KEY_BACKSPACE in held and bool(held & KEYS_CTRL) and bool(held & KEYS_ALT)


class Asks(BaseHTTPRequestHandler):
    """What the dashboard may ask: to leave, and to say which page is up. Anything else is not found."""

    def answer(self):
        path = self.path.split('?')[0].rstrip('/')
        if path == '/leave':
            self.send_response(204)
            self.end_headers()
            leave()
            os._exit(0)
        if path.startswith('/page/') and path[6:] in PAGES:
            state['page'] = path[6:]
            self.send_response(204)
        else:
            self.send_response(404)
        self.end_headers()

    do_GET = answer
    do_POST = answer

    def log_message(self, *args):
        pass


def listen():
    try:
        HTTPServer.allow_reuse_address = True
        server = HTTPServer(LISTEN, Asks)
    except OSError as error:
        print('exit-watch: the listener could not start, so Esc in the dashboard will not leave:', error, file=sys.stderr)
        return
    threading.Thread(target=server.serve_forever, daemon=True).start()


def main():
    state['profile'] = sys.argv[1]
    if len(sys.argv) > 2 and sys.argv[2] in PAGES:
        state['page'] = sys.argv[2]
    listen()

    selector = selectors.DefaultSelector()
    devices = {}
    held = {}
    scanned = 0.0
    while True:
        now = time.monotonic()
        if now - scanned >= RESCAN_SECONDS:
            scanned = now
            for path in evdev.list_devices():
                if path in devices:
                    continue
                try:
                    device = evdev.InputDevice(path)
                    if not wanted(device):
                        device.close()
                        continue
                    selector.register(device, selectors.EVENT_READ)
                    devices[path] = device
                    held[path] = set()
                except OSError:
                    continue
        for key, _ in selector.select(timeout=RESCAN_SECONDS):
            device = key.fileobj
            try:
                for event in device.read():
                    if event.type != ecodes.EV_KEY:
                        continue
                    if event.value == 0:
                        held[device.path].discard(event.code)
                    else:
                        held[device.path].add(event.code)
                    escape = event.code == ecodes.KEY_ESC and event.value == 1 and state['page'] == 'control'
                    if escape or asked(held[device.path]):
                        leave()
                        return
            except OSError:
                selector.unregister(device)
                devices.pop(device.path, None)
                held.pop(device.path, None)


if __name__ == '__main__':
    main()
