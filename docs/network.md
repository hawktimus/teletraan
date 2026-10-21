# The network of the Teletraan computer

The red banner on the TV says SANITY UNREACHABLE: NETWORK DOWN when the page cannot reach Sanity. If it comes back by itself every day after the screen has sat idle, the Teletraan computer is losing its network, most likely on Wi-Fi. This page says what the computer does about it, what to do by hand, and how to find the real cause.

Nothing here was run on the real computer yet. The scripts were tried against fakes (`tests/network-watchdog.test.mjs`, `tests/network-install.test.mjs`).

## The best fix: a cable

A wall display should be on Ethernet. The computer has a port (`enp3s0f0`), and nothing is plugged in. A cable has no power saving, no roaming and no radio that a microwave or a school full of phones can crowd out. Plug a cable from the computer to the router or a wall socket. Nothing has to be set: NetworkManager prefers a cable, and the network watchdog acts on the cable when it has a link. Leave Wi-Fi on as the backup.

## What the network watchdog does

`computer/scripts/network-watchdog.sh` runs every 2 minutes (`teletraan-network.timer`) as the login user. Each run checks three things and keeps the answers in `network/state` in the data folder:

- Sanity: one HTTPS request to the Sanity API host of the project, with a 10 second limit. Any answer, even an error page, counts as working. Only this check decides.
- The gateway: one ping to the default gateway.
- The name lookup of the Sanity host.

The three results are only there so that the journal says which part broke. After 3 failed Sanity checks in a row (6 minutes) it climbs this ladder, one step at a time:

| Step | Name | NetworkManager | systemd-networkd | ifupdown |
|------|------|----------------|------------------|----------|
| 1 | dhcp | `nmcli device reapply` | `networkctl renew` | `ifup --force` |
| 2 | reconnect | `nmcli device disconnect` then `connect` | `networkctl reconfigure` | `ifdown` then `ifup` |
| 3 | service | restart NetworkManager | restart systemd-networkd and systemd-resolved | restart networking |
| 4 | screen | restart `teletraan-kiosk` so the browser makes new connections | same | same |
| 5 | reboot | only after 30 minutes down | same | same |

It finds which manager runs at each run and writes it in the journal line. The computer in the classroom uses NetworkManager.

It cannot loop:

- A step waits at least 3 minutes after the one before it, and a run takes only one step.
- Each of steps 1 to 4 is taken once per outage, and not again within 30 minutes even if the network drops and returns.
- Nothing is done in the first 5 minutes after boot, and no reboot in the first 10.
- The reboot happens at most once in 6 hours. It looks at its own record and at the record of the scheduled reboot, and writes the state before it asks for the reboot.
- It acts only on the Ethernet port that has a cable, or else the interface of the default route, or else the first Wi-Fi interface. Docker, Tailscale, bridge and veth devices are never touched.
- A reconnect writes a marker first. If the run is cut short between disconnect and connect, the next run connects the interface again.

A booked talk is not looked at, because Sanity cannot be asked while the network is down. Steps 4 and 5 can therefore restart the screen during a talk, but only after at least 6 minutes of no network at all.

What it did is one line in the journal, `journalctl -u teletraan-network`, and one line in `network/history` (time, step, result). When the network works again it writes the document status-mini in Sanity (`networkLastOkAt`, `networkDownSince`, `networkLastProblemAt`, `networkRecoveries` for the last 24 hours, and `networkLastStep`), at once after a change and otherwise once an hour.

## On the TV

The banner is unchanged: SANITY UNREACHABLE: NETWORK DOWN, what to check, the last good read. After the network has been down more than 10 minutes, and the watchdog has taken a step, it adds one line: The Teletraan computer is trying to fix this by itself. The page cannot see the computer's files, so `kiosk.sh` copies `networkDownSince` and `networkLastStep` into `device.json` every minute, and the page reads that file. The line is there only while both are set. When the network returns the page reads Sanity again within 30 seconds (every 30 seconds after a failure) and the banner goes away. No page reload is needed (`tests/reliability.test.mjs`, a 30 minute outage).

## The control page

Settings, Sync and restart has a Network card with the button Check the network now. It prints the connection type, the interface, the link, the signal (Wi-Fi), the address, the gateway, the name servers, the power saving state, the last five lines of the network journal and the record of the watchdog. Status, Health has a Network line such as `ok, last problem 3 days ago, 2 recoveries in 24 hours`.

