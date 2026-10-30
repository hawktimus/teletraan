// What happens between this computer and one web address, step by step: the name lookup, the TCP connection, the TLS
// handshake and the HTTP answer. A school filter often shows itself in one of these: a name that does not resolve, a
// connection that is cut, a certificate of the filter, or a 200 that holds a block page instead of the real answer.
//
//   node net-probe.mjs <url> [expected content type]      prints the result as JSON
//
// probe() never throws. Every step has its own ok flag and a short error word, and blockPage is true when the answer
// looks like a page from a filter: a redirect to another host, or a 200 whose content type or body is not what the
// caller expected. The address may hold a token (a calendar feed does), so the logged detail names the host only.
import dns from 'node:dns';
import net from 'node:net';
import tls from 'node:tls';
import https from 'node:https';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { logEvent } from './jsonlog.mjs';

const stepSeconds = 8;
const bodyBytes = 2048;

function seconds() {
  return stepSeconds * 1000;
}

// The short word for an error: the system code when there is one, else the first word of the message
function errorWord(error) {
  if (!error) return '';
  return String(error.code || error.message || 'error').split(/\s/)[0].slice(0, 40);
}

function lookup(host) {
  return new Promise(resolve => {
    const started = Date.now();
    if (net.isIP(host)) {
      resolve({ ok: true, address: host, ms: 0, error: '' });
      return;
    }
    const timer = setTimeout(() => resolve({ ok: false, address: '', ms: Date.now() - started, error: 'TIMEOUT' }), seconds());
    dns.lookup(host, (error, address) => {
      clearTimeout(timer);
      resolve({ ok: !error, address: address || '', ms: Date.now() - started, error: errorWord(error) });
    });
  });
}

function connect(address, port) {
  return new Promise(resolve => {
    const started = Date.now();
    const socket = net.connect({ host: address, port: port });
    const finish = (ok, error) => {
      socket.destroy();
      resolve({ ok: ok, ms: Date.now() - started, error: error });
    };
    socket.setTimeout(seconds(), () => finish(false, 'TIMEOUT'));
    socket.on('connect', () => finish(true, ''));
    socket.on('error', error => finish(false, errorWord(error)));
  });
}

function handshake(host, address, port) {
  return new Promise(resolve => {
    const started = Date.now();
    const socket = tls.connect({ host: address, port: port, servername: host });
    const finish = (ok, error, extra) => {
      socket.destroy();
      resolve(Object.assign({ ok: ok, ms: Date.now() - started, error: error, issuer: '' }, extra));
    };
    socket.setTimeout(seconds(), () => finish(false, 'TIMEOUT'));
    socket.on('secureConnect', () => {
      const certificate = socket.getPeerCertificate();
      const issuer = certificate && certificate.issuer ? String(certificate.issuer.O || certificate.issuer.CN || '').slice(0, 60) : '';
      finish(socket.authorized, socket.authorized ? '' : errorWord({ code: socket.authorizationError }), { issuer: issuer });
    });
    socket.on('error', error => finish(false, errorWord(error)));
  });
}

function ask(target, method) {
  return new Promise(resolve => {
    const client = target.protocol === 'https:' ? https : http;
    const started = Date.now();
    const request = client.request(target, { method: method, timeout: seconds(), headers: { 'User-Agent': 'teletraan-net-probe' } }, response => {
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size <= bodyBytes) chunks.push(chunk);
        else response.destroy();
      });
      const done = () => resolve({
        ok: true,
        ms: Date.now() - started,
        status: response.statusCode,
        contentType: String(response.headers['content-type'] || '').split(';')[0].trim(),
        location: String(response.headers.location || ''),
        body: Buffer.concat(chunks).toString('utf8').slice(0, bodyBytes),
        error: '',
      });
      response.on('end', done);
      response.on('close', done);
    });
    request.on('timeout', () => request.destroy(new Error('TIMEOUT')));
    request.on('error', error => resolve({ ok: false, ms: Date.now() - started, status: 0, contentType: '', location: '', body: '', error: errorWord(error) }));
    request.end();
  });
}

// A redirect to another host, or an answer of the wrong kind. expectedType is a part of the content type that the
// real answer has (json, calendar, image). The hosts of a redirect inside one site (www and the bare name) do not count.
export function looksLikeBlockPage(host, answer, expectedType) {
  if (answer.status >= 300 && answer.status < 400 && answer.location) {
    try {
      const to = new URL(answer.location, 'https://' + host).hostname;
      const plain = name => name.replace(/^www\./, '');
      return plain(to) !== plain(host);
    } catch (error) {
      return true;
    }
  }
  if (answer.status !== 200 || !expectedType) return false;
  if (!answer.contentType.includes(expectedType)) return true;
  return /^\s*(<!doctype html|<html)/i.test(answer.body) && !expectedType.includes('html');
}

// url is an address. options: { expectedType, method }. The result:
//   { host, dns, tcp, tls, http, blockPage, ok, summary }
export async function probe(url, options = {}) {
  const result = { host: '', dns: null, tcp: null, tls: null, http: null, blockPage: false, ok: false, summary: '' };
  let target;
  try {
    target = new URL(url);
  } catch (error) {
    result.summary = 'not an address';
    return result;
  }
  const host = target.hostname;
  const secure = target.protocol === 'https:';
  const port = Number(target.port) || (secure ? 443 : 80);
  result.host = host;

  result.dns = await lookup(host);
  if (!result.dns.ok) {
    result.summary = 'dns ' + result.dns.error;
    return result;
  }
  result.tcp = await connect(result.dns.address, port);
  if (!result.tcp.ok) {
    result.summary = 'tcp ' + result.tcp.error;
    return result;
  }
  if (secure) {
    result.tls = await handshake(host, result.dns.address, port);
    if (!result.tls.ok) {
      result.summary = 'tls ' + result.tls.error + (result.tls.issuer ? ' (issuer ' + result.tls.issuer + ')' : '');
      return result;
    }
  }
  result.http = await ask(target, options.method || 'GET');
  if (!result.http.ok) {
    result.summary = 'http ' + result.http.error;
    return result;
  }
  result.blockPage = looksLikeBlockPage(host, result.http, options.expectedType || '');
  result.ok = result.http.status >= 200 && result.http.status < 400 && !result.blockPage;
  result.summary = result.blockPage ? 'block page (' + result.http.status + ' ' + (result.http.contentType || 'no type') + ')' : 'http ' + result.http.status;
  return result;
}

// What goes into the log: every step in a few words, the host and never the path or the query
export function probeDetail(result) {
  const step = (name, part) => part ? name + ' ' + (part.ok ? 'ok ' + part.ms + 'ms' : 'fail ' + part.error) : name + ' skipped';
  return [
    result.host,
    step('dns', result.dns),
    step('tcp', result.tcp),
    step('tls', result.tls),
    result.http ? 'http ' + (result.http.ok ? result.http.status + ' ' + (result.http.contentType || 'no type') : 'fail ' + result.http.error) : 'http skipped',
    'blockPage ' + result.blockPage,
  ].join(', ');
}

// Probes an address and writes the result to the log of a service. Gives the result back.
export async function probeAndLog(service, source, url, options = {}) {
  const result = await probe(url, options);
  logEvent(service, source, result.ok ? 'probe_ok' : 'probe_failed', probeDetail(result));
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await probe(process.argv[2] || '', { expectedType: process.argv[3] || '' });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
