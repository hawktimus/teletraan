// Makes a zip in memory for the control tests. files is { 'path/in/zip': 'text' or Buffer }. options.symlink
// names one entry to mark as a symbolic link, options.stored keeps the bytes uncompressed.

import zlib from 'node:zlib';
import { crc32 } from '../../control/lib/zip.js';

export function makeZip(files, options = {}) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const name of Object.keys(files)) {
    const data = Buffer.isBuffer(files[name]) ? files[name] : Buffer.from(files[name]);
    const packed = options.stored ? data : zlib.deflateRawSync(data);
    const method = options.stored ? 0 : 8;
    const nameBytes = Buffer.from(name);
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, packed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    const mode = name === options.symlink ? 0o120777 : 0o100644;
    central.writeUInt32LE((mode << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

// A small repository tree as { path: text }, enough to pass the install checks
export function sampleTree(extra = {}) {
  return Object.assign({
    'dashboard/index.html': '<html></html>',
    'dashboard/config.js': "export default { projectId: 'abc12345', dataset: 'production', apiVersion: '2025-02-19' };\n",
    'mini/scripts/kiosk.sh': '#!/bin/sh\necho kiosk\n',
    'control/server.js': '// server\n',
    'studio/schemas/a.js': 'export default {};\n',
  }, extra);
}
