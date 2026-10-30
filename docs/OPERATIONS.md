# Operations: keeping the screen up when the network is bad

This page is for whoever looks after the Teletraan computer. The school network may block a host, drop out for an afternoon or answer with a page of its own. The screen has to keep showing the last good content through all of that, never show an error, and tell the team when something is wrong. Students: you do not need to read this to edit content.

## Services

The dashboard in the browser asks the internet for nothing. It reads plain files from the same web server, and a service on the Teletraan computer fills those files.

| What | Runs as | What it does |
|------|---------|--------------|
| `teletraan-sync.service` | all the time, started again by systemd if it stops | Reads Sanity, the weather and the pictures on its own timers and writes them to the data folder (`/var/lib/teletraan/data`, shown to the dashboard as `data/live/`). `computer/scripts/sync-service.mjs` |
| `teletraan-netwatch.timer` | every 2 minutes | Checks the network and repairs it when it is down (docs/network.md). `computer/scripts/netwatch.sh` |
| `teletraan-heartbeat.timer` | every 5 minutes | Pings the uptime monitor and raises the push messages (below). `computer/scripts/heartbeat.sh` |
| Monday, the competition feed, the calendars | their own timers | Unchanged. The sync service only reports how they are doing |

What the sync service writes, and how it keeps the last good copy:

- `content.json`: the answer of the content query (the same query the dashboard used to send, in `dashboard/core/sanity-query.js`). Every 10 seconds the service asks one small question, how many documents there are and when the newest was edited. A change makes it read everything at once, so a publish shows on the TV within about 15 seconds. It also reads everything every 5 minutes in case a change was missed.
- `weather.json`: the reading, every 15 minutes.
- `images/`: every picture the content names, downloaded in the sizes the panels ask for, and `images/index.json`, the list that tells the dashboard which Sanity address has a local file. A picture is in the list only after its file is complete. A picture that has not arrived yet is still shown from the Sanity address, as before.
- `sync-status.json`: every 10 seconds, `{ generatedAt, sources: { sanity, weather, images, monday, competition, calendars } }`, and for each source `lastSuccessAt`, `lastFailureAt` and `lastFailureReason` (a few words, no address). Monday, the competition feed and the calendars are read from what their own jobs already write.

Every file is written under a temporary name and renamed, and only from an answer that was checked (JSON, with a result; a picture with a picture type). A failed read changes nothing, so a panel is never blanked and nothing says "error". A school filter that answers 200 with a page of its own is not JSON and counts as a failed read.

The dashboard reads `content.json` every 5 seconds, `weather.json` every minute and `sync-status.json` every 10 seconds, all with no cache. It still keeps its last copy in the browser, so it starts with something even if the web server is slow. It opens no stream and sends no cross-origin request. A script error, a promise nobody caught and a failed request go to the browser console and nowhere else (`dashboard/guard.js`).

### The status pill

At the foot of the screen, level with the ticker at its right end, a small pill with a 30 pixel label. It is not drawn while everything is fresh.

- Amber, "Offline since 3:12 PM": a source has had no good read for more than 10 minutes. The time is the last good read of the oldest late source, in the time of the computer. The status file itself being older than 10 minutes counts as every source late.
- Red: every source in use has had no good read for more than 30 minutes.
- A slow source gets more room: it is late after twice its own gap and down after three times, if that is more than 10 and 30 minutes (the calendars are read every 15 minutes, Monday by its own setting).
- A source that has never run and never failed (the competition feed in the off season) is not in use and is left out.

The limits are in `dashboard/core/constants.js`. The pill fades with opacity only. There is no pill on `?sample=1`, and none on a laptop with no sync service.

### On a laptop

The laptop has no sync service. To fill `dashboard/data/live/` once, run `make sync-once` and open the dashboard. Run it again to read again.

### Install and update

