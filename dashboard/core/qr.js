// A small QR code encoder for the Parts request panel (panels/qrParts). Plain functions with no page in them, so that
// tests/qr.test.mjs can run them. It makes one kind of code only: byte mode, error correction level M, versions 1 to 10,
// which holds a text of up to 213 bytes. The steps are the ones of the QR standard (ISO 18004):
//
//   1. the text becomes bytes (UTF-8), a mode and a count in front, a terminator and padding after
//   2. the bytes are cut into blocks, each block gets Reed-Solomon check bytes (GF(256), polynomial 0x11D), and the
//      blocks are interleaved
//   3. the bits are placed in the grid round the fixed patterns (finders, timing, alignment, version and format areas)
//   4. the eight masks are tried and the one with the lowest penalty is kept, and its format bits are written
//
// qrMatrix(text) gives { size, version, mask, modules } where modules[row][column] is true for a dark module. qrPath(matrix)
// draws the dark modules as the rects of one SVG path.

export const longestText = 213;

// Level M by version: the check bytes of each block, then the blocks as [count, data bytes in each]
const blockTable = [
  null,
  { ec: 10, blocks: [[1, 16]] },
  { ec: 16, blocks: [[1, 28]] },
  { ec: 26, blocks: [[1, 44]] },
  { ec: 18, blocks: [[2, 32]] },
  { ec: 24, blocks: [[2, 43]] },
  { ec: 16, blocks: [[4, 27]] },
  { ec: 18, blocks: [[4, 31]] },
  { ec: 22, blocks: [[2, 38], [2, 39]] },
  { ec: 22, blocks: [[3, 36], [2, 37]] },
  { ec: 26, blocks: [[4, 43], [1, 44]] },
];

// The middle positions of the alignment patterns by version
const alignmentTable = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

// Version 1 to 6 have 7 bits left over after the last byte, and 7 to 10 have none (version 1 has none either)
function remainderBits(version) {
  return version >= 2 && version <= 6 ? 7 : 0;
}

export function dataBytesOf(version) {
  return blockTable[version].blocks.reduce((sum, group) => sum + group[0] * group[1], 0);
}


// Arithmetic in GF(256), with x^8 + x^4 + x^3 + x^2 + 1

const exp = new Array(512);
const log = new Array(256);

(function fillTables() {
  let value = 1;
  for (let power = 0; power < 255; power += 1) {
    exp[power] = value;
    log[value] = power;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let power = 255; power < 512; power += 1) exp[power] = exp[power - 255];
}());

function times(a, b) {
  return a === 0 || b === 0 ? 0 : exp[log[a] + log[b]];
}

// The generator polynomial of a degree: (x - a^0)(x - a^1)... The coefficients, highest power first, without the leading 1.
export function generatorOf(degree) {
  let result = [1];

  for (let power = 0; power < degree; power += 1) {
    const next = new Array(result.length + 1).fill(0);
    result.forEach((coefficient, at) => {
      next[at] ^= coefficient;
      next[at + 1] ^= times(coefficient, exp[power]);
    });
    result = next;
  }
  return result.slice(1);
}

// The check bytes of a list of data bytes: the remainder of the data times x^degree, divided by the generator
export function checkBytes(data, degree) {
  const generator = generatorOf(degree);
  const rest = new Array(degree).fill(0);

  data.forEach(byte => {
    const factor = byte ^ rest.shift();
    rest.push(0);
    generator.forEach((coefficient, at) => {
      rest[at] ^= times(coefficient, factor);
    });
  });
  return rest;
}


// The bytes of a code

function utf8Of(text) {
  return Array.from(new TextEncoder().encode(String(text)));
}

// The smallest version that holds the byte count, or 0 when none does. The count takes 8 bits up to version 9 and 16 after.
function versionFor(count) {
  for (let version = 1; version <= 10; version += 1) {
    const countBits = version <= 9 ? 8 : 16;
    if (4 + countBits + count * 8 <= dataBytesOf(version) * 8) return version;
  }
  return 0;
}

export function canEncode(text) {
  const count = utf8Of(text).length;
  return count > 0 && versionFor(count) > 0;
}

