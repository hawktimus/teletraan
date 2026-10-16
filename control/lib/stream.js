// Starts an answer of one JSON line per install step and gives back the function that writes a line.

export function startSteps(res) {
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
  return event => res.write(JSON.stringify(event) + '\n');
}