`install-sync.sh` installs the sync service, the heartbeat, `/var/log/teletraan` and the rotation of the logs. It is the last step of Install everything in the Mac tool, so every update restarts the service with the new code. By hand:

    sudo /opt/teletraan/computer/scripts/install-sync.sh
    sudo /opt/teletraan/computer/scripts/install-network.sh

It needs `curl`, `jq` and Node 18 or newer, and does not install them.

## Reading the logs

Every service writes one JSON line for each event to `/var/log/teletraan/<service>.jsonl`, with `ts`, `service`, `source`, `event` and `detail`. The files are kept 14 days, cut at 5 MB and compressed (logrotate). A log that cannot be written never stops a service. A detail names a host and the steps of a check, and never a path, a query or a key.

    make logs                       the newest 20 lines of every log
    make logs SERVICE=sync LINES=100   one service, more lines
    make net-status                 each source: last good read, last failure and why; what netwatch did last
    make net-test                   the full diagnostic once for every source, as a table

The services: `sync` (the sync service), `netwatch`, `heartbeat` and `notify`. A few events to know:

| Event | Meaning |
|-------|---------|
| `check_failed` | A source did not answer. The detail says why in a few words: `network ENOTFOUND` (the name did not resolve), `http 503`, `timeout`, `not json, maybe a block page` |
| `probe_failed`, `probe_ok` | The full probe of a source: name lookup, TCP, TLS, HTTP status, content type and whether the answer looks like a block page |
| `content_written` | A new content file was written |
| `recovered` | A source that was failing answered again |
| `action` | Netwatch restarted the network, bounced the interface or rebooted |

Every check of netwatch is a line. The sync service writes a line when something changes, when a source fails (at most every 5 minutes while it keeps failing) and a short note every 5 minutes while all is well. It does the full probe of a source (about four small requests) when it fails, at most once a minute, and once every 15 minutes while it works, so the school sees no more traffic than before.

`status.json` in the data folder has the same facts in one small file, and `status-mini` in Sanity has the times of the last good read of each source and what netwatch did last, so the Studio can show them (`status-write.sh sync`).

## When a host is blocked

The signs: the pill is amber or red, and `make net-status` shows one source with a recent failure while the others work.