// The data bytes of a text for a version: mode 0100, the count, the text, a terminator of up to four zero bits, zero bits to
// the end of the byte, and the pad bytes 236 and 17 in turn.
export function dataBytes(text, version) {
  const bytes = utf8Of(text);
  const bits = [];
  const push = (value, length) => {
    for (let at = length - 1; at >= 0; at -= 1) bits.push((value >>> at) & 1);
  };

  push(4, 4);
  push(bytes.length, version <= 9 ? 8 : 16);
  bytes.forEach(byte => push(byte, 8));

  const capacity = dataBytesOf(version) * 8;
  push(0, Math.min(4, capacity - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const out = [];
  for (let at = 0; at < bits.length; at += 8) out.push(bits.slice(at, at + 8).reduce((sum, bit) => sum * 2 + bit, 0));
  for (let pad = 0; out.length < dataBytesOf(version); pad += 1) out.push(pad % 2 === 0 ? 236 : 17);
  return out;
}

// The data blocks of a version, each with its check bytes, and the two put in turn: the first byte of every block, the
// second of every block, and so on, then the check bytes the same way.
export function interleaved(data, version) {
  const table = blockTable[version];
  const blocks = [];
  let from = 0;

  table.blocks.forEach(group => {
    for (let count = 0; count < group[0]; count += 1) {
      const part = data.slice(from, from + group[1]);
      from += group[1];
      blocks.push({ data: part, check: checkBytes(part, table.ec) });
    }
  });

  const out = [];
  const longest = Math.max(...blocks.map(block => block.data.length));
  for (let at = 0; at < longest; at += 1) blocks.forEach(block => at < block.data.length && out.push(block.data[at]));
  for (let at = 0; at < table.ec; at += 1) blocks.forEach(block => out.push(block.check[at]));
  return out;
}


// The grid

export function sizeOf(version) {
  return version * 4 + 17;
}

// The 15 format bits for level M and a mask: 5 bits of data, 10 of BCH check (generator 0x537) and the mask 0x5412
export function formatBits(mask) {
  const data = mask; // level M is 00
  let rest = data;
  for (let step = 0; step < 10; step += 1) rest = (rest << 1) ^ ((rest >>> 9) * 0x537);
  return ((data << 10) | rest) ^ 0x5412;
}

// The 18 version bits: 6 bits of the version and 12 of BCH check (generator 0x1F25)
export function versionBits(version) {
  let rest = version;
  for (let step = 0; step < 12; step += 1) rest = (rest << 1) ^ ((rest >>> 11) * 0x1f25);
  return (version << 12) | rest;
}

function bitOf(value, at) {
  return ((value >>> at) & 1) === 1;
}

// A grid being drawn: modules, and which of them are fixed patterns (the mask and the data leave those alone)
function blankGrid(size) {
  return {
    size: size,
    modules: Array.from({ length: size }, () => new Array(size).fill(false)),
    fixed: Array.from({ length: size }, () => new Array(size).fill(false)),
  };
}

function setFixed(grid, x, y, dark) {
  grid.modules[y][x] = dark;
  grid.fixed[y][x] = true;
}

function drawFinder(grid, centerX, centerY) {
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      const x = centerX + dx;
      const y = centerY + dy;
      if (x < 0 || y < 0 || x >= grid.size || y >= grid.size) continue;

      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setFixed(grid, x, y, distance !== 2 && distance !== 4);
    }
  }
}

function drawAlignment(grid, centerX, centerY) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) setFixed(grid, centerX + dx, centerY + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
}

// The two copies of the format bits, and the one module that is always dark
function drawFormat(grid, mask) {
  const bits = formatBits(mask);
  const size = grid.size;

  for (let at = 0; at <= 5; at += 1) setFixed(grid, 8, at, bitOf(bits, at));
  setFixed(grid, 8, 7, bitOf(bits, 6));
  setFixed(grid, 8, 8, bitOf(bits, 7));
  setFixed(grid, 7, 8, bitOf(bits, 8));
  for (let at = 9; at < 15; at += 1) setFixed(grid, 14 - at, 8, bitOf(bits, at));

  for (let at = 0; at < 8; at += 1) setFixed(grid, size - 1 - at, 8, bitOf(bits, at));
  for (let at = 8; at < 15; at += 1) setFixed(grid, 8, size - 15 + at, bitOf(bits, at));
  setFixed(grid, 8, size - 8, true);
}

function drawVersion(grid, version) {
  if (version < 7) return;

  const bits = versionBits(version);
  for (let at = 0; at < 18; at += 1) {
    const a = grid.size - 11 + (at % 3);
    const b = Math.floor(at / 3);
    setFixed(grid, a, b, bitOf(bits, at));
    setFixed(grid, b, a, bitOf(bits, at));
  }
}

// The grid with every fixed pattern drawn, and the format area drawn for a mask
function patternGrid(version, mask) {
  const grid = blankGrid(sizeOf(version));
  const size = grid.size;

  for (let at = 0; at < size; at += 1) {
    setFixed(grid, 6, at, at % 2 === 0);
    setFixed(grid, at, 6, at % 2 === 0);
  }
  drawFinder(grid, 3, 3);
  drawFinder(grid, size - 4, 3);
  drawFinder(grid, 3, size - 4);

  const places = alignmentTable[version];
  places.forEach((y, row) => places.forEach((x, column) => {
    const atCorner = (row === 0 && column === 0) || (row === 0 && column === places.length - 1) || (row === places.length - 1 && column === 0);
    if (!atCorner) drawAlignment(grid, x, y);
  }));

  drawFormat(grid, mask);
  drawVersion(grid, version);
  return grid;
}

