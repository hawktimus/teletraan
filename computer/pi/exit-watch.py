#!/usr/bin/env python3
"""Closes the Teletraan browser on the Raspberry Pi when someone asks to leave.

Select + Start together on any controller, or Ctrl + Alt + Backspace on a keyboard. The browser is found by its
profile folder (the one argument), so nothing else on the Pi is touched. session.sh starts this and stops it.
"""
import selectors
import subprocess
import sys
import time

import evdev
from evdev import ecodes

PAD = {ecodes.BTN_SELECT, ecodes.BTN_START}
KEYS_CTRL = {ecodes.KEY_LEFTCTRL, ecodes.KEY_RIGHTCTRL}
KEYS_ALT = {ecodes.KEY_LEFTALT, ecodes.KEY_RIGHTALT}
RESCAN_SECONDS = 3


def wanted(device):
    keys = set(device.capabilities().get(ecodes.EV_KEY, []))
    return PAD <= keys or ecodes.KEY_BACKSPACE in keys


def leave(profile):
    subprocess.run(['pkill', '-f', '--', '--user-data-dir=' + profile], check=False)


def asked(held):
    if PAD <= held:
        return True
    return ecodes.KEY_BACKSPACE in held and bool(held & KEYS_CTRL) and bool(held & KEYS_ALT)


def main():
    profile = sys.argv[1]
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
                    if asked(held[device.path]):
                        leave(profile)
                        return
            except OSError:
                selector.unregister(device)
                devices.pop(device.path, None)
                held.pop(device.path, None)


if __name__ == '__main__':
    main()
