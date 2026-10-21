#!/bin/bash
# Usage: network-watchdog.sh   (started by teletraan-network.timer every 2 minutes, as the login user)
# Keeps the Teletraan computer on the network. The screen needs one thing from the network: to reach the Sanity API
# host of the project over HTTPS. Every run checks that, and also the default gateway (ping) and the name lookup of the
# Sanity host (getent), so the journal says which part broke. Only the Sanity check decides: a run where it works is
# fine, whatever the other two say. Nothing here calls Sanity for a decision, and nothing needs the network to work.
#
# After 3 failed checks in a row (6 minutes) it climbs a ladder, one step per run and never two at once:
#   1  re-read DHCP         nmcli device reapply, networkctl renew, or ifup --force
#   2  reconnect            nmcli device disconnect and connect, networkctl reconfigure, or ifdown and ifup
#   3  restart the network service (NetworkManager, or systemd-networkd and systemd-resolved, or networking)
#   4  restart the screen   so the browser makes new connections (the same sudo rule as watchdog.sh)
#   5  reboot               only after 30 minutes down
# Which manager the computer uses is found at each run and written in the log line.
#
# So that it can never loop:
#   - a step waits at least 3 minutes after the one before it (the timer adds up to 2 more)
#   - a step is not taken again within 30 minutes, and each step is taken at most once per outage
#   - nothing is done in the first 5 minutes after boot, and no reboot in the first 10
#   - the reboot happens at most once in 6 hours (this script's own record and the record of the scheduled reboot),
#     and the state is written before the reboot is asked for
# When the ladder is used up the script only watches until the network is back.
#
# What it knows is kept in <data folder>/network/state (NAME=value lines), history (time, step, result), and
# status.json, which status-write.sh network sends to the document status-mini once the network works. kiosk.sh puts
# the down time and the last step into device.json, so the page can tell the TV that the computer is trying.
# The restarts go through sudo -n, which computer/sudoers/teletraan-control and the interface rules of
# /etc/sudoers.d/teletraan-network (written by install-network.sh) allow, command by command.
#
# Tests set NETWORK_NOW, NETWORK_UPTIME and NETWORK_SETTLE (seconds), NETWORK_BOOT_FILE, TELETRAAN_SYSTEMCTL,
# TELETRAAN_NMCLI, TELETRAAN_NETWORKCTL, TELETRAAN_IFUP, TELETRAAN_IFDOWN, NETWORK_SYS and NETWORK_INTERFACES_FILE.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

say() {
  echo "network: $*"
}

for tool in curl ip sudo awk flock; do
  command -v "$tool" > /dev/null 2>&1 || { say "$tool is not installed, so the network cannot be checked." >&2; exit 1; }
done

systemctl_bin=${TELETRAAN_SYSTEMCTL:-/usr/bin/systemctl}
nmcli_bin=${TELETRAAN_NMCLI:-/usr/bin/nmcli}
networkctl_bin=${TELETRAAN_NETWORKCTL:-/usr/bin/networkctl}
ifup_bin=${TELETRAAN_IFUP:-/usr/sbin/ifup}
ifdown_bin=${TELETRAAN_IFDOWN:-/usr/sbin/ifdown}
boot_file=${NETWORK_BOOT_FILE:-/proc/sys/kernel/random/boot_id}

# The limits, in seconds
need_failures=3
step_pause=180
step_cooldown=1800
boot_wait=300
reboot_boot_wait=600
reboot_after_down=1800
reboot_gap=21600
status_every=3600
settle=${NETWORK_SETTLE:-20}

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
folder="$data/network"
mkdir -p "$folder"
chmod 755 "$folder" 2> /dev/null || true
state="$folder/state"
history="$folder/history"
pending="$folder/reconnect-pending"

# A run that starts while the last one is still going stops at once
exec 9> "$folder/.lock"
if ! flock -n 9; then
  say "the last run is still going."
  exit 0
fi

project=$(config_value projectId)
dataset=$(config_value dataset)
version=$(config_value apiVersion)
if ! printf '%s' "$project" | grep -Eq '^[a-z0-9]+$' ||
  ! printf '%s' "$dataset" | grep -Eq '^[A-Za-z0-9_-]+$' ||
  ! printf '%s' "$version" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
  say "could not read the project ID, dataset and API version from dashboard/config.js." >&2
  exit 1