The journal lines are cleaned before they are shown: a password, a key or a long token becomes REDACTED, and the Wi-Fi password file is never read. The login user is not in the `systemd-journal` group, because that group reads every log on the computer. Instead `computer/sudoers/teletraan-control` allows the one command `journalctl -u NetworkManager.service -u wpa_supplicant.service -u systemd-networkd.service --no-pager -n 60 -o short-iso`, with those arguments and no others.

## What `install-network.sh` changes

Run by the update of the Mac tool, or by hand: `sudo /opt/teletraan/computer/scripts/install-network.sh`. It asks for Enter first, writes a file only when its text is different, and says what it did. Running it again changes nothing. To take the settings (3 to 6 below) away: `sudo /opt/teletraan/computer/scripts/install-network.sh --undo`. The timer and the sudo rules stay.

| # | What | Why | Undo by hand |
|---|------|-----|--------------|
| 1 | `teletraan-network.service` and `.timer`, run as the login user | The watchdog | `sudo systemctl disable --now teletraan-network.timer` |
| 2 | `/etc/sudoers.d/teletraan-network`: `nmcli device reapply`, `disconnect`, `connect`, `networkctl renew`, `reconfigure`, `ifup`, `ifdown`, each with the name of one interface (`wlp2s0` and `enp3s0f0` here), no wildcard | The watchdog may run exactly these as root. The names come from `nmcli device`, the managed Ethernet and Wi-Fi devices only | Delete the file |
| 3 | `/etc/NetworkManager/conf.d/70-teletraan-network.conf` with `wifi.powersave = 2`, and `nmcli connection modify <connection> 802-11-wireless.powersave 2` for the active Wi-Fi connection. With `iw` installed, also `iw dev wlp2s0 set power_save off` and a udev rule | The Wi-Fi chip sleeps when idle and misses packets. 2 means disabled | `--undo` |
| 4 | `/etc/udev/rules.d/70-teletraan-network.rules`: energy-efficient Ethernet off (only if `ethtool --show-eee` reports it on), USB autosuspend off for a USB adapter | The same kind of sleeping in the wired port and in a USB adapter | `--undo` |
| 5 | `sleep`, `suspend`, `hibernate`, `hybrid-sleep` and `suspend-then-hibernate` masked, and `/etc/systemd/logind.conf.d/70-teletraan-no-sleep.conf` with `IdleAction=ignore` and the lid and suspend keys ignored | A computer that suspends has no network | `--undo` |
| 6 | In the NetworkManager file: `connection.autoconnect-retries = 0` and `ipv4.dhcp-timeout = 2147483647` | NetworkManager gives up on a connection after 4 failed tries and the computer stays offline until someone restarts it. This makes it keep trying. The DHCP client has no keepalive; this is the nearest thing | `--undo` |

`kiosk.sh` already turns off the screen saver and screen blanking (`xset s off`, `xset -dpms`). `iw` is not installed on the computer. `sudo apt install iw` adds the second way to turn Wi-Fi power saving off, and lets the network check read the adapter's own state. Ask the team mentor first.

The computer touches a router every 2 minutes from the watchdog (a ping to the gateway), which also keeps the router's address table entry for it fresh.

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
    journalctl -u teletraan-network --since yesterday --no-pager
    cat /var/lib/teletraan/data/network/history
    systemctl is-enabled sleep.target suspend.target hibernate.target
    lspci | grep -i network
    dmesg | grep -iE "brcm|wl:|firmware|wlp2s0" | tail -20

What the answers mean:

- `deauth` or `reason=3` from the access point: the router dropped the computer, which is a router or signal problem. A cable fixes it.
- `dhcp ... timeout` right before: the computer lost its lease and could not get a new one. Step 1 of the ladder is for this.
- `suspend` or `PM:` lines in the kernel log: the computer slept. Check step 5 of the table.
- A Broadcom `brcm` or `firmware` error: the Wi-Fi driver crashed. Step 3 (restart NetworkManager) may not be enough. The cable is the answer.
- Nothing at all in the journal and the clock stopped in the log: the computer itself was off or frozen.

The history file says whether the watchdog saw it and what helped. `Check the network now` on the control page prints most of this without SSH.

## When something is wrong

- `network: the reboot was refused` or `failed (code 1), check that the sudoers files are installed`: run the update of the Mac tool, choice 1, which runs `computer/install.sh` and `install-network.sh`.
- `journal: could not be read` in Check the network now: the sudo rule for `journalctl` is missing. Same fix.
- The steps keep being skipped with `ran N minutes ago`: this is the 30 minute cool-down, working as meant.
- To stop it for a while: `sudo systemctl stop teletraan-network.timer`.
