#!/bin/bash
# Usage: netwatch.sh   (started by teletraan-netwatch.timer every 2 minutes, as the login user)
# Keeps the Teletraan computer on the network. Every run does three checks and writes one line to the log
# (/var/log/teletraan/netwatch.jsonl): a ping of the default gateway, a name lookup, and an HTTPS HEAD request to one
# neutral host. The host is NETWATCH_HOST in local.env, or the Sanity API host of the project when that is empty. Only the
# HTTPS check decides (any answer from the host counts, even an error page); the other two say in the log which part broke.
#
# Consecutive failed runs climb a ladder, one action per run and never two at once:
#   3 failures (6 minutes)   restart_network    restart NetworkManager (or systemd-networkd, or networking) and renew DHCP
#   6 failures (12 minutes)  bounce_interface   disconnect and connect the interface; for Wi-Fi, reload the driver as well
#   15 failures (30 minutes) reboot             at most once in 2 hours
# A run where the host answers resets the count and the ladder.
#
# So that it can never loop:
#   - an action waits at least 3 minutes after the one before it
#   - each action is taken at most once per outage, and nothing is taken in the first 5 minutes after boot
#   - no reboot in the first 10 minutes after boot, none within 2 hours of the last one (this script's own record and the
#     record of the scheduled reboot), and the state is written before the reboot is asked for
#
# What it knows is kept in /var/lib/teletraan/netwatch.json (failures, lastCheckAt, lastOkAt, lastAction, lastActionAt,
# lastRebootAt, which the status poller and status.json read) and, for its own use, <data folder>/network/state. It also
# writes network/status.json, which kiosk.sh puts into device.json and status-write.sh network sends to Studio.
# The restarts go through sudo -n, which computer/sudoers/teletraan-control and /etc/sudoers.d/teletraan-network (written by
# install-network.sh) allow, command by command. Raised actions are told to notify.sh, which queues a message while the
# network is down and sends it when it is back.
#
# Tests set NETWORK_NOW, NETWORK_UPTIME and NETWORK_SETTLE (seconds), NETWORK_BOOT_FILE, NETWATCH_STATE, TELETRAAN_SYSTEMCTL,
# TELETRAAN_NMCLI, TELETRAAN_NETWORKCTL, TELETRAAN_IFUP, TELETRAAN_IFDOWN, TELETRAAN_MODPROBE, NETWORK_SYS and NETWORK_INTERFACES_FILE.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

say() {
  echo "netwatch: $*"
}

for tool in curl ip sudo awk flock; do
  command -v "$tool" > /dev/null 2>&1 || { say "$tool is not installed, so the network cannot be checked." >&2; exit 1; }
done

systemctl_bin=${TELETRAAN_SYSTEMCTL:-/usr/bin/systemctl}
nmcli_bin=${TELETRAAN_NMCLI:-/usr/bin/nmcli}
networkctl_bin=${TELETRAAN_NETWORKCTL:-/usr/bin/networkctl}
ifup_bin=${TELETRAAN_IFUP:-/usr/sbin/ifup}
ifdown_bin=${TELETRAAN_IFDOWN:-/usr/sbin/ifdown}
modprobe_bin=${TELETRAAN_MODPROBE:-/usr/sbin/modprobe}
boot_file=${NETWORK_BOOT_FILE:-/proc/sys/kernel/random/boot_id}
public_state=${NETWATCH_STATE:-/var/lib/teletraan/netwatch.json}

# The limits. The failures are runs in a row, the rest are seconds.
restart_at=3
bounce_at=6
reboot_at=15
step_pause=180
boot_wait=300
reboot_boot_wait=600
reboot_gap=7200
status_every=3600
settle=${NETWORK_SETTLE:-20}

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
folder="$data/network"
mkdir -p "$folder"
chmod 755 "$folder" 2> /dev/null || true
state="$folder/state"
pending="$folder/reconnect-pending"

# A run that starts while the last one is still going stops at once
exec 9> "$folder/.lock"
if ! flock -n 9; then
  say "the last run is still going."
  exit 0
fi

host=$(setting NETWATCH_HOST)
if [ -z "$host" ]; then
  project=$(config_value projectId)
  host="$project.api.sanity.io"
