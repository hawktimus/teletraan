// The plain SHA-256 that the control page uses when the browser has no crypto.subtle (a page served over http)

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { sha256Hex } from '../control/static/sha256.js';
import { treeHashOfFiles } from '../control/static/tree-hash.js';

const real = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
let failed = 0;
function test(name, body) {
  Promise.resolve().then(body).then(() => console.log('ok   ' + name), error => { failed++; console.log('FAIL ' + name + '\n' + error.stack); process.exitCode = 1; });
}

test('known answers: empty, abc and the long message of the standard', () => {
  assert.equal(sha256Hex(new Uint8Array()), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex(new TextEncoder().encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256Hex(new TextEncoder().encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
});

test('the same answer as node for lengths around every block edge and for a large file', () => {
  for (let length = 0; length <= 200; length++) {
    const bytes = crypto.randomBytes(length);
    assert.equal(sha256Hex(bytes), real(bytes), 'length ' + length);
  }
  const big = crypto.randomBytes(3 * 1024 * 1024 + 17);
  assert.equal(sha256Hex(big), real(big));
});

test('the tree hash comes out the same with and without crypto.subtle', async () => {
  const noise = crypto.randomBytes(5000);
  const files = [
    { path: 'dashboard/index.html', read: async () => new TextEncoder().encode('<html></html>') },
    { path: 'control/server.js', read: async () => new TextEncoder().encode('export {};') },
    { path: 'studio/schemas/team.js', read: async () => noise },
  ];
  const withSubtle = await treeHashOfFiles(files);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
  try {
    assert.equal(await treeHashOfFiles(files), withSubtle);
  } finally {
    if (original) Object.defineProperty(globalThis, 'crypto', original); else delete globalThis.crypto;
  }
});
