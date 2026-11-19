# Operations: keeping the screen up when the network is bad

This page is for whoever looks after the Teletraan computer. The school network may block a host, drop out for an afternoon or answer with a page of its own. The screen has to keep showing the last good content through all of that, never show an error, and tell the team when something is wrong. Students: you do not need to read this to edit content.

## Services

The dashboard in the browser asks the internet for nothing. It reads plain files from the same web server, and a service on the Teletraan computer fills those files.

| What | Runs as | What it does |
|------|---------|--------------|
| `teletraan-sync.service` | all the time, started again by systemd if it stops | Reads Sanity, the weather and the pictures on its own timers and writes them to the data folder (`/var/lib/teletraan/data`, shown to the dashboard as `data/live/`). `computer/scripts/sync-service.mjs` |
| `teletraan-netwatch.timer` | every 2 minutes | Checks the network and repairs it when it is down (docs/network.md). `computer/scripts/netwatch.sh` |
| `teletraan-heartbeat.timer` | every 5 minutes | Pings the uptime monitor and raises the push messages (below). `computer/scripts/heartbeat.sh` |
| `teletraan-health.timer` | every 1 minute | Looks the computer over and writes `/var/lib/teletraan/health.json`: one line for each check. It decides nothing. `computer/scripts/health.sh` |
| `teletraan-supervisor.timer` | every 1 minute | Reads that file and repairs what it can, gently first. The only thing on the computer that escalates. `computer/scripts/supervisor.sh` |
| `teletraan-display.timer` | every 15 seconds | Notices the TV being switched off or to another input and puts the picture right. `computer/scripts/display-watch.sh` |
| Monday, the competition feed, the calendars | their own timers | Unchanged. The sync service only reports how they are doing |

What the sync service writes, and how it keeps the last good copy:

- `content.json`: the answer of the content query (the same query the dashboard used to send, in `dashboard/core/sanity-query.js`). Every 10 seconds the service asks one small question, how many documents there are and when the newest was edited. A change makes it read everything at once, so a publish shows on the TV within about 15 seconds. It also reads everything every 5 minutes in case a change was missed.
- `weather.json`: the reading, every 15 minutes.
- `images/`: every picture the content names, downloaded in the sizes the panels ask for, and `images/index.json`, the list that tells the dashboard which Sanity address has a local file. A picture is in the list only after its file is complete. A picture that has not arrived yet is still shown from the Sanity address, as before.
- `sync-status.json`: every 10 seconds, `{ generatedAt, sources: { sanity, weather, images, monday, competition, calendars }, network: { ok, since } }`, and for each source `lastSuccessAt`, `lastFailureAt` and `lastFailureReason` (a few words, no address). `network.ok` is true while any source was read well in the last 2 minutes, and false when none was or when `/var/lib/teletraan/netwatch.json` (netwatch.sh) counts 3 or more failures; `since` is the time it was first seen down, or null while it is up. A file without `network` (older, or a laptop) draws no network dot. The fourth dot on the TV, after Monday, Band and Sanity, shows it: green ok, red down. Monday, the competition feed and the calendars are read from what their own jobs already write.

Every file is written under a temporary name and renamed, and only from an answer that was checked (JSON, with a result; a picture with a picture type). A failed read changes nothing, so a panel is never blanked and nothing says "error". A school filter that answers 200 with a page of its own is not JSON and counts as a failed read.

The dashboard reads `content.json` every 5 seconds, `weather.json` every minute and `sync-status.json` every 10 seconds, all with no cache. It still keeps its last copy in the browser, so it starts with something even if the web server is slow. It opens no stream and sends no cross-origin request. A script error, a promise nobody caught and a failed request go to the browser console and nowhere else (`dashboard/guard.js`).

### The status pill

At the foot of the screen, level with the ticker at its right end, a small pill with a 30 pixel label. It is not drawn while everything is fresh.

- Amber, "Offline since 3:12 PM": a source has had no good read for more than 10 minutes. The time is the last good read of the oldest late source, in the time of the computer, and it carries its date when it is from an earlier day ("Offline since Oct 31, 7:40 PM"). The status file itself being older than 10 minutes counts as every source late.
- Red: every source in use has had no good read for more than 30 minutes.
- A slow source gets more room: it is late after twice its own gap and down after three times, if that is more than 10 and 30 minutes (the calendars are read every 15 minutes, Monday by its own setting, the competition feed is written about every hour).
- A source that has never run and never failed (the competition feed in the off season) is not in use and is left out.
- The four dots on the TV and on the control page start from the same file, `sync-status.json`. Monday and Band do not wait for a round trip through Sanity: `monday-sync.sh` leaves `monday/status.json` and `fetch-calendars.sh` leaves `calendar-sync.txt` in the data folder, and the sync service reads them. A source that has not been read since the service started is grey, "not known yet", for the first five minutes, then amber. A failure counts only when it came after the last good read.