fi
sanity_host="$project.api.sanity.io"

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
step=$(kept step)
step_at=$(kept stepAt)
last_ok=$(kept lastOkAt)
last_problem=$(kept lastProblemAt)
note_at=$(kept noteAt)
sent_at=$(kept sentAt)
sent_signature=$(sed -n 's/^sentSignature=//p' "$state" 2> /dev/null | tail -n 1 || true)
last_step_text=$(sed -n 's/^lastStep=//p' "$state" 2> /dev/null | tail -n 1 | tr -c 'A-Za-z0-9 \n' '?' | cut -c 1-40 || true)
last1=$(kept last1)
last2=$(kept last2)
last3=$(kept last3)
last4=$(kept last4)
last5=$(kept last5)
# The recoveries of the last 24 hours, one time each. A time after now was written before the clock was set back.
recoveries=$(sed -n 's/^recovery=//p' "$state" 2> /dev/null | awk -v now="$now" '$1 ~ /^[0-9]+$/ && $1 <= now && now - $1 < 86400 { print $1 }' || true)

sanity_result=unknown
gateway_result=unknown
dns_result=unknown
manager=unknown
interface=''

# A new boot starts a new streak and a new ladder. The record of when each step last ran, of the outage and of the
# recoveries stays, so a reboot cannot start the ladder from the top as if nothing had been tried.
if [ "$kept_boot" != "$boot" ]; then
  fails=0
  step=0
  step_at=0
fi

# Writes the state file by way of a temporary file in the same folder, so a cut power does not leave half a file
save_state() {
  local temporary="$state.tmp.$$"
  {
    echo "boot=$boot"
    echo "checkedAt=$now"
    echo "manager=$manager"
    echo "interface=$interface"
    echo "sanity=$sanity_result"
    echo "gateway=$gateway_result"
    echo "dns=$dns_result"
    echo "fails=$fails"
    echo "firstFail=$first_fail"
    echo "downSince=$down_since"
    echo "step=$step"
    echo "stepAt=$step_at"
    echo "lastStep=$last_step_text"
    echo "lastOkAt=$last_ok"
    echo "lastProblemAt=$last_problem"
    echo "noteAt=$note_at"
    echo "sentAt=$sent_at"
    echo "sentSignature=$sent_signature"
    echo "last1=$last1"
    echo "last2=$last2"
    echo "last3=$last3"
    echo "last4=$last4"
    echo "last5=$last5"
    printf '%s\n' "$recoveries" | awk 'NF { print "recovery=" $1 }'
  } > "$temporary" 2> /dev/null && mv -f "$temporary" "$state" 2> /dev/null || {
    rm -f "$temporary" 2> /dev/null || true
    return 1
  }
}

# One line of history: the time, the step and the result. Only the last 200 lines are kept.
record() {
  printf '%s %s %s\n' "$(iso_at "$now")" "$1" "$2" >> "$history" 2> /dev/null || return 0
  if [ "$(wc -l < "$history" 2> /dev/null || echo 0)" -gt 200 ]; then
    tail -n 200 "$history" > "$history.tmp.$$" 2> /dev/null && mv -f "$history.tmp.$$" "$history" 2> /dev/null || rm -f "$history.tmp.$$" 2> /dev/null || true
  fi
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
check_sanity() {
  local code=0 http
  http=$(curl --disable --silent --output /dev/null --write-out '%{http_code}' --max-time 10 --connect-timeout 10 --proto '=https' \
    --get --data-urlencode 'query=count(*[_id=="status-mini"])' --data-urlencode 'perspective=published' \
    "https://$sanity_host/v$version/data/query/$dataset" 2> /dev/null) || code=$?
  # Any answer from the host means the network works, even an error page: Sanity being down is not this script's business
  if [ "$code" -eq 0 ] && [ "$http" != 000 ]; then
    sanity_result=ok
  elif [ "$code" -eq 60 ]; then
    sanity_result=certificate
  else
    sanity_result=fail
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
  elif timeout 5 getent hosts "$sanity_host" > /dev/null 2>&1; then
    dns_result=ok
  else
    dns_result=fail
  fi
}

# ----- the ladder -----
# Says a reason at most once in 30 minutes, so a long wait is not a line every 2 minutes
note() {
  if [ $((now - note_at)) -ge "$step_cooldown" ]; then
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

# Runs the commands of one step. Gives 0 when they all worked.
do_step() {
  local n=$1 code=0
  if [ "$n" = 4 ]; then
    as_root "$systemctl_bin" restart teletraan-kiosk.service
    return $?
  fi
  [ -n "$interface" ] || return 3
  case $manager:$n in
    networkmanager:1)
      as_root "$nmcli_bin" device reapply "$interface" || code=$?
      ;;
    networkmanager:2)
      printf '%s' "$interface" > "$pending"
      as_root "$nmcli_bin" device disconnect "$interface" || code=$?
      sleep "$([ "$settle" -gt 0 ] && echo 2 || echo 0)"
      if as_root "$nmcli_bin" device connect "$interface"; then
        rm -f "$pending"
      else
        code=1
      fi
      ;;
    networkmanager:3)
      as_root "$systemctl_bin" restart NetworkManager.service || code=$?
      ;;
    networkd:1)
      as_root "$networkctl_bin" renew "$interface" || code=$?
      ;;
    networkd:2)
      as_root "$networkctl_bin" reconfigure "$interface" || code=$?
      ;;
    networkd:3)
      as_root "$systemctl_bin" restart systemd-networkd.service || code=$?
      if "$systemctl_bin" is-active --quiet systemd-resolved.service 2> /dev/null; then
        as_root "$systemctl_bin" restart systemd-resolved.service || code=$?
      fi
      ;;
    ifupdown:1)
      as_root "$ifup_bin" --force "$interface" || code=$?
      ;;
    ifupdown:2)
      as_root "$ifdown_bin" "$interface" || code=$?
      as_root "$ifup_bin" "$interface" || code=$?
      ;;
    ifupdown:3)
      as_root "$systemctl_bin" restart networking.service || code=$?
      ;;
    *)
      return 4
      ;;
  esac
  return "$code"
}

