# A small web server for trying the dashboard on any computer.
#
#   python3 tools/serve.py          then open http://localhost:8080/dashboard/
#   python3 tools/serve.py 9000     to use a different port
#
# It does what "python3 -m http.server" does, with one difference: it tells
# the browser never to keep old copies of files. Without that, a refresh can
# keep showing the version of a file from before you edit it.
#
# It only answers to this computer, because the folder it serves includes
# the git history and, later, settings that must not be shared.

import http.server
import os
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    # Only the dashboard and the test pages are served. Everything else in
    # the folder (the git history, deploy settings) answers 404, and so does
    # any request that does not come from this computer's own address.
    def send_head(self):
        parts = [part for part in self.path.split('?')[0].split('/') if part]
        host = self.headers.get('Host', '').split(':')[0]
        hidden = any(part.startswith('.') for part in parts)
        allowed = len(parts) > 0 and parts[0] in ('dashboard', 'tools')

        if host not in ('localhost', '127.0.0.1') or hidden or not allowed:
            self.send_error(404)
            return None
        return super().send_head()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

# serve the teletraan folder, wherever the command was run from
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

http.server.test(HandlerClass=Handler, port=port, bind='127.0.0.1')
