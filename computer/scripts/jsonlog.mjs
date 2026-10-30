// One JSON line per event in /var/log/teletraan/<service>.jsonl. TELETRAAN_LOG_DIR moves the folder (tests).
// A log that cannot be written must never stop the service, so every failure here is swallowed.
import fs from 'node:fs';
import path from 'node:path';

export function logEvent(service, source, event, detail) {
  try {
    const folder = process.env.TELETRAAN_LOG_DIR || '/var/log/teletraan';
    fs.mkdirSync(folder, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), service: service, source: source, event: event, detail: detail === undefined ? '' : detail });
    fs.appendFileSync(path.join(folder, service + '.jsonl'), line + '\n');
  } catch (error) {
    // Nothing to do: the log is a help, not a requirement
  }
}