fi
if ! printf '%s' "$host" | grep -Eq '^[A-Za-z0-9]([A-Za-z0-9.-]{0,120}[A-Za-z0-9])?$'; then
  say "NETWATCH_HOST in local.env is not a host name, and dashboard/config.js has no usable project ID." >&2
  exit 1
fi

now=${NETWORK_NOW:-$(date +%s)}
uptime_seconds=${NETWORK_UPTIME:-$(cut -d. -f1 /proc/uptime 2> /dev/null || echo 0)}
boot=$(cat "$boot_file" 2> /dev/null || echo unknown)

# GNU date takes -d @seconds, the BSD date on a Mac takes -r seconds
iso_at() {
  date -u -d "@$1" '+%Y-%m-%dT%H:%M:%SZ' 2> /dev/null || date -u -r "$1" '+%Y-%m-%dT%H:%M:%SZ'
}

# A number from the state file, or 0
number() {
  case $1 in ''|*[!0-9]*) echo 0 ;; *) echo "$1" ;; esac
}

kept() {
  number "$(sed -n "s/^$1=//p" "$state" 2> /dev/null | tail -n 1 || true)"
}

# ----- what the state file holds -----
kept_boot=$(sed -n 's/^boot=//p' "$state" 2> /dev/null | tail -n 1 || true)
fails=$(kept fails)
first_fail=$(kept firstFail)
down_since=$(kept downSince)
level=$(kept level)
level_at=$(kept levelAt)
last_ok=$(kept lastOkAt)
last_problem=$(kept lastProblemAt)
last_action=$(sed -n 's/^lastAction=//p' "$state" 2> /dev/null | tail -n 1 | tr -c 'a-z_\n' '?' | cut -c 1-20 || true)
last_action_at=$(kept lastActionAt)
last_reboot=$(kept lastRebootAt)
note_at=$(kept noteAt)
sent_at=$(kept sentAt)
sent_signature=$(sed -n 's/^sentSignature=//p' "$state" 2> /dev/null | tail -n 1 || true)
last_step_text=$(sed -n 's/^lastStep=//p' "$state" 2> /dev/null | tail -n 1 | tr -c 'A-Za-z0-9 \n' '?' | cut -c 1-40 || true)
# The recoveries of the last 24 hours, one time each. A time after now was written before the clock was set back.
recoveries=$(sed -n 's/^recovery=//p' "$state" 2> /dev/null | awk -v now="$now" '$1 ~ /^[0-9]+$/ && $1 <= now && now - $1 < 86400 { print $1 }' || true)
last_action=${last_action:-none}

https_result=unknown
gateway_result=unknown
dns_result=unknown
manager=unknown
interface=''

# A new boot starts a new streak and a new ladder. The record of the last action, of the outage and of the recoveries
# stays, so a reboot cannot start the ladder from the top as if nothing had been tried.
if [ "$kept_boot" != "$boot" ]; then
  fails=0
  level=0
  level_at=0
fi

# Writes the state file by way of a temporary file in the same folder, so a cut power does not leave half a file
save_state() {
  local temporary="$state.tmp.$$"
  {
    echo "boot=$boot"
    echo "manager=$manager"
    echo "interface=$interface"
    echo "fails=$fails"
    echo "firstFail=$first_fail"
    echo "downSince=$down_since"
    echo "level=$level"
    echo "levelAt=$level_at"
    echo "lastAction=$last_action"
    echo "lastActionAt=$last_action_at"
    echo "lastRebootAt=$last_reboot"
    echo "lastStep=$last_step_text"
    echo "lastOkAt=$last_ok"
    echo "lastProblemAt=$last_problem"
    echo "noteAt=$note_at"
    echo "sentAt=$sent_at"
    echo "sentSignature=$sent_signature"
    printf '%s\n' "$recoveries" | awk 'NF { print "recovery=" $1 }'
  } > "$temporary" 2> /dev/null && mv -f "$temporary" "$state" 2> /dev/null || {
    rm -f "$temporary" 2> /dev/null || true
    return 1
  }
}

# A time as a quoted ISO text, or null when it was never set
json_time() {
  if [ "$1" -gt 0 ]; then printf '"%s"' "$(iso_at "$1")"; else printf 'null'; fi
}