step_name() {
  case $1 in 1) echo dhcp ;; 2) echo reconnect ;; 3) echo service ;; 4) echo screen ;; 5) echo reboot ;; esac
}

run_step() {
  local n=$1 name code=0 result
  name=$(step_name "$n")
  # The state goes first, so a step that is asked for twice is still one step
  case $n in 1) last1=$now ;; 2) last2=$now ;; 3) last3=$now ;; 4) last4=$now ;; esac
  step=$n
  step_at=$now
  last_step_text="$n $name"
  if ! save_state; then
    say "$state cannot be written, so nothing is done." >&2
    exit 1
  fi
  say "$fails checks failed (sanity $sanity_result, gateway $gateway_result, dns $dns_result), manager $manager, interface ${interface:-none}. Step $n of 5: $name."
  do_step "$n" || code=$?
  case $code in
    0)
      sleep "$settle"
      check_sanity
      if [ "$sanity_result" = ok ]; then result='worked, the network answers again'; else result='done, still down'; fi
      ;;
    3) result='skipped, no interface found' ;;
    4) result='skipped, no known network manager' ;;
    *) result="failed (code $code), check that the sudoers files are installed" ;;
  esac
  say "step $n $name: $result."
  record "$n-$name" "$result"
  dirty=1
}

# Step 5. The guards come first and the state is written before the reboot is asked for.
try_reboot() {
  local down_for=$((now - down_since)) reboot_state="$data/reboot/state.json" last_reboot=0
  if [ "$down_for" -lt "$reboot_after_down" ]; then
    return 0
  fi
  if [ "$uptime_seconds" -lt "$reboot_boot_wait" ]; then
    note "down for $((down_for / 60)) minutes, but the computer started less than 10 minutes ago, so it is not rebooted."
    return 0
  fi
  if [ "$last5" -gt 0 ] && [ "$last5" -le "$now" ] && [ $((now - last5)) -lt "$reboot_gap" ]; then
    note "down for $((down_for / 60)) minutes, but this script rebooted less than 6 hours ago, so it does not reboot again."
    return 0
  fi
  if [ -s "$reboot_state" ] && command -v jq > /dev/null 2>&1; then
    last_reboot=$(jq -r '(.lastRebootAt // 0) / 1000 | floor' "$reboot_state" 2> /dev/null || echo 0)
    last_reboot=$(number "$last_reboot")
    if [ "$last_reboot" -gt 0 ] && [ "$last_reboot" -le "$now" ] && [ $((now - last_reboot)) -lt "$reboot_gap" ]; then
      note "down for $((down_for / 60)) minutes, but the computer rebooted less than 6 hours ago, so it does not reboot again."
      return 0
    fi
  fi

  last5=$now
  step=5
  step_at=$now
  last_step_text='5 reboot'
  if ! save_state; then
    say "$state cannot be written, so the computer is not rebooted." >&2
    exit 1
  fi
  # The scheduled reboot reads the same record, so it will not reboot again within 6 hours of this one
  if command -v jq > /dev/null 2>&1; then
    mkdir -p "$data/reboot" 2> /dev/null || true
    [ -s "$reboot_state" ] || echo '{}' > "$reboot_state" 2> /dev/null || true
    if jq -c --argjson at "$((now * 1000))" '.lastRebootAt = $at | .lastWhy = "network down"' "$reboot_state" > "$reboot_state.tmp.$$" 2> /dev/null; then
      mv -f "$reboot_state.tmp.$$" "$reboot_state" 2> /dev/null || rm -f "$reboot_state.tmp.$$" 2> /dev/null || true
    else
      rm -f "$reboot_state.tmp.$$" 2> /dev/null || true
    fi
  fi
  say "down for $((down_for / 60)) minutes and the earlier steps did not help. Step 5 of 5: reboot."
  record "5-reboot" "asked for"
  write_status_file
  if ! as_root "$systemctl_bin" reboot; then
    say "the reboot was refused. Check that computer/sudoers/teletraan-control is installed." >&2
    record "5-reboot" "refused"
  fi
  exit 0
}

