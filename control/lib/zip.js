// Reads a zip with the standard library only. It refuses what a repository folder never holds: names that
// climb out of the folder, absolute names, symbolic links, zip64, encryption, and a zip that unpacks to far more
// than it weighs. Methods are stored and deflate, which is all a browser's zip uses.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const limits = {
  zipBytes: 100 * 1024 * 1024,
  unpackedBytes: 400 * 1024 * 1024,
  entries: 20000,
};

let crcTable = null;
export function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function fail(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

// The reason a name in a zip is refused, or ''
export function nameProblem(name) {
  if (name === '' || name.includes('\0') || name.includes('\\')) return 'a name with a character a folder never has';
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name)) return 'a name that starts at the top of the disk';
  if (name.split('/').some(part => part === '..')) return 'a name that climbs out of the folder';
  return '';
}

// The entries of a zip: [{ name, directory, mode, size, read() }]. read() gives the checked bytes.
export function readZip(buffer, options = {}) {
  const maxBytes = options.unpackedBytes || limits.unpackedBytes;
  const maxEntries = options.entries || limits.entries;

  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 65535); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw fail('This is not a zip file.');
  const count = buffer.readUInt16LE(end + 10);
  const size = buffer.readUInt32LE(end + 12);
  const offset = buffer.readUInt32LE(end + 16);
  if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff) throw fail('Zip64 files are not accepted.');
  if (count > maxEntries) throw fail('The zip holds more than ' + maxEntries + ' files.');

  const entries = [];
  let at = offset;
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (at + 46 > buffer.length || buffer.readUInt32LE(at) !== 0x02014b50) throw fail('The zip is damaged.');
    const madeBy = buffer.readUInt16LE(at + 4);
    const flags = buffer.readUInt16LE(at + 8);
    const method = buffer.readUInt16LE(at + 10);
    const crc = buffer.readUInt32LE(at + 16);
    const packed = buffer.readUInt32LE(at + 20);
    const unpacked = buffer.readUInt32LE(at + 24);
    const nameLength = buffer.readUInt16LE(at + 28);
    const extraLength = buffer.readUInt16LE(at + 30);
    const commentLength = buffer.readUInt16LE(at + 32);
    const attributes = buffer.readUInt32LE(at + 38);
    const localAt = buffer.readUInt32LE(at + 42);
    const name = buffer.toString('utf8', at + 46, at + 46 + nameLength);
    at += 46 + nameLength + extraLength + commentLength;

    if (flags & 1) throw fail('An encrypted zip is not accepted.');
    const problem = nameProblem(name);
    if (problem) throw fail('The zip has ' + problem + '.');
    const unixMode = madeBy >> 8 === 3 ? (attributes >>> 16) & 0xffff : 0;
    if ((unixMode & 0xf000) === 0xa000) throw fail('The zip holds a symbolic link (' + name + ').');
    total += unpacked;
    if (total > maxBytes) throw fail('The zip unpacks to more than ' + Math.round(maxBytes / 1048576) + ' MB.');

    const directory = name.endsWith('/');
    entries.push({
      name: directory ? name.slice(0, -1) : name,
      directory: directory,
      mode: unixMode & 0o777,
      size: unpacked,
      read() {
        if (localAt + 30 > buffer.length || buffer.readUInt32LE(localAt) !== 0x04034b50) throw fail('The zip is damaged.');
        const start = localAt + 30 + buffer.readUInt16LE(localAt + 26) + buffer.readUInt16LE(localAt + 28);
        const data = buffer.subarray(start, start + packed);
        let bytes;
        if (method === 0) bytes = data;
        else if (method === 8) bytes = zlib.inflateRawSync(data, { maxOutputLength: Math.max(unpacked, 1) });
        else throw fail('The zip uses a method this page does not read (' + name + ').');
        if (bytes.length !== unpacked || crc32(bytes) !== crc) throw fail('The file ' + name + ' in the zip is damaged.');
        return bytes;
      },
    });
  }
  return entries;
}

// When every file sits inside one folder (a zip made by right-clicking a folder), that folder name; else ''
export function commonFolder(entries) {
  const names = entries.filter(entry => !entry.directory).map(entry => entry.name);
  if (names.length === 0) return '';
  const first = names[0].split('/')[0];
  if (!names.every(name => name.startsWith(first + '/'))) return '';
  return names.includes('dashboard/index.html') ? '' : first;
}

// Writes the files of a zip under a folder. Returns the number of files written.
export function extractZip(buffer, destination, options = {}) {
  const entries = readZip(buffer, options);
  const strip = commonFolder(entries);
  fs.mkdirSync(destination, { recursive: true });
  let written = 0;
  for (const entry of entries) {
    const name = strip ? entry.name.slice(strip.length + 1) : entry.name;
    if (name === '') continue;
    const target = path.join(destination, name);
    if (path.relative(destination, target).startsWith('..')) throw fail('The zip has a name that climbs out of the folder.');
    if (entry.directory) {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const bytes = entry.read();
    // A browser's zip carries no permissions, so a script is told by its first line
    const script = bytes.length > 2 && bytes[0] === 0x23 && bytes[1] === 0x21;
    fs.writeFileSync(target, bytes, { mode: script || entry.mode & 0o100 ? 0o755 : 0o644 });
    written++;
  }
  return written;
}