# /var/lib/teletraan/netwatch.json: the shape the status poller reads. The folder may belong to root, so the file is
# written in place (install-network.sh made it, owned by the login user).
write_public_state() {
  local text
  text=$(printf '{"failures":%s,"lastCheckAt":"%s","lastOkAt":%s,"lastAction":"%s","lastActionAt":%s,"lastRebootAt":%s}' \
    "$fails" "$(iso_at "$now")" "$(json_time "$last_ok")" "$last_action" "$(json_time "$last_action_at")" "$(json_time "$last_reboot")")
  printf '%s\n' "$text" > "$public_state" 2> /dev/null || say "could not write $public_state. install-network.sh makes it." >&2
}

# The status for the Teletraan computer's own pages and for status-write.sh network
write_status_file() {
  local down_text='' problem_text='' count ok_text=''
  [ "$down_since" -gt 0 ] && down_text=$(iso_at "$down_since")
  [ "$last_problem" -gt 0 ] && problem_text=$(iso_at "$last_problem")
  [ "$last_ok" -gt 0 ] && ok_text=$(iso_at "$last_ok")
  count=$(printf '%s\n' "$recoveries" | awk 'NF { n++ } END { print n + 0 }')
  local temporary="$folder/status.json.tmp.$$"
  if printf '{"networkLastOkAt":"%s","networkDownSince":"%s","networkRecoveries":%s,"networkLastStep":"%s","networkLastProblemAt":"%s"}\n' \
    "$ok_text" "$down_text" "$count" "$last_step_text" "$problem_text" > "$temporary" 2> /dev/null; then
    chmod 644 "$temporary" 2> /dev/null || true
    mv -f "$temporary" "$folder/status.json" 2> /dev/null || rm -f "$temporary" 2> /dev/null || true
  else
    rm -f "$temporary" 2> /dev/null || true
  fi
}

# ----- which manager, which interface -----
detect_manager() {
  if command -v "$nmcli_bin" > /dev/null 2>&1 && "$systemctl_bin" is-active --quiet NetworkManager.service 2> /dev/null; then
    manager=networkmanager
  elif "$systemctl_bin" is-active --quiet systemd-networkd.service 2> /dev/null; then
    manager=networkd
  elif command -v "$ifup_bin" > /dev/null 2>&1 && [ -f "${NETWORK_INTERFACES_FILE:-/etc/network/interfaces}" ]; then
    manager=ifupdown
  else
    manager=unknown
  fi
}

# The interface to act on: an Ethernet port with a cable in it first (carrier 1), then the interface of the default
# route, then the first Wi-Fi interface. Only en, eth and wl names count, so docker, tailscale, bridges and veth devices
# are never touched. install-network.sh allowed the same kinds of names in sudo, from NetworkManager's own list.
find_interface() {
  local found='' name sys=${NETWORK_SYS:-/sys/class/net}
  for name in $(ls "$sys" 2> /dev/null | grep -E '^(en|eth)[a-z0-9]*$' || true); do
    if [ "$(cat "$sys/$name/carrier" 2> /dev/null || echo 0)" = 1 ]; then
      found=$name
      break
    fi
  done
  if [ -z "$found" ]; then
    found=$(ip route show default 2> /dev/null | awk '/^default/ { for (i = 1; i < NF; i++) if ($i == "dev") { print $(i + 1); exit } }' || true)
  fi
  if [ -z "$found" ]; then
    found=$(ls "$sys" 2> /dev/null | grep -E '^wl[a-z0-9]*$' | head -n 1 || true)
  fi
  if printf '%s' "$found" | grep -Eq '^(en|eth|wl)[a-z0-9]{0,12}$'; then
    interface=$found
  else
    interface=''
  fi
}

# ----- the three checks -----
check_https() {
  local code=0 http
  http=$(curl --disable --silent --head --output /dev/null --write-out '%{http_code}' --max-time 10 --connect-timeout 10 --proto '=https' \
    "https://$host/" 2> /dev/null) || code=$?
  # Any answer from the host means the network works, even an error page: the host being down is not this script's business
  if [ "$code" -eq 0 ] && [ "$http" != 000 ]; then
    https_result=ok
  elif [ "$code" -eq 60 ]; then
    https_result=certificate
  else
    https_result=fail
  fi
}

