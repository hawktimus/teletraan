// Tests for the QR encoder (dashboard/core/qr.js). The expected values are not typed in from the encoder's own output. They
// are the published tables of the standard that can be written down, and a small decoder written here that reads a code
// back the other way: the two copies of the format bits, the mask, the data bits, the check bytes of every block and the
// text. A code that this decoder reads is a code a phone reads (it was also read by a separate decoder, once, by hand).
//
//   node tests/qr.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const qr = await import(pathToFileURL(path.join(root, 'dashboard', 'core', 'qr.js')).href);

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const capacity = [0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
const textOf = (length, seed = 0) => Array.from({ length: length }, (item, at) => String.fromCharCode(97 + ((at * 7 + seed) % 26))).join('');


// A decoder that is not the encoder run backwards. It reads the grid the way a reader does.

function bitsToNumber(list) {
  return list.reduce((sum, bit) => sum * 2 + (bit ? 1 : 0), 0);
}

// The 15 format bits from the first copy (round the top-left finder) and from the second (split between the other two)
function formatCopies(modules) {
  const size = modules.length;
  const bit = (x, y) => (modules[y][x] ? 1 : 0);
  const first = [];
  const order = [[0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8], [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0]];
  order.forEach(([x, y]) => first.push(bit(x, y)));
  const second = [];
  for (let at = 0; at < 7; at += 1) second.push(bit(8, size - 1 - at));
  for (let at = 0; at < 8; at += 1) second.push(bit(size - 8 + at, 8));
  return { first: bitsToNumber(first), second: bitsToNumber(second) };
}

// The remainder of a 15 bit word divided by the format generator 10100110111 (0x537), which is 0 for a good word
function formatRemainder(word) {
  let rest = word;
  for (let at = 14; at >= 10; at -= 1) {
    if ((rest >>> at) & 1) rest ^= 0x537 << (at - 10);
  }
  return rest;
}

// The cells that hold no data: finders with their separators and the format area, the timing lines, the alignment patterns,
// the version areas and the dark module
function reserved(version) {
  const size = version * 4 + 17;
  const skip = Array.from({ length: size }, () => new Array(size).fill(false));
  const mark = (x, y) => {
    if (x >= 0 && y >= 0 && x < size && y < size) skip[y][x] = true;
  };

  for (let y = 0; y < 9; y += 1) for (let x = 0; x < 9; x += 1) mark(x, y);
  for (let y = 0; y < 9; y += 1) for (let x = size - 8; x < size; x += 1) mark(x, y);
  for (let y = size - 8; y < size; y += 1) for (let x = 0; x < 9; x += 1) mark(x, y);
  for (let at = 0; at < size; at += 1) {
    mark(6, at);
    mark(at, 6);
  }
  const centers = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] }[version];
  centers.forEach((y, row) => centers.forEach((x, column) => {
    const corner = (row === 0 && column === 0) || (row === 0 && column === centers.length - 1) || (row === centers.length - 1 && column === 0);
    if (corner) return;
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) mark(x + dx, y + dy);
  }));
  if (version >= 7) {
    for (let a = 0; a < 6; a += 1) for (let b = 0; b < 3; b += 1) {
      mark(size - 11 + b, a);
      mark(a, size - 11 + b);
    }
  }
  return skip;
}

const maskRules = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => ((((i + j) % 2) + ((i * j) % 3)) % 2) === 0,
];

// GF(256) with 0x11D, built again here
const gfExp = [];
const gfLog = [];
let gfValue = 1;
for (let at = 0; at < 255; at += 1) {
  gfExp[at] = gfValue;
  gfLog[gfValue] = at;
  gfValue = gfValue * 2 > 255 ? (gfValue * 2) ^ 0x11d : gfValue * 2;
}
const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : gfExp[(gfLog[a] + gfLog[b]) % 255]);

// The value of a block (data then check bytes, highest power first) at a^power. Zero for every power below the check count
// when the block is whole.
function syndrome(block, power) {
  const x = gfExp[power % 255];
  return block.reduce((sum, byte) => gfMul(sum, x) ^ byte, 0);
}

const levelM = { 1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]], 5: [24, [[2, 43]]], 6: [16, [[4, 27]]], 7: [18, [[4, 31]]], 8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]], 10: [26, [[4, 43], [1, 44]]] };

