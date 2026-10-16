// The Now on the wall card. The dashboard on the Mini posts its state here every 10 seconds
// (dashboard/core/now-report.js); the tab reads it back. A report that is older than 40 seconds
// means the dashboard has gone quiet.
//
// The POST comes through nginx from the Mini itself and carries no PIN. nginx sets X-Real-IP, and
// this route accepts only 127.0.0.1 and ::1 in it (nginx must also refuse every other address for
// this one path). The report is checked and cut to size before it is kept.

import { Refusal, mount, readJson, send } from '../support/http.js';
import { makeSanity } from '../support/sanity.js';
import { rowsFor } from '../support/now-rows.js';
import { cleanReport } from '../../dashboard/core/now-report-parts.js';

export const quietSeconds = 40;
const localAddresses = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
const rowsKept = 30 * 1000;

export function ageSeconds(received, now) {
  return received ? Math.max(0, Math.round((now.getTime() - received.getTime()) / 1000)) : null;
}

function fromLocalhost(req) {
  const header = req.headers && req.headers['x-real-ip'];
  return typeof header === 'string' && localAddresses.includes(header.trim());
}

export function register(router, ctx) {
  let report = null;
  let received = null;
  let rows = { panel: '', at: 0, lines: [] };

  mount(router, ctx, 'POST', '/now', async (req, res) => {
    if (!fromLocalhost(req)) throw new Refusal(403, 'Only the Mini reports what is on the wall.');
    const body = await readJson(req, 8 * 1024);
    report = cleanReport(body, new Date());
    // The time is the Mini's own, so a wrong clock on the page cannot make a report look fresh
    received = new Date();
    send(res, 200, { ok: true });
  }, { open: true });

  mount(router, ctx, 'GET', '/now', async (req, res) => {
    const now = new Date();
    const age = ageSeconds(received, now);
    const quiet = age === null || age > quietSeconds;

    if (report && report.panel !== '' && (rows.panel !== report.panel || now.getTime() - rows.at > rowsKept)) {
      let lines = [];
      try {
        lines = await rowsFor(report.panel, ctx, makeSanity(ctx));
      } catch (error) {
        lines = [];
      }
      rows = { panel: report.panel, at: now.getTime(), lines: lines };
    }

    send(res, 200, {
      report: report,
      receivedAt: received ? received.toISOString() : null,
      ageSeconds: age,
      quiet: quiet,
      message: quiet ? (age === null ? 'No report from the wall yet' : 'No report for ' + age + ' s') : '',
      rows: report && rows.panel === report.panel ? rows.lines : [],
    });
  });
}
