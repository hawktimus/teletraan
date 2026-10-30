// The hosts the Teletraan computer contacts, and the two commands built on that list.
//
//   node hosts.mjs allowlist [--extras '<json>']    the hostnames for the school IT office, one line of purpose each
//   node hosts.mjs test      [--extras '<json>']    the full diagnostic once for every source, as a table
//
// Nothing is typed in here twice. Each address is read from the file that uses it (the project ID from
// dashboard/config.js, the weather address from core/weather.js, the Monday, TBA, Statbotics, Match13, Drive and Slides
// addresses from the scripts that call them), so a changed address changes the list. The hosts that only local.env knows
// (the calendar feeds, the heartbeat, the push address and the netwatch host) come in as --extras, which
// allowlist.sh builds from the names CALENDAR_<ID>_URL, HEARTBEAT_URL, NOTIFY_URL and NETWATCH_HOST. It passes the
// hostname only, so no path and no token is ever in this process.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanity, sanityImageHost, location } from '../../dashboard/config.js';
import { forecastUrl } from '../../dashboard/core/weather.js';
import { addressOf } from '../../dashboard/core/sanity-query.js';
import { probe } from './net-probe.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// Where a script keeps the address of a service: the file, and a pattern whose first group is the host
const inScripts = [
  { name: 'monday', purpose: 'the Monday boards (tasks)', file: 'monday-contract.sh', pattern: /monday_address='https:\/\/([^/']+)/ },
  { name: 'competition', purpose: 'The Blue Alliance, the FRC match and ranking data', file: 'frc-contract.sh', pattern: /tba_host='https:\/\/([^/']+)/ },
  { name: 'competition', purpose: 'Statbotics, the FRC team ratings', file: 'frc-contract.sh', pattern: /statbotics_host='https:\/\/([^/']+)/ },
  { name: 'news', purpose: 'the FIRST community blog headlines', file: 'news-sync.sh', pattern: /^feed_url=https:\/\/([^/\s]+)/m },
  { name: 'match13', purpose: 'Match13, the forecasts of the coming matches', file: 'match13-sync.sh', pattern: /^host='https:\/\/([^/']+)/m },
  { name: 'photos', purpose: 'the Google Drive photo folder (the list of pictures)', file: 'photos-drive-sync.sh', pattern: /list_url="https:\/\/([^/]+)/ },
  { name: 'slides', purpose: 'Google Slides, the decks of booked talks', file: 'slides-sync.sh', pattern: /"https:\/\/([^/$]+)\/presentation\/d\// },
];

// The list of { name, purpose, host, url, expectedType }. url is what the diagnostic asks for: a real question where there
// is one (the content query, the forecast) and the front of the host otherwise. extras is [{ name, purpose, host }].
export function sourceHosts(extras = [], scriptsFolder = here) {
  const list = [];
  const project = sanity.projectId;
  const sanityHost = project + '.api.sanity.io';

  list.push({ name: 'sanity', purpose: "the editors' content, read only (the dataset is public)", host: sanityHost, url: addressOf(sanity, '{ "count": count(*) }'), expectedType: 'json' });
  list.push({ name: 'images', purpose: "the pictures of the editors' content", host: sanityImageHost, url: 'https://' + sanityImageHost + '/', expectedType: '' });
  const weather = new URL(forecastUrl(location));
  list.push({ name: 'weather', purpose: 'the weather (no key needed)', host: weather.hostname, url: weather.href, expectedType: 'json' });

  inScripts.forEach(entry => {
    let text = '';
    try {
      text = fs.readFileSync(path.join(scriptsFolder, entry.file), 'utf8');
    } catch (error) {
      return;
    }
    const found = entry.pattern.exec(text);
    if (found) list.push({ name: entry.name, purpose: entry.purpose, host: found[1], url: 'https://' + found[1] + '/', expectedType: '' });
  });

  extras.forEach(extra => {
    if (extra && /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(String(extra.host || ''))) {
      list.push({ name: String(extra.name), purpose: String(extra.purpose), host: extra.host, url: 'https://' + extra.host + '/', expectedType: '' });
    }
  });
  return list;
}

// One line for each host, with what it is for. A host that serves two things has both purposes on its line.
export function allowlistText(list) {
  const byHost = new Map();
  list.forEach(item => {
    if (!byHost.has(item.host)) byHost.set(item.host, []);
    if (!byHost.get(item.host).includes(item.purpose)) byHost.get(item.host).push(item.purpose);
  });
  const width = Math.max(...Array.from(byHost.keys()).map(host => host.length)) + 2;
  const lines = [
    'Teletraan I, the wall display of FRC team 3229 (Hawktimus): the hostnames it contacts.',
    'Every connection starts from the display, goes out over HTTPS (port 443) and is made by a script of the team.',
    'Nothing connects in to it from outside. Please allow these hostnames:',
    '',
  ];
  byHost.forEach((purposes, host) => lines.push('  ' + host.padEnd(width) + purposes.join('; ')));
  lines.push('', byHost.size + ' hostnames. The team can answer questions about any of them.');
  return lines.join('\n');
}

function cell(text, width) {
  return String(text).slice(0, width).padEnd(width);
}

function partText(part) {
  if (!part) return '-';
  return part.ok ? 'ok ' + part.ms + 'ms' : part.error || 'fail';
}

// Runs the diagnostic once for every source and gives the table as text. probeFn is replaced by tests.
export async function diagnosticTable(list, probeFn = probe) {
  const rows = [];
  for (const item of list) {
    const result = await probeFn(item.url, { expectedType: item.expectedType });
    const reached = Boolean(result.http && result.http.ok) && !result.blockPage;
    const need200 = item.expectedType !== '';
    const good = need200 ? result.ok : reached;
    rows.push([
      item.name, item.host, partText(result.dns), partText(result.tcp), partText(result.tls),
      result.http ? (result.http.ok ? result.http.status : 'fail') : '-', result.http && result.http.contentType ? result.http.contentType : '-',
      result.blockPage ? 'BLOCK PAGE' : 'no', good ? 'ok' : (result.summary || 'fail'),
    ]);
  }
  const heads = ['SOURCE', 'HOST', 'DNS', 'TCP', 'TLS', 'HTTP', 'TYPE', 'BLOCKED', 'RESULT'];
  const widths = [12, 38, 10, 10, 10, 5, 22, 10, 30];
  const lines = [heads.map((head, index) => cell(head, widths[index])).join(' '), widths.map(width => '-'.repeat(width)).join(' ')];
  rows.forEach(row => lines.push(row.map((value, index) => cell(value, widths[index])).join(' ').trimEnd()));
  const bad = rows.filter(row => row[8] !== 'ok').length;
  lines.push('', bad === 0 ? 'Every source answered.' : bad + ' of ' + rows.length + ' sources did not answer as expected. The log has the steps: make logs.');
  return { text: lines.join('\n'), bad: bad };
}

function extrasFromArguments(args) {
  const at = args.indexOf('--extras');
  if (at === -1) return [];
  try {
    const parsed = JSON.parse(args[at + 1] || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, ...rest] = process.argv.slice(2);
  const list = sourceHosts(extrasFromArguments(rest));
  if (command === 'allowlist') {
    console.log(allowlistText(list));
  } else if (command === 'test') {
    const result = await diagnosticTable(list);
    console.log(result.text);
    process.exit(result.bad === 0 ? 0 : 1);
  } else {
    console.error('Usage: node hosts.mjs allowlist|test [--extras <json>]');
    process.exit(2);
  }
}