The limits are in `dashboard/core/constants.js`. The pill fades with opacity only. There is no pill on `?sample=1`, and none on a laptop with no sync service.

### On a laptop

The laptop has no sync service. To fill `dashboard/data/live/` once, run `make sync-once` and open the dashboard. Run it again to read again.

### Install and update

`install-sync.sh` installs the sync service, the heartbeat, `/var/log/teletraan` and the rotation of the logs. It is the last step of Install everything in the Mac tool, so every update restarts the service with the new code. By hand:

    sudo /opt/teletraan/computer/scripts/install-sync.sh
    sudo /opt/teletraan/computer/scripts/install-network.sh

It needs `curl`, `jq` and Node 18 or newer, and does not install them.

### Name servers

The name servers are desired state. `computer/config/network.conf` holds three names, `DNS_PRIMARY` (8.8.8.8), `DNS_SECONDARY` (8.8.4.4) and `DNS_ENFORCE` (yes). The installer copies it to `/usr/local/etc/teletraan-network.conf`, owned by root, only when that file is not there, so a change made on the computer is kept. `teletraan-net` (`computer/scripts/net-root.sh`) reads it for those three names only and never runs it. It uses it in four places:

- `teletraan-dns.service` runs `teletraan-net dns-apply` at boot, and the installer runs it too. It puts the servers on the active connection when they are not there, and does nothing when they are.
- A Wi-Fi switch from the Control page writes the same servers into the new connection, so moving to another network does not drop them.
- The Use public name servers button uses them. Use the network's name servers goes back to the ones the network hands out.
- `netwatch.sh` falls back by itself. When the gateway answers and the name lookup fails, from the second failed check and once for each outage, it tries the other set (the network's own, or the configured ones), keeps the one that works and says so in the log (`dns_switched`) and in a push message. When the configured servers answer again, and the switch is at least ten minutes old, it puts them back (`dns_restored`). Only after that does the ladder go on to restart and bounce, which cannot fix a name server. With `DNS_ENFORCE=no` it leaves the name servers alone.

`make dns-status` prints what is configured, what is in use and one line of state: as configured, temporarily on the network's own, not as configured, or not enforced. Control, Computer, Network repairs shows the same line, green when the servers are as configured and amber while the network's own are in use. `/var/lib/teletraan/dns.json` is what the page reads.

### Wi-Fi only computers

The Teletraan computer has no cable, and a Wi-Fi chip that saves power while idle is the classic reason for a connection that drops overnight. `install-network.sh` writes `/etc/NetworkManager/conf.d/teletraan-wifi.conf` with `wifi.powersave = 2` (power saving disabled) when NetworkManager is the manager in use. It writes the file only when it differs, restarts nothing, and the setting applies at the next reconnect (the active Wi-Fi connection is changed as well). The output of the script says what it did. With another manager (systemd-networkd, for example) it says so and changes nothing. `--undo` removes the file (docs/network.md).

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

## When the screen goes wrong by itself

The computer checks itself every minute and can repair itself. This section is what to read when the wall looks wrong
and nobody is in the room.

### What it checks

`make health` prints the lot. Each check says whether it passes, since when, and one plain line of detail:

- **frames** — the page is painting. This is the important one. A page whose timers run and whose painting has stopped
  looks healthy from everywhere except here, and it is what leaves the screen half drawn.
- **page** — the page answers on this computer at all.
- **display** — a screen is connected and the framebuffer is the size the dashboard draws into.
- **screenStuck** — the picture has changed in the last fifteen minutes, and is not one flat colour.
- **network**, **dns** — what the network watchdog last found. Nothing is probed twice.
- **sanity**, **calendars**, **monday**, **competition** — each source was read inside three times its own interval.
- **services** — every service is running, and none is restarting over and over.
- **memory**, **disk**, **clock** — the browser is under 1.5 GB, a tenth of the disk is free, the clock is set.

A check whose facts cannot be gathered is left out rather than failed: a fact nobody could read is not a fault.

### The ladder

One problem, one step at a time, by how long it has been failing without a break. Each step waits to see whether it
worked, and a problem that clears starts again at the bottom.

| After | Step | What people in the room see |
|-------|------|------------------------------|
| 1 min | load the page again | nothing |
| 5 min | run or restart that service | nothing |
| 10 min | restart the screen session and set the display again | a few seconds of black |
| 20 min | repair the network (network problems only) | nothing on screen |
| 30 min | reboot, if the gate allows it | one to two minutes dark |

A problem only gets the steps that could help it: the display has no service of its own, a source never gets the
network step, and a source that fails while the network is fine never gets a reboot at all.

### Why it cannot get into a reboot loop

Every reboot on this computer goes through one door (`computer/scripts/gate.sh`) and one record
(`/var/lib/teletraan/reboot-ledger.json`), written before the machine goes down so it survives. The five repair paths —
the screen watchdog, the network watchdog, the scheduled reboot, the nightly one and the buttons — therefore share one
budget instead of keeping four of their own:

- One automatic reboot in six hours, three in a day, counted across all of them together.
- No reboot of any kind within ten minutes of another. The nightly and the buttons are outside the budget, because a
  person asked, but not outside this.
- Nothing above restarting the screen in the first ten minutes after a boot.
- Never a reboot for a source that is failing while the network works. That is the school filter or someone else's
  outage, and rebooting this computer cannot fix it.
- A dead internet gets one network restart and one reboot, and then stops. A router or a provider is not fixed by
  rebooting the Mini.

### When it stops trying

If a reboot happens for a problem and the same problem is failing again within half an hour of the computer coming
back, rebooting plainly does not help. The computer then **stops rebooting for that problem** for a day: the gentle
steps keep running, the last good content stays on the screen, and one message says
"automatic reboot did not fix &lt;problem&gt;; stopped rebooting". Three boots in an hour, for any reason, stops it
rebooting at all until a person says otherwise.

It lets go by itself after a day of quiet. To let go now:

- Control page: Details, Debug.
- Studio: Coaches only, Remote actions, Clear degraded.
- On the computer: `node computer/scripts/ledger.mjs clear`.

### Watching first

It starts out watching only. It does every check and writes down what it would have done, and does nothing. That is
deliberate: read a day of it before letting it restart anything on a wall people are using.

- For its first day after being installed it watches whatever the setting says.
- After that it acts only while **Dashboard Settings, Advanced, Fixing itself, May the computer fix itself?** says Fix.
- `TELETRAAN_SUPERVISOR_DRY_RUN=1` forces watching whatever the setting says.

`make supervisor-status` says which mode it is in, what is failing, what it has tried and whether it has stopped
trying.

### The diagnostic report

One file with everything needed to work out what happened, so nobody has to log in over ssh.

- Control page: **Details, Debug, Create a report**, then read, copy or download it.
- On the computer: `make diag`, or `make diag-last` to print the newest.
- Studio: Coaches only, Remote actions, Collect diagnostics. Only a one line summary comes back to Sanity; the report
  stays on the computer.

The computer also writes one by itself, into `/var/lib/teletraan/incidents`, before it restarts or reboots anything.
Those are the ones worth reading after the wall went wrong overnight. Twenty of each are kept.

Every line of a report goes through the same rules as the log download: the keys file is never opened, and tokens,
passwords, Wi-Fi passwords, the PIN and calendar links are taken out of everything else. A report is safe to send to a
coach. `tests/diag-redaction.test.mjs` feeds made-up keys and feed links through the whole thing and fails if any of
them comes out.

### The hardware watchdog

Not turned on. `make watchdog-test` says whether this computer even has the device and what turning it on would mean;
it changes nothing. A watchdog that does not work resets the computer for no reason and nothing says why, so it is a
decision to make deliberately, not a default.

## Making the dataset private

The dataset is public today: anyone who knows the project id can read every document in it, including first names,
roles, photos and mentor names. The Teletraan computer works with that and also after it is made private, provided it
has a read token first. Do the steps in this order. Doing step 3 before step 1 blanks the wall.

1. Make a read token. At sanity.io/manage, open the project, then API, then Tokens, then Add API token. Name it
   "Teletraan read" and give it the Viewer role. Copy the token once; Sanity does not show it again.
2. Put it on the Teletraan computer. Over SSH, add the line `SANITY_READ_TOKEN='...'` to `/opt/teletraan/local.env` by
   hand (the token between the quotes). Then `sudo systemctl restart teletraan-sync`. Without that line the computer
   falls back to `SANITY_WRITE_TOKEN`, which also reads, but the Viewer token is the one to keep for reading.
   `computer/scripts/lib.sh` hands the token to curl on its standard input, never on a command line, and
   `sync-service.mjs` sends it only to the Sanity hosts. Nothing writes it to a log or to the data folder.
3. Check it before changing anything: `computer/scripts/check-connection.sh` prints OK for the Sanity lines, and
   Control, Now shows the Sanity dot green after the next read. Wait for one full read (up to five minutes).
4. Make the dataset private. At sanity.io/manage, open the project, then Datasets, choose `production`, and change its
   visibility to private (the page says what each choice means). Reads without a token now answer 401.
5. Turn on private assets in the same dataset settings. Without it the images stay reachable by anyone who has the
   address, even in a private dataset. The sync service sends the token with every picture it downloads, so the wall
   keeps its images; the dashboard itself reads only the local copies and needs nothing.
6. Check again: `check-connection.sh`, a view change on the wall, and the Studio (editors sign in to it anyway). The
   scripts that read settings from Sanity (scheduled reboot, nightly, the slides and Drive photo syncs, `make
   remote-status`) use the same token through `sanity_curl` in `lib.sh`.

To go back, set the dataset to public again in the same place. The token can stay in `local.env`; a public dataset
ignores it. The "can the Studio reach this page" probe of the Control page (`control/lib/cors.js`) still asks with no
token, and it has not been tried against a private dataset. If the Status tab says "CORS origin missing" after the
switch, look at the origin list at sanity.io/manage before believing it.

## Remote actions from Sanity

Coaches can restart the screen, restart the services, reboot the Teletraan computer, sync a source now, show a view or theme and pause or resume the rotation from the Studio, from anywhere, without the control page. docs/remote-access.md has the plain steps and the design of the private tunnel (Layer B), which is not installed.

### How to trigger one

1. In the Studio, open Coaches only, Remote actions, Send an action.
2. Open the menu beside Publish and choose a button: Restart dashboard, Restart services, Reboot computer, Sync now (a list: all sources, calendars, Monday, competition, news, Match13, photos), Show a view, Show a theme, Pause rotation or Resume rotation. Reboot and Restart services ask "Are you sure?" first.
3. The button writes the action, the time now and your first name into the page and publishes it. Nothing else is needed.
4. Within about 30 seconds the Teletraan computer answers. The fields Handled at and Result on the same page show what it did. Status of the computer, next to it, shows the sources, the last repair of the network watchdog and the last request.

What each action does: Restart dashboard restarts the browser of the TV (the helper word `restart-kiosk`). Restart services restarts the timers and the web server (`restart-services`). Reboot computer restarts the whole machine (`reboot`). Sync now sends `sync-now` with one fixed source: calendars, monday, frc (Competition), news, match13 or photos-drive (Photos); Sync all sends the six in that order. Show a view, Show a theme, Pause rotation and Resume rotation write `showView`, `previewTheme` or `pauseRotation` into the published Dashboard Settings (with a revision check, once more if a Studio edit came in between), ending after 60 minutes by themselves. A value of `auto` or Resume clears the request.

### Rules the computer follows

- Freshness: a request is run only when it is less than 10 minutes old. An older one is not run, but it is marked handled with the result `ignored: too old`. A computer that comes back online after an outage therefore never obeys an old click. If nothing happened, click the button again.
- Once only: a request is run when its time is later than Handled at. The answer is written to Sanity before anything runs, so a request cannot run twice, even if the computer reboots at once.
- One reboot in 10 minutes: a second reboot request inside that time is marked `ignored: a reboot already ran in the last 10 minutes`. The reboot itself starts 5 seconds after the answer is written. The time of the last reboot is kept in `remote-state.json` in the data folder.
- Fixed words only: the stored action must be exactly one of the names in `computer/scripts/remote-plan.mjs`, and a view or theme exactly one of its short lists. Anything else is marked `refused: unknown action` (or `refused: unknown view`, `refused: unknown theme`) and nothing runs. No text from Sanity is ever passed to a shell or to the helper; the helper lines come from a frozen table.
- One sync in a minute: a second sync request of any kind inside a minute is marked `ignored: a sync already ran in the last minute`. The time is kept in `remote-state.json` with the reboot time.
- The last answer is also written to `remote-last.json` in the data folder (`action`, `requestedBy`, `handledAt`, `result`, `via: sanity`), by a temporary file and a rename, so the control page can show the same last result.
- The status document also carries the network state and the last check time, from `sync-status.json` (`network` is optional there) and the poller's own clock.
- A push message "remote action received" goes out through `computer/scripts/notify.sh` when that script exists. It is optional: without it the action still runs.

### Limit of this path

It needs the Teletraan computer to reach Sanity (outbound only, no open port). If the school blocks Sanity itself, remote actions do not work. The network watchdog (netwatch) and the heartbeat cover that case.

### Checking it on the computer

- `make remote-status` prints the last handled request and the last lines of the poller log.
- The log is `/var/log/teletraan/remote.jsonl`, one JSON line for each poll, action and status write.
- `systemctl status teletraan-remote` says whether the service runs. Install or reinstall it with `sudo /opt/teletraan/computer/scripts/install-remote.sh` (Install everything in the Mac tool and `computer/install.sh` run it for you, and with no key it prints one line and installs nothing; it needs `SANITY_WRITE_TOKEN` in `local.env` and the helper socket from `computer/install.sh`).
