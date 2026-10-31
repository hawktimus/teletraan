# The network of the Teletraan computer

If the screen loses its network every day after it has sat idle, the Teletraan computer is most likely losing its Wi-Fi. This page says what the computer does about it, what to do by hand, and how to find the real cause. The screen itself does not need the network at that moment: the sync service keeps the last good content and the status pill says Offline since a time (docs/OPERATIONS.md).

Nothing here was run on the real computer yet. The scripts were tried against fakes (`tests/netwatch.test.mjs`, `tests/network-install.test.mjs`).

## The best fix: a cable

A wall display should be on Ethernet. The computer has a port (`enp3s0f0`), and nothing is plugged in. A cable has no power saving, no roaming and no radio that a microwave or a school full of phones can crowd out. Plug a cable from the computer to the router or a wall socket. Nothing has to be set: NetworkManager prefers a cable, and netwatch acts on the cable when it has a link. Leave Wi-Fi on as the backup.

## What netwatch does

`computer/scripts/netwatch.sh` runs every 2 minutes (`teletraan-netwatch.timer`) as the login user. It replaced the older network watchdog (`teletraan-network.timer`); `install-network.sh` turns the old timer off and removes its files, so there is one watchdog. Each run does three checks and writes one line to `/var/log/teletraan/netwatch.jsonl`:

- A ping of the default gateway.
- A name lookup of one host.
- An HTTPS HEAD request to that host, with a 10 second limit. Any answer, even an error page, counts as working. Only this check decides.

The host is `NETWATCH_HOST` in `local.env`, or the Sanity API host of the project when that is empty. The first two results are only there so that the log says which part broke. After 3 failed checks in a row (6 minutes) it climbs this ladder, one action per run:

| Failures | Action | NetworkManager | systemd-networkd | ifupdown |
|----------|--------|----------------|------------------|----------|
| 3 | `restart_network` | restart NetworkManager, then `nmcli device reapply` | restart systemd-networkd and systemd-resolved, then `networkctl renew` | restart networking, then `ifup --force` |
| 6 | `bounce_interface` | `nmcli device disconnect`, then `connect` | `networkctl reconfigure` | `ifdown`, then `ifup` |
| 15 | `reboot` | at most once in 2 hours | same | same |

At the second action a Wi-Fi interface also has its driver reloaded (`modprobe -r` and `modprobe` of the module that `/sys` names for the interface). An Ethernet port is not given that. It finds which manager runs at each run and writes it in the log. The computer in the classroom uses NetworkManager.

It cannot loop:

- An action waits at least 3 minutes after the one before it, and a run takes only one action.
- Each action is taken once per outage and once per boot. A boot starts a new count, but the time of the last action is kept.
- Nothing is done in the first 5 minutes after boot, and no reboot in the first 10.
- The reboot happens at most once in 2 hours. It looks at its own record and at the record of the scheduled reboot, and writes the state before it asks for the reboot.
- It acts only on the Ethernet port that has a cable, or else the interface of the default route, or else the first Wi-Fi interface. Docker, Tailscale, bridge and veth devices are never touched.
- A reconnect writes a marker first. If the run is cut short between disconnect and connect, the next run connects the interface again.

A booked talk is not looked at, because nothing can be asked while the network is down. The reboot can therefore come during a talk, but only after 30 minutes of no network at all.

What it knows is in `/var/lib/teletraan/netwatch.json`: `failures`, `lastCheckAt`, `lastOkAt`, `lastAction` (none, restart_network, bounce_interface or reboot), `lastActionAt` and `lastRebootAt`. `make net-status` prints it. Every action is a line in the log, and a push message goes out when a chat webhook is set (docs/OPERATIONS.md, "Heartbeat and push"). When the network works again it writes the document status-mini in Sanity (`networkLastOkAt`, `networkDownSince`, `networkLastProblemAt`, `networkRecoveries` for the last 24 hours, and `networkLastStep`), at once after a change and otherwise once an hour.

## On the TV

Nothing on the screen says an error. When a source of the sync service has not had a good read for more than 10 minutes, the status pill at the foot of the screen says Offline since the time of its last good read, in amber, and in red when every source has gone more than 30 minutes (docs/OPERATIONS.md, "Services"). Whoever turns on Show connection status gets a small text with the last read and the item counts, with no error word in it. The page cannot see the computer's files, so `kiosk.sh` copies `networkDownSince` and `networkLastStep` into `device.json` every minute; the line The Teletraan computer is trying to fix this by itself is part of that text.

## The control page

Settings, Sync and restart has a Network card with the button Check the network now. It prints the connection type, the interface, the link, the signal (Wi-Fi), the address, the gateway, the name servers, the power saving state, the last five lines of the network journal and the record of the watchdog. Status, Health has a Network line such as `ok, last problem 3 days ago, 2 recoveries in 24 hours`.

The journal lines are cleaned before they are shown: a password, a key or a long token becomes REDACTED, and the Wi-Fi password file is never read. The login user is not in the `systemd-journal` group, because that group reads every log on the computer. Instead `computer/sudoers/teletraan-control` allows the one command `journalctl -u NetworkManager.service -u wpa_supplicant.service -u systemd-networkd.service --no-pager -n 60 -o short-iso`, with those arguments and no others.

## What `install-network.sh` changes