escalate() {
  if [ "$uptime_seconds" -lt "$boot_wait" ]; then
    note "$fails checks failed, but the computer started less than 5 minutes ago, so it is given time."
    return 0
  fi
  if [ "$step_at" -gt 0 ] && [ "$step_at" -le "$now" ] && [ $((now - step_at)) -lt "$step_pause" ]; then
    return 0
  fi
  local next=$((step + 1)) last
  while [ "$next" -le 4 ]; do
    case $next in 1) last=$last1 ;; 2) last=$last2 ;; 3) last=$last3 ;; *) last=$last4 ;; esac
    if [ "$last" -gt 0 ] && [ "$last" -le "$now" ] && [ $((now - last)) -lt "$step_cooldown" ]; then
      say "step $next $(step_name "$next") ran $(((now - last) / 60)) minutes ago, so it is skipped."
      step=$next
      next=$((next + 1))
      continue
    fi
    run_step "$next"
    return 0
  done
  # After step 5 this still runs: it does nothing until 6 hours have passed since the last reboot
  try_reboot
}

# ----- one run -----
dirty=0
detect_manager
find_interface
finish_pending
check_sanity
check_gateway
check_dns

# Reachable with a certificate fault and a working gateway and name lookup is a wrong clock, not a broken network
network_ok=0
if [ "$sanity_result" = ok ]; then
  network_ok=1
elif [ "$sanity_result" = certificate ] && [ "$gateway_result" != fail ] && [ "$gateway_result" != none ] && [ "$dns_result" != fail ]; then
  network_ok=1
  note "the Sanity host answers but its certificate is refused. Check the date and time of the computer."
fi

if [ "$network_ok" -eq 1 ]; then
  if [ "$down_since" -gt 0 ]; then
    minutes=$(((now - down_since) / 60))
    say "the network is back after $minutes minutes (last step: ${last_step_text:-none}, manager $manager)."
    recoveries=$(printf '%s\n%s\n' "$recoveries" "$now" | awk 'NF')
    last_problem=$down_since
    record "back" "after $minutes minutes"
    dirty=1
  elif [ "$fails" -gt 0 ]; then
    say "$fails failed checks, then the network answered. Nothing was done."
  fi
  fails=0
  first_fail=0
  down_since=0
  step=0
  step_at=0
  last_ok=$now
else
  fails=$((fails + 1))
  [ "$fails" -gt 1 ] || first_fail=$now
  [ "$first_fail" -gt 0 ] || first_fail=$now
  if [ "$fails" -lt "$need_failures" ]; then
    say "check failed ($fails of $need_failures): sanity $sanity_result, gateway $gateway_result, dns $dns_result."
  else
    if [ "$down_since" -eq 0 ]; then
      down_since=$first_fail
      last_problem=$first_fail
      last_step_text=''
      dirty=1
      record "down" "sanity $sanity_result, gateway $gateway_result, dns $dns_result, manager $manager"
      say "the network is down: sanity $sanity_result, gateway $gateway_result, dns $dns_result, manager $manager."
    fi
    save_state || true
    escalate
  fi
fi

save_state || say "could not write $state." >&2
write_status_file

# Tell Studio when the network works and something changed, and once an hour as a sign of life. A failed send is tried again
# at the next run. Without a write token status-write.sh does nothing and says nothing.
if [ "$network_ok" -eq 1 ]; then
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
