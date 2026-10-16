// Reads a multipart/form-data body that is already in memory. Fields come back as text, files as Buffers.

export function parseMultipart(body, contentType) {
  const found = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!found) throw Object.assign(new Error('The upload is not a form.'), { status: 400 });
  const boundary = Buffer.from('--' + (found[1] || found[2]).trim());
  const fields = {};
  const files = {};

  let at = body.indexOf(boundary);
  while (at >= 0) {
    const start = at + boundary.length;
    if (body.subarray(start, start + 2).toString() === '--') break;
    const next = body.indexOf(boundary, start);
    if (next < 0) break;
    // A part is: \r\n headers \r\n\r\n data \r\n
    const part = body.subarray(start + 2, next - 2);
    const split = part.indexOf('\r\n\r\n');
    if (split >= 0) {
      const head = part.subarray(0, split).toString('utf8');
      const data = part.subarray(split + 4);
      const name = /name="([^"]*)"/i.exec(head);
      const file = /filename="([^"]*)"/i.exec(head);
      if (name && file) files[name[1]] = { filename: file[1], data: data };
      else if (name) fields[name[1]] = data.toString('utf8');
    }
    at = next;
  }
  return { fields: fields, files: files };
}