check_gateway() {
  local gateway
  gateway=$(ip route show default 2> /dev/null | awk '/^default/ { for (i = 1; i < NF; i++) if ($i == "via") { print $(i + 1); exit } }' || true)
  if ! printf '%s' "$gateway" | grep -Eq '^[0-9A-Fa-f:.]+$'; then
    gateway_result=none
  elif ! command -v ping > /dev/null 2>&1; then
    gateway_result=skip
  elif ping -c 1 -W 2 "$gateway" > /dev/null 2>&1; then
    gateway_result=ok
  else
    gateway_result=fail
  fi
}

check_dns() {
  if ! command -v getent > /dev/null 2>&1 || ! command -v timeout > /dev/null 2>&1; then
    dns_result=skip
  elif timeout 5 getent hosts "$host" > /dev/null 2>&1; then
    dns_result=ok
  else
    dns_result=fail
  fi
}

# ----- the ladder -----
# Says a reason at most once in 30 minutes, so a long wait is not a line every 2 minutes
note() {
  if [ $((now - note_at)) -ge 1800 ]; then
    say "$1"
    note_at=$now
  fi
}

as_root() {
  sudo -n "$@" > /dev/null 2>&1
}

# A reconnect that was cut short leaves the interface down. The marker is written first, so the next run connects it.
finish_pending() {
  [ -f "$pending" ] || return 0
  local name
  name=$(head -c 20 "$pending" 2> /dev/null | tr -d '\n' || true)
  if printf '%s' "$name" | grep -Eq '^[a-z][a-z0-9]{0,14}$' && as_root "$nmcli_bin" device connect "$name"; then
    say "connected $name again after an earlier reconnect was cut short."
    rm -f "$pending"
  fi
}

# The kernel module of a Wi-Fi interface, or nothing. Only a plain module name is used, because it goes to sudo.
wifi_module() {
  case $interface in wl*) ;; *) return 0 ;; esac
  local module
  module=$(basename "$(readlink -f "${NETWORK_SYS:-/sys/class/net}/$interface/device/driver/module" 2> /dev/null)" 2> /dev/null || true)
  if printf '%s' "$module" | grep -Eq '^[a-z0-9_]{1,30}$'; then printf '%s' "$module"; fi
}

reload_wifi_driver() {
  local module
  module=$(wifi_module)
  [ -n "$module" ] || return 0
  as_root "$modprobe_bin" -r "$module" || return 1
  sleep "$([ "$settle" -gt 0 ] && echo 3 || echo 0)"
  as_root "$modprobe_bin" "$module" || return 1
  sleep "$([ "$settle" -gt 0 ] && echo 5 || echo 0)"
}

# Level 1: restart the network service and read DHCP again. Gives 0 when the commands worked.
restart_network() {
  local code=0
  [ -n "$interface" ] || return 3
  case $manager in
    networkmanager)
      as_root "$systemctl_bin" restart NetworkManager.service || code=$?
      sleep "$([ "$settle" -gt 0 ] && echo 5 || echo 0)"
      as_root "$nmcli_bin" device reapply "$interface" || code=$?
      ;;
    networkd)
      as_root "$systemctl_bin" restart systemd-networkd.service || code=$?
      if "$systemctl_bin" is-active --quiet systemd-resolved.service 2> /dev/null; then
        as_root "$systemctl_bin" restart systemd-resolved.service || code=$?
      fi
      as_root "$networkctl_bin" renew "$interface" || code=$?
      ;;
    ifupdown)
      as_root "$systemctl_bin" restart networking.service || code=$?
      as_root "$ifup_bin" --force "$interface" || code=$?
      ;;
    *) return 4 ;;
  esac
  return "$code"
}

# Level 2: take the interface down and bring it up; a Wi-Fi interface also gets its driver reloaded
bounce_interface() {
  local code=0
  [ -n "$interface" ] || return 3
  case $manager in
    networkmanager)
      printf '%s' "$interface" > "$pending"
      as_root "$nmcli_bin" device disconnect "$interface" || code=$?
      reload_wifi_driver || code=$?
      sleep "$([ "$settle" -gt 0 ] && echo 2 || echo 0)"
      if as_root "$nmcli_bin" device connect "$interface"; then
        rm -f "$pending"
      else
        code=1
      fi
      ;;
    networkd)
      reload_wifi_driver || code=$?
      as_root "$networkctl_bin" reconfigure "$interface" || code=$?
      ;;
    ifupdown)
      as_root "$ifdown_bin" "$interface" || code=$?
      reload_wifi_driver || code=$?
      as_root "$ifup_bin" "$interface" || code=$?
      ;;
    *) return 4 ;;
  esac
  return "$code"
}

