// Runs a program and gives back its exit code and the end of what it printed. The install steps call this
// through ctx.run, so a test can put a fake in its place.

import { spawn } from 'node:child_process';

const keep = 20000;

export function run(command, args, options = {}) {
  return new Promise(resolve => {
    let output = '';
    let child;
    try {
      child = spawn(command, args, { cwd: options.cwd, env: options.env || process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      resolve({ code: 127, output: String(error.message) });
      return;
    }
    const take = chunk => {
      output += chunk;
      if (output.length > keep * 2) output = output.slice(-keep);
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    const timer = options.timeout
      ? setTimeout(() => {
        output += '\nStopped after ' + Math.round(options.timeout / 1000) + ' seconds.\n';
        child.kill('SIGKILL');
      }, options.timeout)
      : null;
    child.on('error', error => {
      clearTimeout(timer);
      resolve({ code: 127, output: String(error.message) });
    });
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ code: code === null ? 1 : code, output: output.slice(-keep) });
    });
  });
}

// The last few lines of some output, for a message
export function tail(text, lines = 8) {
  return String(text).trim().split('\n').slice(-lines).join('\n');
}