// The places of the data bits in the order they are filled: pairs of columns from the right, up and down in turn, jumping
// the timing column
export function dataPlaces(grid) {
  const places = [];

  for (let right = grid.size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < grid.size; step += 1) {
      for (let side = 0; side < 2; side += 1) {
        const x = right - side;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? grid.size - 1 - step : step;
        if (!grid.fixed[y][x]) places.push([x, y]);
      }
    }
  }
  return places;
}

export const masks = [
  (row, column) => (row + column) % 2 === 0,
  row => row % 2 === 0,
  (row, column) => column % 3 === 0,
  (row, column) => (row + column) % 3 === 0,
  (row, column) => (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0,
  (row, column) => ((row * column) % 2) + ((row * column) % 3) === 0,
  (row, column) => (((row * column) % 2) + ((row * column) % 3)) % 2 === 0,
  (row, column) => ((((row + column) % 2) + ((row * column) % 3)) % 2) === 0,
];


// Choosing the mask

// The penalty of a grid by the four rules of the standard: runs of five or more of one color in a row or column
// (3 + the extra), blocks of 2 by 2 (3 each), the finder-like pattern 1011101 with four light modules beside it (40 each),
// and how far the share of dark modules is from half (10 for each 5 percent).
export function penaltyOf(modules) {
  const size = modules.length;
  let score = 0;

  const runs = line => {
    let run = 1;
    for (let at = 1; at <= line.length; at += 1) {
      if (at < line.length && line[at] === line[at - 1]) {
        run += 1;
        continue;
      }
      if (run >= 5) score += 3 + (run - 5);
      run = 1;
    }
  };
  const finders = line => {
    const text = line.map(dark => (dark ? '1' : '0')).join('');
    ['10111010000', '00001011101'].forEach(pattern => {
      for (let at = text.indexOf(pattern); at !== -1; at = text.indexOf(pattern, at + 1)) score += 40;
    });
  };

  for (let row = 0; row < size; row += 1) {
    runs(modules[row]);
    finders(modules[row]);
  }
  for (let column = 0; column < size; column += 1) {
    const line = modules.map(row => row[column]);
    runs(line);
    finders(line);
  }
  for (let row = 0; row < size - 1; row += 1) {
    for (let column = 0; column < size - 1; column += 1) {
      const dark = modules[row][column];
      if (dark === modules[row][column + 1] && dark === modules[row + 1][column] && dark === modules[row + 1][column + 1]) score += 3;
    }
  }

  const darkCount = modules.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  score += 10 * Math.floor(Math.abs((darkCount * 100) / (size * size) - 50) / 5);
  return score;
}


// The code

// { size, version, mask, modules } for a text, or null when the text is empty or longer than longestText bytes. Only the tests
// give only (0 to 7), to draw a code with one mask.
export function qrMatrix(text, only = -1) {
  const count = utf8Of(text).length;
  const version = count === 0 ? 0 : versionFor(count);
  if (version === 0) return null;

  const stream = interleaved(dataBytes(text, version), version);
  const bits = [];
  stream.forEach(byte => {
    for (let at = 7; at >= 0; at -= 1) bits.push((byte >>> at) & 1);
  });
  for (let extra = 0; extra < remainderBits(version); extra += 1) bits.push(0);

  let best = null;
  masks.forEach((rule, mask) => {
    if (only >= 0 && mask !== only) return;

    const grid = patternGrid(version, mask);
    dataPlaces(grid).forEach(([x, y], at) => {
      const bit = at < bits.length ? bits[at] === 1 : false;
      grid.modules[y][x] = bit !== rule(y, x);
    });

    const score = penaltyOf(grid.modules);
    if (best === null || score < best.score) best = { score: score, mask: mask, modules: grid.modules };
  });
  return { size: sizeOf(version), version: version, mask: best.mask, modules: best.modules };
}

// The dark modules as the rects of one SVG path, in module units with the quiet zone (four modules) round them. Each run of
// dark modules in a row is one rect. The picture is size + 2 * quiet units wide.
export function qrPath(matrix, quiet = 4) {
  const parts = [];

  matrix.modules.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      let end = x;
      while (end < row.length && row[end]) end += 1;
      parts.push('M' + (x + quiet) + ' ' + (y + quiet) + 'h' + (end - x) + 'v1h-' + (end - x) + 'z');
      x = end;
    }
  });
  return parts.join('');
}