action_name() {
  case $1 in 1) echo restart_network ;; 2) echo bounce_interface ;; 3) echo reboot ;; esac
}

# The word the device file and Studio show for each level
step_text_for() {
  case $1 in 1) echo '1 restart' ;; 2) echo '2 bounce' ;; 3) echo '3 reboot' ;; esac
}

run_action() {
  local n=$1 name code=0 result
  name=$(action_name "$n")
  # The state goes first, so an action that is asked for twice is still one action
  level=$n
  level_at=$now
  last_action=$name
  last_action_at=$now
  last_step_text=$(step_text_for "$n")
  if ! save_state; then
    say "$state cannot be written, so nothing is done." >&2
    exit 1
  fi
  say "$fails checks failed (https $https_result, gateway $gateway_result, dns $dns_result), manager $manager, interface ${interface:-none}. Action $n of 3: $name."
  log_json netwatch network action "$name after $fails failures, manager $manager, interface ${interface:-none}"
  "$computer/scripts/notify.sh" "netwatch: $name after $fails failed checks" > /dev/null 2>&1 || true
  if [ "$n" = 1 ]; then restart_network || code=$?; else bounce_interface || code=$?; fi
  case $code in
    0)
      sleep "$settle"
      check_https
      if [ "$https_result" = ok ]; then result='worked, the host answers again'; else result='done, still down'; fi
      ;;
    3) result='skipped, no interface found' ;;
    4) result='skipped, no known network manager' ;;
    *) result="failed (code $code), check that the sudoers files are installed" ;;
  esac
  say "action $n $name: $result."
  log_json netwatch network action_result "$name: $result"
}

# Action 3. The guards come first and the state is written before the reboot is asked for.
try_reboot() {
  local down_for=$((now - down_since)) reboot_state="$data/reboot/state.json" scheduled=0
  if [ "$uptime_seconds" -lt "$reboot_boot_wait" ]; then
    note "$fails checks failed, but the computer started less than 10 minutes ago, so it is not rebooted."
    return 0
  fi
  if [ "$last_reboot" -gt 0 ] && [ "$last_reboot" -le "$now" ] && [ $((now - last_reboot)) -lt "$reboot_gap" ]; then
    note "down for $((down_for / 60)) minutes, but this script rebooted less than 2 hours ago, so it does not reboot again."
    return 0
  fi
  if [ -s "$reboot_state" ] && command -v jq > /dev/null 2>&1; then
    scheduled=$(jq -r '(.lastRebootAt // 0) / 1000 | floor' "$reboot_state" 2> /dev/null || echo 0)
    scheduled=$(number "$scheduled")
    if [ "$scheduled" -gt 0 ] && [ "$scheduled" -le "$now" ] && [ $((now - scheduled)) -lt "$reboot_gap" ]; then
      note "down for $((down_for / 60)) minutes, but the computer rebooted less than 2 hours ago, so it does not reboot again."
      return 0
    fi
  fi

  level=3
  level_at=$now
  last_reboot=$now
  last_action=reboot
  last_action_at=$now
  last_step_text=$(step_text_for 3)
  if ! save_state; then
    say "$state cannot be written, so the computer is not rebooted." >&2
    exit 1
  fi
  # The scheduled reboot reads the same record, so it will not reboot again within its own gap of this one
  if command -v jq > /dev/null 2>&1; then
    mkdir -p "$data/reboot" 2> /dev/null || true
    [ -s "$reboot_state" ] || echo '{}' > "$reboot_state" 2> /dev/null || true
    if jq -c --argjson at "$((now * 1000))" '.lastRebootAt = $at | .lastWhy = "network down"' "$reboot_state" > "$reboot_state.tmp.$$" 2> /dev/null; then
      mv -f "$reboot_state.tmp.$$" "$reboot_state" 2> /dev/null || rm -f "$reboot_state.tmp.$$" 2> /dev/null || true
    else
      rm -f "$reboot_state.tmp.$$" 2> /dev/null || true
    fi
  fi
  say "down for $((down_for / 60)) minutes and the earlier actions did not help. Action 3 of 3: reboot."
  log_json netwatch network action "reboot after $fails failures"
  "$computer/scripts/notify.sh" "netwatch: rebooting after $fails failed checks" > /dev/null 2>&1 || true
  write_status_file
  write_public_state
  if ! as_root "$systemctl_bin" reboot; then
    say "the reboot was refused. Check that computer/sudoers/teletraan-control is installed." >&2
    log_json netwatch network action_result "reboot refused"
  fi
  exit 0
}

