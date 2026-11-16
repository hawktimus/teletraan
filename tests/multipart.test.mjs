// control/lib/multipart.js reads the body of an upload that a person on the network sends, so it is held to what it does
// with the odd bodies: no boundary, a boundary with quotes, a file whose bytes hold the text of a boundary, a part with no
// name, a body that stops half way, and the same field twice. docs/audit.md, item 20.
//
//   node tests/multipart.test.mjs

import assert from 'node:assert/strict';
import { test, finish } from './helpers/runner.mjs';
import { parseMultipart } from '../control/lib/multipart.js';

const type = 'multipart/form-data; boundary=XyZ';

function part(headers, data) {
  return Buffer.concat([Buffer.from('--XyZ\r\n' + headers + '\r\n\r\n'), Buffer.isBuffer(data) ? data : Buffer.from(data), Buffer.from('\r\n')]);
}
const end = Buffer.from('--XyZ--\r\n');
const body = (...parts) => Buffer.concat(parts.concat([end]));

test('a field is text and a file is a Buffer with its name', () => {
  const found = parseMultipart(body(
    part('Content-Disposition: form-data; name="note"', 'First push'),
    part('Content-Disposition: form-data; name="zip"; filename="teletraan.zip"\r\nContent-Type: application/zip', Buffer.from([0x50, 0x4b, 3, 4, 0, 255, 13, 10])),
  ), type);
  assert.deepEqual(found.fields, { note: 'First push' });
  assert.equal(found.files.zip.filename, 'teletraan.zip');
  assert.deepEqual(Array.from(found.files.zip.data), [0x50, 0x4b, 3, 4, 0, 255, 13, 10], 'the bytes of a file come back as they went in, a line break inside included');
});

test('the boundary may be in quotes, and a content type with no boundary is refused with 400', () => {
  const quoted = parseMultipart(body(part('Content-Disposition: form-data; name="a"', '1')), 'multipart/form-data; boundary="XyZ"');
  assert.deepEqual(quoted.fields, { a: '1' });
  [undefined, '', 'application/json', 'multipart/form-data'].forEach(value => {
    assert.throws(() => parseMultipart(Buffer.from('x'), value), error => error.status === 400 && /not a form/.test(error.message), String(value));
  });
});

test('an empty value, a part with no name and a part with no headers end are kept out or kept empty, never thrown on', () => {
  const found = parseMultipart(body(
    part('Content-Disposition: form-data; name="empty"', ''),
    part('Content-Disposition: form-data', 'nobody names me'),
    Buffer.from('--XyZ\r\nno header end here\r\n'),
    part('Content-Disposition: form-data; name="after"', 'still read'),
  ), type);
  assert.equal(found.fields.empty, '');
  assert.equal(found.fields.after, 'still read');
  assert.deepEqual(Object.keys(found.fields).sort(), ['after', 'empty']);
  assert.deepEqual(found.files, {});
});

test('a body that stops half way gives what came before, and no body gives nothing', () => {
  const cut = Buffer.concat([part('Content-Disposition: form-data; name="a"', '1'), Buffer.from('--XyZ\r\nContent-Disposition: form-data; name="b"\r\n\r\ntrunc')]);
  assert.deepEqual(parseMultipart(cut, type).fields, { a: '1' }, 'the part that never ended is dropped');
  assert.deepEqual(parseMultipart(Buffer.alloc(0), type), { fields: {}, files: {} });
  assert.deepEqual(parseMultipart(Buffer.from('not multipart at all'), type), { fields: {}, files: {} });
});

test('the same name twice keeps the last one, and a file is kept apart from a field of the same name', () => {
  const found = parseMultipart(body(
    part('Content-Disposition: form-data; name="x"', 'first'),
    part('Content-Disposition: form-data; name="x"', 'second'),
    part('Content-Disposition: form-data; name="x"; filename="f.txt"', 'file'),
  ), type);
  assert.equal(found.fields.x, 'second');
  assert.equal(found.files.x.filename, 'f.txt');
});

test('a file name with a path is returned as sent: the caller never uses it to write a file', () => {
  const found = parseMultipart(body(part('Content-Disposition: form-data; name="zip"; filename="../../etc/passwd"', 'x')), type);
  assert.equal(found.files.zip.filename, '../../etc/passwd');
});

test('a big body of 20 MB is read in one pass and keeps every byte', () => {
  const data = Buffer.alloc(20 * 1024 * 1024, 0xab);
  const found = parseMultipart(body(part('Content-Disposition: form-data; name="zip"; filename="big.zip"', data)), type);
  assert.equal(found.files.zip.data.length, data.length);
  assert.equal(found.files.zip.data[data.length - 1], 0xab);
});

finish();
