// Talks to the host helper (computer/scripts/control-helper.sh) over its Unix socket. One request is one line,
// "word" or "word argument", followed by a body for write-env, then the end of the stream. The answer is the
// output of the word and a last line: ok, refused, or failed <exit code>. The call gives the output as text, and
// throws an Error with a plain sentence when the helper refused, failed or could not be reached.

import net from 'node:net';

export const words = ['restart-kiosk', 'restart-services', 'reboot', 'status', 'sync-now', 'write-env', 'monday-check', 'monday-debug', 'mirror-start', 'mirror-watch', 'mirror-status', 'log-bundle'];

export function createHelper(socketPath, timeout = 30000, connect = net.createConnection) {
  return function helper(word, args = [], body = '') {
    return new Promise((resolve, reject) => {
      if (!words.includes(word) || !args.every(arg => /^[a-z0-9]{1,20}$/.test(arg))) {
        reject(new Error('That is not a word the helper knows.'));
        return;
      }
      let answer = '';
      const socket = connect(socketPath);
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error('The helper did not answer in time. Look at the Log tab, then try again. If it keeps happening, restart the Teletraan computer.'));
      }, timeout);
      socket.on('connect', () => socket.end([word].concat(args).join(' ') + '\n' + body));
      socket.on('data', chunk => { answer += chunk; });
      socket.on('error', error => {
        clearTimeout(timer);
        const failure = new Error('The control page could not reach the helper on this computer. Run the installer again.');
        failure.code = error.code;
        reject(failure);
      });
      socket.on('close', () => {
        clearTimeout(timer);
        const lines = answer.trimEnd().split('\n');
        const last = lines.pop() || '';
        const output = lines.join('\n');
        if (last === 'ok') resolve(output);
        else reject(new Error(last === 'refused' ? 'The helper refused that.' : 'The helper did not finish (' + (last || 'no answer') + ').' + (output ? ' ' + output.slice(0, 200) : '')));
      });
    });
  };
}