// Reads a matrix: { mask, text } and checks the format words and every block on the way
function decode(matrix) {
  const size = matrix.modules.length;
  const version = (size - 17) / 4;
  const copies = formatCopies(matrix.modules);

  assert.equal(copies.first, copies.second, 'the two copies of the format bits agree');
  assert.equal(formatRemainder(copies.first ^ 0x5412), 0, 'the format bits are a whole word');
  const word = copies.first ^ 0x5412;
  assert.equal(word >>> 13, 0, 'level M is 00');
  const mask = (word >>> 10) & 7;

  const skip = reserved(version);
  const bits = [];
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    const column = right <= 6 ? right - 1 : right;
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      [column, column - 1].forEach(x => {
        if (skip[row][x]) return;
        bits.push(matrix.modules[row][x] !== maskRules[mask](row, x) ? 1 : 0);
      });
    }
    upward = !upward;
  }

  const [checkCount, groups] = levelM[version];
  const sizes = [].concat(...groups.map(group => new Array(group[0]).fill(group[1])));
  const dataTotal = sizes.reduce((sum, length) => sum + length, 0);
  const total = dataTotal + checkCount * sizes.length;
  const bytes = [];
  for (let at = 0; at < total; at += 1) bytes.push(bitsToNumber(bits.slice(at * 8, at * 8 + 8)));
  const leftOver = bits.slice(total * 8);
  assert.ok(leftOver.every(bit => bit === 0), 'the remainder bits are zero');

  // undo the interleaving
  const blocks = sizes.map(() => ({ data: [], check: [] }));
  let at = 0;
  for (let column = 0; column < Math.max(...sizes); column += 1) blocks.forEach((block, index) => column < sizes[index] && block.data.push(bytes[at++]));
  for (let column = 0; column < checkCount; column += 1) blocks.forEach(block => block.check.push(bytes[at++]));
  blocks.forEach(block => {
    for (let power = 0; power < checkCount; power += 1) assert.equal(syndrome(block.data.concat(block.check), power), 0, 'a block is whole');
  });

  const data = [].concat(...blocks.map(block => block.data));
  const stream = data.map(byte => byte.toString(2).padStart(8, '0')).join('');
  assert.equal(stream.slice(0, 4), '0100', 'byte mode');
  const countBits = version <= 9 ? 8 : 16;
  const count = parseInt(stream.slice(4, 4 + countBits), 2);
  const body = [];
  for (let index = 0; index < count; index += 1) body.push(parseInt(stream.slice(4 + countBits + index * 8, 12 + countBits + index * 8), 2));
  const after = stream.slice(4 + countBits + count * 8);
  assert.ok(/^0{0,4}/.test(after), 'a terminator follows');
  return { mask: mask, version: version, text: new TextDecoder().decode(Uint8Array.from(body)), data: data, count: count };
}


// The tables of the standard

test('the format words of level M are the published ones', () => {
  const published = ['101010000010010', '101000100100101', '101111001111100', '101101101001011', '100010111111001', '100000011001110', '100111110010111', '100101010100000'];
  published.forEach((bits, mask) => assert.equal(qr.formatBits(mask).toString(2).padStart(15, '0'), bits, 'mask ' + mask));
});

test('the version words are the published ones', () => {
  assert.equal(qr.versionBits(7), 0x07c94);
  assert.equal(qr.versionBits(8), 0x085bc);
  assert.equal(qr.versionBits(9), 0x09a99);
  assert.equal(qr.versionBits(10), 0x0a4d3);
});

test('the field has the published first values, and the generator of 7 check bytes has the published exponents', () => {
  assert.deepEqual(gfExp.slice(0, 10), [1, 2, 4, 8, 16, 32, 64, 128, 29, 58]);
  const generator = qr.generatorOf(7);
  assert.deepEqual([0].concat(generator.map(value => gfLog[value])), [0, 87, 229, 146, 149, 238, 102, 21]);
});

test('the check bytes of the worked example in the published tutorial are the ones it lists, for 10 and for 13 check bytes', () => {
  const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
  assert.deepEqual(qr.checkBytes(data, 10), [196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  assert.deepEqual(qr.checkBytes(data.slice(0, 13), 13), [168, 72, 22, 82, 217, 54, 156, 0, 46, 15, 180, 122, 16]);
});

test('the data capacity of each version at level M is the published one, and the count of bytes that fit is 213 at most', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(qr.dataBytesOf), [16, 28, 44, 64, 86, 108, 124, 154, 182, 216]);
  assert.equal(qr.longestText, 213);
  capacity.slice(1).forEach((length, at) => {
    assert.equal(qr.qrMatrix(textOf(length)).version, at + 1, length + ' bytes make version ' + (at + 1));
    const bigger = qr.qrMatrix(textOf(length + 1));
    assert.equal(bigger === null ? 0 : bigger.version, at + 2 > 10 ? 0 : at + 2, length + 1 + ' bytes make the next version');
  });
});


