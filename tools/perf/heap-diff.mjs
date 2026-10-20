// Takes two heap snapshots of the screen left alone and prints what grew between them, by kind of object.
//
//   NODE_PATH=/path/to/node_modules node tools/perf/heap-diff.mjs --seconds 600
//
// A snapshot is large and slow to take, so this is for finding a slow growth that measure.mjs soak has shown, not for
// every day (docs/performance.md).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serveDashboard } from '../screenshots.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const seconds = Number(process.argv[process.argv.indexOf('--seconds') + 1]) || 600;

async function snapshot(client) {
  const chunks = [];
  const onChunk = event => chunks.push(event.chunk);
  client.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
  await client.send('HeapProfiler.collectGarbage');
  await client.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  client.off('HeapProfiler.addHeapSnapshotChunk', onChunk);
  return JSON.parse(chunks.join(''));
}

// Bytes and count for each kind of object. Strings and arrays are named by what they are, objects by their constructor.
function kinds(data) {
  const fields = data.snapshot.meta.node_fields;
  const types = data.snapshot.meta.node_types[0];
  const width = fields.length;
  const typeAt = fields.indexOf('type');
  const nameAt = fields.indexOf('name');
  const sizeAt = fields.indexOf('self_size');
  const found = {};
  for (let i = 0; i < data.nodes.length; i += width) {
    const type = types[data.nodes[i + typeAt]];
    const name = type === 'string' || type === 'concatenated string' || type === 'sliced string' ? '(string)' : data.strings[data.nodes[i + nameAt]];
    const key = type + ' ' + String(name).slice(0, 60);
    const entry = found[key] || { bytes: 0, count: 0 };
    entry.bytes += data.nodes[i + sizeAt];
    entry.count += 1;
    found[key] = entry;
  }
  return found;
}

async function main() {
  const playwright = await loadPlaywright();
  const server = await serveDashboard(path.join(root, 'dashboard'));
  const browser = await playwright.chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    const client = await context.newCDPSession(page);
    await page.route('**/control/api/**', route => route.fulfill({ status: 204 }));
    await page.goto('http://127.0.0.1:' + server.port + '/index.html?sample=1&clock=fixed&motion=full&night=off');
    await page.waitForTimeout(120000);
    await client.send('HeapProfiler.enable');
    const first = kinds(await snapshot(client));
    await page.waitForTimeout(seconds * 1000);
    const second = kinds(await snapshot(client));

    const grew = Object.keys(second).map(key => ({ key: key, bytes: second[key].bytes - (first[key] ? first[key].bytes : 0), count: second[key].count - (first[key] ? first[key].count : 0) }));
    const total = grew.reduce((sum, item) => sum + item.bytes, 0);
    console.log('grew ' + Math.round(total / 1024) + ' KB in ' + seconds + ' s. The kinds that grew most:');
    grew.sort((a, b) => b.bytes - a.bytes).slice(0, 15).forEach(item => console.log('  ' + String(Math.round(item.bytes / 1024)).padStart(7) + ' KB  ' + String(item.count).padStart(7) + ' objects  ' + item.key));
  } finally {
    await browser.close();
    await server.close();
  }
}

await main();
