#!/usr/bin/env python3
"""One command to the page on the TV, over the browser's debugging port.

  page-command.py reload          loads the page again, keeping its place (core/recover.js saves it first)
  page-command.py recover         asks the page to settle itself without loading again
  page-command.py frames          prints how many seconds ago the page last painted a frame

The supervisor uses reload as the gentlest repair there is: nothing goes black and nobody in the room sees it.
recover is gentler still and is what a display change asks for first.

The socket and the way to find the page are mirror.py's, imported rather than written again. Standard library only, and
the debugging port is on 127.0.0.1, so nothing here is reachable from the network.

Settings from the environment:
  MIRROR_PORT   the browser's debugging port (default 9222), the same name mirror.py uses
"""

import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mirror import Socket, find_page  # noqa: E402  (the path above has to be set first)

# What each word sends. reload keeps the page's address; the page itself puts back the panel it was on.
COMMANDS = {
    'reload': ('Page.reload', {'ignoreCache': False}),
    'recover': ('Runtime.evaluate', {'expression': 'window.__teletraanRecover && window.__teletraanRecover("asked")', 'returnByValue': True}),
    'frames': ('Runtime.evaluate', {'expression': 'window.__teletraanFrameAge ? window.__teletraanFrameAge() : null', 'returnByValue': True}),
}


def run(word):
    name, params = COMMANDS[word]
    page = find_page()
    socket = Socket(page['webSocketDebuggerUrl'])
    try:
        socket.send_json({'id': 1, 'method': name, 'params': params})
        # The answer to our own command, which carries the same id. Anything else on the socket is an event.
        until = time.time() + 5
        while time.time() < until:
            message = socket.receive()
            if not isinstance(message, str):
                continue
            answer = json.loads(message)
            if answer.get('id') != 1:
                continue
            if 'error' in answer:
                raise RuntimeError(str(answer['error'].get('message', 'the page refused'))[:120])
            return answer.get('result', {})
        raise RuntimeError('the page did not answer in five seconds')
    finally:
        socket.close()


def main():
    word = sys.argv[1] if len(sys.argv) > 1 else ''
    if word not in COMMANDS:
        sys.stderr.write('page-command: say one of: %s\n' % ', '.join(sorted(COMMANDS)))
        return 2
    try:
        result = run(word)
    except Exception as problem:  # every failure here is "the page could not be reached", and the caller decides
        sys.stderr.write('page-command: %s\n' % str(problem)[:160])
        return 1
    if word == 'frames':
        value = (result.get('result') or {}).get('value')
        if not isinstance(value, (int, float)):
            sys.stderr.write('page-command: the page did not say when it last painted\n')
            return 1
        print(int(value))
    return 0


if __name__ == '__main__':
    sys.exit(main())