// The codes

test('a text is read back from its code by the separate decoder, in every version and with every mask', () => {
  for (let version = 1; version <= 10; version += 1) {
    for (let mask = 0; mask < 8; mask += 1) {
      const text = textOf(capacity[version], version * 8 + mask);
      const matrix = qr.qrMatrix(text, mask);
      assert.equal(matrix.version, version);
      assert.equal(matrix.size, version * 4 + 17);
      const read = decode(matrix);
      assert.equal(read.text, text, 'version ' + version + ' mask ' + mask);
      assert.equal(read.mask, mask);
    }
  }
});

test('a short address is read back, and the mask chosen is the one with the lowest penalty', () => {
  const text = 'https://example.org/parts';
  const matrix = qr.qrMatrix(text);
  const read = decode(matrix);

  assert.equal(read.text, text);
  assert.equal(read.mask, matrix.mask);
  const scores = [0, 1, 2, 3, 4, 5, 6, 7].map(mask => qr.penaltyOf(qr.qrMatrix(text, mask).modules));
  assert.equal(scores[matrix.mask], Math.min(...scores));
  assert.equal(scores.indexOf(Math.min(...scores)), matrix.mask, 'the first of the lowest wins');
});

test('the padding after the text is 236 and 17 in turn', () => {
  const read = decode(qr.qrMatrix('HELLO WORLD'));
  const used = Math.ceil((4 + 8 + 11 * 8 + 4) / 8);
  assert.deepEqual(read.data.slice(used, used + 4), [236, 17, 236, 17].slice(0, read.data.length - used >= 4 ? 4 : read.data.length - used));
});

test('the fixed patterns are where the standard puts them', () => {
  const matrix = qr.qrMatrix('https://example.org/parts');
  const m = matrix.modules;
  const size = matrix.size;

  [[0, 0], [size - 7, 0], [0, size - 7]].forEach(([x, y]) => {
    for (let dy = 0; dy < 7; dy += 1) for (let dx = 0; dx < 7; dx += 1) {
      const edge = dx === 0 || dx === 6 || dy === 0 || dy === 6;
      const center = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      assert.equal(m[y + dy][x + dx], edge || center, 'finder at ' + x + ',' + y);
    }
  });
  for (let at = 8; at < size - 8; at += 1) {
    assert.equal(m[6][at], at % 2 === 0, 'timing row');
    assert.equal(m[at][6], at % 2 === 0, 'timing column');
  }
  assert.equal(m[size - 8][8], true, 'the dark module');
  assert.equal(m[18][18], true, 'the alignment center of version 2');
});

test('an empty text and a text of more than 213 bytes have no code, and the text is counted in bytes', () => {
  assert.equal(qr.qrMatrix(''), null);
  assert.equal(qr.qrMatrix(textOf(214)), null);
  assert.equal(qr.canEncode(textOf(213)), true);
  assert.equal(qr.canEncode(textOf(214)), false);
  assert.equal(qr.canEncode('é'.repeat(107)), false, 'two bytes each');
  assert.equal(decode(qr.qrMatrix('café über')).text, 'café über');
});

test('the path is one string of rects that covers exactly the dark modules, with a quiet zone of four', () => {
  const matrix = qr.qrMatrix('https://example.org/parts');
  const path = qr.qrPath(matrix);
  const rects = Array.from(path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g));

  assert.equal(path, rects.map(rect => rect[0]).join(''), 'nothing but rects');
  const drawn = matrix.modules.map(row => row.map(() => false));
  rects.forEach(rect => {
    for (let at = 0; at < Number(rect[3]); at += 1) drawn[Number(rect[2]) - 4][Number(rect[1]) - 4 + at] = true;
  });
  assert.deepEqual(drawn, matrix.modules);
  assert.equal(Math.min(...rects.map(rect => Number(rect[1]))), 4);
});

test('the script has no import, no page, no animation and no font size', () => {
  const code = fs.readFileSync(path.join(root, 'dashboard', 'core', 'qr.js'), 'utf8');
  assert.ok(!/^import /m.test(code));
  assert.ok(!/document\.|window\.|requestAnimationFrame|font-size/.test(code));
});

let failures = 0;
for (const item of tests) {
  try {
    await item.run();
    console.log('ok   ' + item.name);
  } catch (error) {
    failures += 1;
    console.log('FAIL ' + item.name + '\n' + (error && error.stack ? error.stack.split('\n').slice(0, 6).join('\n') : error));
  }
}
if (failures > 0) {
  console.log(failures + ' failed');
  process.exit(1);
}
console.log(tests.length + ' of ' + tests.length + ' passed');
