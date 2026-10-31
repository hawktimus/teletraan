// The actions that more than one area offers, written once: what each does, what it asks before it runs, and how long the
// screen may go dark. Only restart, reboot, rollback and publish ask. Sync never does.

import { api } from '../tabs/api.js';
import { actionButton, helperRun } from '../action-run.js';
import { syncEverythingRun } from '../sync-run.js';

// A restart of the web server cuts this page's own connection. A call that fails because of that is what was expected.
function restartRun(word) {
  const run = helperRun(word, {}, true);
  return async signal => {
    const result = await run(signal);
    if (result.ok) return { ok: true, words: 'The computer is restarting. This page reconnects by itself.', raw: result.raw };
    if (/not answering|could not be reached|stopped waiting/.test(result.words || '')) return { ok: true, words: 'The computer is restarting. This page reconnects by itself.', raw: result.raw };
    return result;
  };
}

export const specs = {
  syncEverything: () => ({
    id: 'sync-everything', label: 'Sync everything', doing: 'Syncing everything', variant: 'primary', icon: 'sync', ownTimeout: true,
    hint: 'Reads every source now, one after another. A source that fails does not stop the others.', run: syncEverythingRun,
  }),
  refreshScreen: () => ({
    id: 'refresh-screen', label: 'Refresh the screen', doing: 'Refreshing the screen', variant: 'secondary', icon: 'refresh',
    hint: 'Ends any hold or pause, so the TV goes back to its schedule and shows the newest content.',
    run: async signal => {
      const result = await api('POST', '/push/reset', {}, signal);
      return result.ok ? { ok: true, words: 'The TV is back on its schedule.', raw: 'push reset: ok' } : { ok: false, words: result.error, raw: result.error };
    },
  }),
  restartDashboard: () => ({
    id: 'restart-screen', label: 'Restart the dashboard', doing: 'Restarting the dashboard', variant: 'secondary', icon: 'power',
    hint: 'Restarts the screen only. Nothing else on the computer is touched.',
    confirm: { title: 'Restart the dashboard?', body: 'The screen restarts and loads the dashboard again. The computer and this page keep running.', dark: 'The TV may go dark for about 30 seconds.', confirmLabel: 'Restart the dashboard' },
    run: helperRun('restart-kiosk', {}, true),
  }),
  restartServices: () => ({
    id: 'restart-services', label: 'Restart services', doing: 'Restarting services', variant: 'danger', icon: 'power',
    hint: 'Restarts the web server, the sync service and the timers.',
    confirm: { title: 'Restart services?', body: 'The web server, the sync service and the timers restart. This page loses its connection and reconnects by itself.', dark: 'The TV keeps its picture, and may flicker once. This page is unreachable for up to a minute.', confirmLabel: 'Restart services' },
    run: restartRun('restart-services'),
  }),
  reboot: () => ({
    id: 'reboot', label: 'Reboot the computer', doing: 'Rebooting the computer', variant: 'danger', icon: 'power',
    hint: 'Switches the whole computer off and on again.',
    confirm: { title: 'Reboot the computer?', body: 'Everything restarts, the screen and this page too. It comes back by itself.', dark: 'The TV goes dark for about 3 minutes.', confirmLabel: 'Reboot the computer' },
    run: restartRun('reboot'),
  }),
};

export function make(name) {
  return actionButton(specs[name]());
}