Run by the update of the Mac tool, or by hand: `sudo /opt/teletraan/computer/scripts/install-network.sh`. It asks for Enter first, writes a file only when its text is different, and says what it did. Running it again changes nothing. To take the settings (3 to 6 below) away: `sudo /opt/teletraan/computer/scripts/install-network.sh --undo`. The timer and the sudo rules stay.

| # | What | Why | Undo by hand |
|---|------|-----|--------------|
| 1 | `teletraan-netwatch.service` and `.timer`, run as the login user, and `/var/lib/teletraan/netwatch.json` and `/var/log/teletraan` for it to write | The watchdog. The older `teletraan-network` timer is turned off and its files removed | `sudo systemctl disable --now teletraan-netwatch.timer` |
| 2 | `/etc/sudoers.d/teletraan-network`: `nmcli device reapply`, `disconnect`, `connect`, `networkctl renew`, `reconfigure`, `ifup`, `ifdown`, each with the name of one interface (`wlp2s0` and `enp3s0f0` here), and `modprobe -r` and `modprobe` for the driver module of each Wi-Fi interface, no wildcard | Netwatch may run exactly these as root. The names come from `nmcli device`, the managed Ethernet and Wi-Fi devices only, and the module from `/sys` | Delete the file |
| 3 | `/etc/NetworkManager/conf.d/teletraan-wifi.conf` with `wifi.powersave = 2` (written only when NetworkManager is the manager in use, nothing is restarted, and it applies at the next reconnect), and `nmcli connection modify <connection> 802-11-wireless.powersave 2` for the active Wi-Fi connection. With `iw` installed, also `iw dev wlp2s0 set power_save off` and a udev rule | The Wi-Fi chip sleeps when idle and misses packets. 2 means disabled | `--undo` |
| 4 | `/etc/udev/rules.d/70-teletraan-network.rules`: energy-efficient Ethernet off (only if `ethtool --show-eee` reports it on), USB autosuspend off for a USB adapter | The same kind of sleeping in the wired port and in a USB adapter | `--undo` |
| 5 | `sleep`, `suspend`, `hibernate`, `hybrid-sleep` and `suspend-then-hibernate` masked, and `/etc/systemd/logind.conf.d/70-teletraan-no-sleep.conf` with `IdleAction=ignore` and the lid and suspend keys ignored | A computer that suspends has no network | `--undo` |
| 6 | In `/etc/NetworkManager/conf.d/70-teletraan-network.conf`: `connection.autoconnect-retries = 0` and `ipv4.dhcp-timeout = 2147483647` | NetworkManager gives up on a connection after 4 failed tries and the computer stays offline until someone restarts it. This makes it keep trying. The DHCP client has no keepalive; this is the nearest thing | `--undo` |

`kiosk.sh` already turns off the screen saver and screen blanking (`xset s off`, `xset -dpms`). `iw` is not installed on the computer. `sudo apt install iw` adds the second way to turn Wi-Fi power saving off, and lets the network check read the adapter's own state. Ask the team mentor first.

The computer touches a router every 2 minutes from netwatch (a ping to the gateway), which also keeps the router's address table entry for it fresh.

## Finding the real cause

Run these on the Teletraan computer over SSH, after the next time the banner comes up. They only read.

    nmcli -f NAME,TYPE,DEVICE connection show --active
    nmcli -g 802-11-wireless.powersave connection show "Amazing SpiderLAN"
    nmcli device status
    ip -br addr
    ip route show default
    cat /sys/class/net/wlp2s0/operstate /sys/class/net/enp3s0f0/carrier
    sudo journalctl -u NetworkManager -u wpa_supplicant --since "yesterday 15:00" --until "yesterday 19:00" --no-pager | grep -Ei "disconnect|deauth|dhcp|state change|timeout|carrier|lost|fail"
    sudo journalctl -k --since "yesterday 15:00" --until "yesterday 19:00" --no-pager | grep -Ei "wlp2s0|brcm|firmware|link|suspend|resume|PM:"
    make logs SERVICE=netwatch LINES=200
    make net-status
    systemctl is-enabled sleep.target suspend.target hibernate.target
    lspci | grep -i network
    dmesg | grep -iE "brcm|wl:|firmware|wlp2s0" | tail -20

What the answers mean:

- `deauth` or `reason=3` from the access point: the router dropped the computer, which is a router or signal problem. A cable fixes it.
- `dhcp ... timeout` right before: the computer lost its lease and could not get a new one. The first action of the ladder is for this.
- `suspend` or `PM:` lines in the kernel log: the computer slept. Check step 5 of the table.
- A Broadcom `brcm` or `firmware` error: the Wi-Fi driver crashed. The second action reloads the driver, which may not be enough. The cable is the answer.
- Nothing at all in the journal and the clock stopped in the log: the computer itself was off or frozen.

The log says whether netwatch saw it and what helped. `Check the network now` on the control page prints most of this without SSH.

## When something is wrong

- `netwatch: the reboot was refused` or `failed (code 1), check that the sudoers files are installed`: run the update of the Mac tool, choice 1, which runs `computer/install.sh` and `install-network.sh`.
- `journal: could not be read` in Check the network now: the sudo rule for `journalctl` is missing. Same fix.
- Nothing happens although the network is down: it is in the first 5 minutes after boot, or an action ran less than 3 minutes ago. The log says which.
- To stop it for a while: `sudo systemctl stop teletraan-netwatch.timer`.