1. Run `make net-test`. Each row is one source. The columns say where it stops: DNS (the name did not resolve), TCP (the connection was refused or dropped), TLS (the certificate is not the host's: a filter that opens HTTPS), HTTP and TYPE (what came back), BLOCKED (a 200 with a page that is not what was asked for, or a redirect to another host).
2. If one host fails, it is blocked. Run `make allowlist` and send the output to the school IT office. It lists exactly the hostnames the computer contacts, with what each is for.
3. Meanwhile the screen keeps showing the last good copy of everything. Only that source goes stale, and the pill says since when.
4. If only Sanity is blocked, new content cannot arrive, and the Studio actions that reach the computer through Sanity cannot either. Netwatch and the heartbeat still work: netwatch needs only the host named in `NETWATCH_HOST` (the Sanity host to start with), and the heartbeat needs only its own address.
5. If the whole network is down, netwatch repairs it in steps (docs/network.md), and a message goes out when it is back.

A picture host that is blocked costs only the pictures that were not downloaded yet.

## Heartbeat and push

Two optional values in `local.env`. Nothing else has to be set; with no value nothing is sent and nothing is said.

    HEARTBEAT_URL='https://...'
    NOTIFY_URL='https://...'

- `HEARTBEAT_URL`: the ping address of an external uptime monitor. Every 5 minutes, while the local dashboard answers, the computer sends an HTTPS GET to it. The monitor is set to alert by email or phone when pings stop: a check with a period of 15 minutes and a grace of 10 minutes works. A computer that is off, frozen or cut off from the internet stops pinging, and that is how the team finds out.
- `NOTIFY_URL`: the address of a chat webhook. The computer sends a short message when the state changes: it went offline (the content has been older than 10 minutes), it came back, netwatch took an action, or a remote action was received. The body is `{"content": "<text>"}` with `Content-Type: application/json`. For a webhook that wants a plain text body, add `NOTIFY_FORMAT='text'`.

Every message starts with `teletraan`, then the time, then a few words. A host name or an address in the text is taken out before it is sent, and no key is ever in it. If a message cannot be sent it is logged and kept (the last 5), and goes with the next message, so "went offline" arrives with "came back". Nothing waits for a push: a failed one never blocks a service.

Any script can raise a message with one argument:

    computer/scripts/notify.sh "remote action received: restart_dashboard"

`make heartbeat-test` sends one ping and one push now and prints how each went. Both addresses go to curl on standard input, so they are not in the process list or the logs. They are secrets in the sense that anyone who has them can send you messages: they live in `local.env` only, never in the repository.

## Allowlist for school IT

`make allowlist` prints the hostnames the computer contacts, one line each with its purpose, ready to send. It is built from the files that use each address, so it follows a change: the Sanity project host and its picture host from `dashboard/config.js`, the weather host from `dashboard/core/weather.js`, the Monday, Blue Alliance, Statbotics, Match13, Drive and Slides hosts from the scripts that call them, and from `local.env` the host of every `CALENDAR_<ID>_URL`, of `HEARTBEAT_URL`, of `NOTIFY_URL` and of `NETWATCH_HOST`. Only the hostname of an address is ever printed, never its path or its token.

All connections go out from the computer over HTTPS (port 443). Nothing connects in from outside. If the computer is reached over a private network service for remote login, that service has its own hosts and is not in this list; ask its documentation. Pulling an update from the code host is done from the Mac or the control page and is not part of the screen.

## Remote actions from Sanity

Coaches can restart the screen, restart the services or reboot the Teletraan computer from the Studio, from anywhere, without the control page.

### How to trigger one

1. In the Studio, open Coaches only, Remote actions, Send an action.
2. Open the menu beside Publish and choose Restart dashboard, Restart services or Reboot computer. Reboot asks "Are you sure?" first.
3. The button writes the action, the time now and your first name into the page and publishes it. Nothing else is needed.
4. Within about 30 seconds the Teletraan computer answers. The fields Handled at and Result on the same page show what it did. Status of the computer, next to it, shows the sources, the last repair of the network watchdog and the last request.

What each action does: Restart dashboard restarts the browser of the TV (the helper word `restart-kiosk`). Restart services restarts the timers and the web server (`restart-services`). Reboot computer restarts the whole machine (`reboot`).

### Rules the computer follows

- Freshness: a request is run only when it is less than 10 minutes old. An older one is not run, but it is marked handled with the result `ignored: too old`. A computer that comes back online after an outage therefore never obeys an old click. If nothing happened, click the button again.
- Once only: a request is run when its time is later than Handled at. The answer is written to Sanity before anything runs, so a request cannot run twice, even if the computer reboots at once.
- One reboot in 10 minutes: a second reboot request inside that time is marked `ignored: a reboot already ran in the last 10 minutes`. The reboot itself starts 5 seconds after the answer is written. The time of the last reboot is kept in `remote-state.json` in the data folder.
- Fixed words only: the stored action must be exactly one of the three names above. Anything else is marked `refused: unknown action` and nothing runs. No text from Sanity is ever passed to a shell or to the helper.
- A push message "remote action received" goes out through `computer/scripts/notify.sh` when that script exists. It is optional: without it the action still runs.

### Limit of this path

It needs the Teletraan computer to reach Sanity (outbound only, no open port). If the school blocks Sanity itself, remote actions do not work. The network watchdog (netwatch) and the heartbeat cover that case.

### Checking it on the computer

- `make remote-status` prints the last handled request and the last lines of the poller log.
- The log is `/var/log/teletraan/remote.jsonl`, one JSON line for each poll, action and status write.
- `systemctl status teletraan-remote` says whether the service runs. Install or reinstall it with `sudo /opt/teletraan/computer/scripts/install-remote.sh` (it needs `SANITY_WRITE_TOKEN` in `local.env` and the helper socket from `computer/install.sh`).