# One action per run: the lowest one whose number of failures has been reached and that this outage has not had yet
escalate() {
  if [ "$uptime_seconds" -lt "$boot_wait" ]; then
    note "$fails checks failed, but the computer started less than 5 minutes ago, so it is given time."
    return 0
  fi
  if [ "$level_at" -gt 0 ] && [ "$level_at" -le "$now" ] && [ $((now - level_at)) -lt "$step_pause" ]; then
    return 0
  fi
  if [ "$level" -lt 1 ] && [ "$fails" -ge "$restart_at" ]; then
    run_action 1
  elif [ "$level" -lt 2 ] && [ "$fails" -ge "$bounce_at" ]; then
    run_action 2
  elif [ "$level" -lt 3 ] && [ "$fails" -ge "$reboot_at" ]; then
    try_reboot
  fi
}

# ----- one run -----
detect_manager
find_interface
finish_pending
check_https
check_gateway
check_dns

# Reachable with a certificate fault and a working gateway and name lookup is a wrong clock, not a broken network
network_ok=0
if [ "$https_result" = ok ]; then
  network_ok=1
elif [ "$https_result" = certificate ] && [ "$gateway_result" != fail ] && [ "$gateway_result" != none ] && [ "$dns_result" != fail ]; then
  network_ok=1
  note "the host answers but its certificate is refused. Check the date and time of the computer."
fi

if [ "$network_ok" -eq 1 ]; then
  if [ "$down_since" -gt 0 ]; then
    minutes=$(((now - down_since) / 60))
    say "the network is back after $minutes minutes (last action: $last_action, manager $manager)."
    recoveries=$(printf '%s\n%s\n' "$recoveries" "$now" | awk 'NF')
    last_problem=$down_since
    log_json netwatch network recovered "back after $minutes minutes, last action $last_action"
    "$computer/scripts/notify.sh" "network is back after $minutes minutes (last action: $last_action)" > /dev/null 2>&1 || true
  elif [ "$fails" -gt 0 ]; then
    say "$fails failed checks, then the network answered. Nothing was done."
  fi
  fails=0
  first_fail=0
  down_since=0
  level=0
  level_at=0
  last_ok=$now
else
  fails=$((fails + 1))
  [ "$fails" -gt 1 ] || first_fail=$now
  [ "$first_fail" -gt 0 ] || first_fail=$now
  if [ "$fails" -lt "$restart_at" ]; then
    say "check failed ($fails of $restart_at): https $https_result, gateway $gateway_result, dns $dns_result."
  else
    if [ "$down_since" -eq 0 ]; then
      down_since=$first_fail
      last_problem=$first_fail
      last_step_text=''
      log_json netwatch network down "https $https_result, gateway $gateway_result, dns $dns_result, manager $manager"
      say "the network is down: https $https_result, gateway $gateway_result, dns $dns_result, manager $manager."
    fi
    save_state || true
    escalate
  fi
fi

log_json netwatch network check "ping $gateway_result, dns $dns_result, https $https_result, failures $fails"
save_state || say "could not write $state." >&2
write_status_file
write_public_state

# Tell Studio when the network works and something changed, and once an hour as a sign of life. A failed send is tried again
# at the next run. Without a write token status-write.sh does nothing and says nothing. The same moment sends the messages
# that notify.sh kept while the network was down.
if [ "$network_ok" -eq 1 ]; then
  "$computer/scripts/notify.sh" --flush > /dev/null 2>&1 || true
  signature="$down_since|$last_step_text|$last_problem|$(printf '%s\n' "$recoveries" | awk 'NF { n++ } END { print n + 0 }')"
  if [ "$signature" != "$sent_signature" ] || [ "$sent_at" -eq 0 ] || [ $((now - sent_at)) -ge "$status_every" ] || [ "$sent_at" -gt "$now" ]; then
    if "$computer/scripts/status-write.sh" network > /dev/null 2>&1; then
      sent_signature=$signature
      sent_at=$now
      save_state || true
    fi
  fi
fi
exit 0
