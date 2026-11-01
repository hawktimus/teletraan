#!/bin/bash
# Usage: sudo teletraan-net scan | switch | restart | dns-public | dns-default
# Installed by computer/install.sh as /usr/local/sbin/teletraan-net, owned by root. The control helper
# (computer/scripts/control-helper.sh) runs it through sudo, and computer/sudoers/teletraan-control allows that one path with
# no argument list, so this script is the check: it takes the five words above and nothing else.
#
#   scan        look for Wi-Fi networks and print one line each: network: <signal>|<password yes or no>|<in use 1 or 0>|<name>
#   switch      read the network name, the password and a host to test from standard input (one line each), then
#               start run-switch on its own as a systemd unit and answer at once. The page loses its connection while the
#               computer changes network, so the answer cannot wait for the result.
#   run-switch  (started by switch) save the network, join it, test it, and go back to the old network when the test fails
#   restart     restart the network manager and renew the address
#   dns-public  use public name servers on the active connection, dns-default goes back to the ones the network hands out
#
# The password is read from standard input, kept in a file only root can read until run-switch has read it, and written only
# to the NetworkManager connection file (mode 600, root). It is never on a command line, in a log or in the result file.
# The result file (wifi-last in the state folder) holds plain label: value lines for the control page.
#
# Tests run it as a normal user with fakes: the NET_* overrides below are read only when this script is not root, so sudo
# and a root shell ignore them.
set -euo pipefail

if [ "$(id -u)" -eq 0 ]; then
  nmcli_bin=/usr/bin/nmcli
  systemctl_bin=/usr/bin/systemctl
  systemd_run_bin=/usr/bin/systemd-run
  curl_bin=/usr/bin/curl
  self=/usr/local/sbin/teletraan-net
  state_dir=/var/lib/teletraan
  run_dir=/run/teletraan-net
  connection_dir=/etc/NetworkManager/system-connections
  settle=${NET_SETTLE:-3}
else
  nmcli_bin=${NET_NMCLI:-/usr/bin/nmcli}
  systemctl_bin=${NET_SYSTEMCTL:-/usr/bin/systemctl}
  systemd_run_bin=${NET_SYSTEMD_RUN:-/usr/bin/systemd-run}
  curl_bin=${NET_CURL:-/usr/bin/curl}
  self=${NET_SELF:-$0}
  state_dir=${NET_STATE_DIR:-/var/lib/teletraan}
  run_dir=${NET_RUN_DIR:-/run/teletraan-net}
  connection_dir=${NET_CONNECTION_DIR:-/etc/NetworkManager/system-connections}
  settle=${NET_SETTLE:-0}
fi

result_file=$state_dir/wifi-last
request_file=$run_dir/request
unit=teletraan-wifi-switch
name_prefix='Teletraan Wi-Fi'

say() {
  echo "$*"
}

fail() {
  say "$*" >&2
  exit "${2:-1}"
}

need_nmcli() {
  command -v "$nmcli_bin" > /dev/null 2>&1 && "$systemctl_bin" is-active --quiet NetworkManager.service 2> /dev/null \
    || fail 'This computer does not use NetworkManager, so the page cannot change the Wi-Fi. Change it at the computer.' 3
}

# One plain line: no control characters, and no more than 160 characters
plain() {
  tr -c '[:print:]' '?' | cut -c 1-160
}

# The result file the control page reads. The network name is not secret, the password is never written here.
record() {
  local state=$1 network=$2 previous=$3 reason=$4 stamp
  stamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  mkdir -p "$state_dir"
  {
    printf 'state: %s\n' "$state"
    printf 'network: %s\n' "$(printf '%s' "$network" | plain)"
    printf 'previous: %s\n' "$(printf '%s' "$previous" | plain)"
    printf 'at: %s\n' "$stamp"
    printf 'reason: %s\n' "$(printf '%s' "$reason" | tr -c '[:print:]' '?' | cut -c 1-240)"
  } > "$result_file.new"
  chmod 644 "$result_file.new"
  mv -f "$result_file.new" "$result_file"
}

wifi_device() {
  "$nmcli_bin" -t -f DEVICE,TYPE device 2> /dev/null | awk -F: '$2 == "wifi" { print $1; exit }'
}

active_wifi_uuid() {
  "$nmcli_bin" -t -f UUID,TYPE connection show --active 2> /dev/null | awk -F: '$2 == "802-11-wireless" { print $1; exit }'
}

active_wifi_name() {
  "$nmcli_bin" -t -f IN-USE,SSID device wifi list 2> /dev/null | awk -F: '$1 == "*" { sub(/^\*:/, ""); gsub(/\\:/, ":"); print; exit }'
}

scan() {
  need_nmcli
  "$nmcli_bin" device wifi rescan > /dev/null 2>&1 || true
  [ "$settle" -eq 0 ] || sleep "$settle"
  "$nmcli_bin" -t -f IN-USE,SIGNAL,SECURITY,SSID device wifi list 2> /dev/null | awk '
    {
      line = $0
      gsub(/\\\\/, "\001", line)
      gsub(/\\:/, "\002", line)
      count = split(line, part, ":")
      if (count != 4) next
      name = part[4]
      gsub(/\001/, "\\", name)
      gsub(/\002/, ":", name)
      if (name == "") next
      security = part[3]
      lock = (security == "" || security == "--") ? "no" : "yes"
      # A network that signs in with a user name (802.1X) has no shared password, so it cannot be joined from here
      if (security ~ /802\.1X/) lock = "enterprise"
      signal = part[2] + 0
      if (!(name in best) || signal > best[name]) { best[name] = signal; kind[name] = lock }
      if (part[1] == "*") used[name] = 1
    }
    END {
      for (name in best) printf "%d|%s|%d|%s\n", best[name], kind[name], used[name] + 0, name
    }' | sort -t'|' -k1,1nr | head -n 40 | tr -c '[:print:]\n' '?' | while IFS='|' read -r signal lock inuse name; do
      printf 'network: %s|%s|%s|%s\n' "$signal" "$lock" "$inuse" "$name"
    done
}

# A value for a connection file: backslash doubled, and a space at either end written so the file keeps it
keyfile_value() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/^ /\\s/' -e 's/ $/\\s/'
}

switch() {
  need_nmcli
  local ssid='' password='' host=''
  IFS= read -r ssid || true
  IFS= read -r password || true
  IFS= read -r host || true

  # The name is 1 to 32 bytes of printable text. A semicolon or a backslash would be read as part of the file format.
  [ -n "$ssid" ] && [ "${#ssid}" -le 32 ] || fail 'Type the network name (1 to 32 characters).' 2
  printf '%s' "$ssid" | grep -q '[^[:print:]]' && fail 'That network name has a character this page cannot send.' 2
  case $ssid in *';'*|*'\'*) fail 'A network name with a semicolon or a backslash must be set at the computer.' 2 ;; esac
  # A password is 8 to 63 characters, or 64 hexadecimal digits. An open network has none.
  if [ -n "$password" ]; then
    if [ "${#password}" -lt 8 ] || [ "${#password}" -gt 64 ] || { [ "${#password}" -eq 64 ] && ! printf '%s' "$password" | grep -Eq '^[0-9A-Fa-f]{64}$'; }; then
      fail 'A Wi-Fi password is 8 to 63 characters.' 2
    fi
    printf '%s' "$password" | grep -q '[^[:print:]]' && fail 'That password has a character this page cannot send.' 2
  fi
  printf '%s' "$host" | grep -Eq '^[A-Za-z0-9]([A-Za-z0-9.-]{0,120}[A-Za-z0-9])?$' || host=''

  if "$systemctl_bin" is-active --quiet "$unit.service" 2> /dev/null; then
    fail 'A switch is already running. Wait for it to finish.' 4
  fi

  umask 077
  mkdir -p "$run_dir"
  chmod 700 "$run_dir"
  printf '%s\n%s\n%s\n' "$ssid" "$password" "$host" > "$request_file.new"
  mv -f "$request_file.new" "$request_file"

  record working "$ssid" "$(active_wifi_name)" 'Joining the network.'
  "$systemd_run_bin" --quiet --collect --unit="$unit" "$self" run-switch || {
    rm -f "$request_file"
    record failed "$ssid" '' 'The computer could not start the switch.'
    fail 'The computer could not start the switch.' 5
  }
  say 'The switch has started.'
}

run_switch() {
  need_nmcli
  [ -f "$request_file" ] || fail 'There is no switch waiting.' 2
  local ssid='' password='' host=''
  {
    IFS= read -r ssid || true
    IFS= read -r password || true
    IFS= read -r host || true
  } < "$request_file"
  # The password now lives only in this shell
  rm -f "$request_file"

  local device previous previous_name uuid file shortid
  device=$(wifi_device)
  printf '%s' "$device" | grep -Eq '^[a-z][a-z0-9]{0,14}$' || { record failed "$ssid" '' 'No Wi-Fi adapter was found.'; exit 1; }
  previous=$(active_wifi_uuid || true)
  previous_name=$(active_wifi_name || true)

  uuid=$(cat /proc/sys/kernel/random/uuid 2> /dev/null || printf '%s' "$RANDOM$RANDOM-0000-4000-8000-$(date +%s)000000" | cut -c 1-36)
  shortid=$(printf '%s' "$uuid" | cut -c 1-8)
  file=$connection_dir/teletraan-wifi-$shortid.nmconnection
  mkdir -p "$connection_dir"
  (
    umask 077
    {
      printf '[connection]\nid=%s %s\nuuid=%s\ntype=wifi\ninterface-name=%s\nautoconnect=true\nautoconnect-priority=50\n\n' "$name_prefix" "$shortid" "$uuid" "$device"
      printf '[wifi]\nssid=%s\nmode=infrastructure\npowersave=2\n\n' "$(keyfile_value "$ssid")"
      if [ -n "$password" ]; then
        printf '[wifi-security]\nkey-mgmt=wpa-psk\npsk=%s\n\n' "$(keyfile_value "$password")"
      fi
      printf '[ipv4]\nmethod=auto\n\n[ipv6]\nmethod=auto\n'
    } > "$file"
  )
  password=''
  chmod 600 "$file"

  record working "$ssid" "$previous_name" 'Joining the network.'
  local reason='' joined=0
  if "$nmcli_bin" connection load "$file" > /dev/null 2>&1 && "$nmcli_bin" --wait 45 connection up uuid "$uuid" > /dev/null 2>&1; then
    # Joined. It counts only when the internet answers, because a network that gives an address and no way out is worse than none.
    local waited=0
    while [ "$waited" -lt 6 ]; do
      if [ -z "$host" ] || "$curl_bin" -s -o /dev/null --max-time 6 -I "https://$host" 2> /dev/null; then
        joined=1
        break
      fi
      waited=$((waited + 1))
      [ "$settle" -eq 0 ] || sleep 3
    done
    [ "$joined" -eq 1 ] || reason='Joined the network, but the internet could not be reached from it.'
  else
    reason='The network did not accept the connection. Check the name and the password.'
  fi

  if [ "$joined" -eq 1 ]; then
    # Only now are older connections made by this page removed; the one the computer had before stays as a way back
    "$nmcli_bin" -t -f UUID,NAME connection show 2> /dev/null | awk -F: -v keep="$uuid" -v prefix="$name_prefix" '$1 != keep && index($2, prefix) == 1 { print $1 }' | while IFS= read -r old; do
      "$nmcli_bin" connection delete uuid "$old" > /dev/null 2>&1 || true
    done
    record done "$ssid" "$previous_name" "Connected to $ssid and the internet answers."
    exit 0
  fi

  "$nmcli_bin" connection delete uuid "$uuid" > /dev/null 2>&1 || true
  rm -f "$file"
  if [ -n "$previous" ] && "$nmcli_bin" --wait 45 connection up uuid "$previous" > /dev/null 2>&1; then
    record reverted "$ssid" "$previous_name" "$reason The computer went back to $previous_name."
  else
    record failed "$ssid" "$previous_name" "$reason The computer could not go back by itself. Check it at the computer."
  fi
  exit 1
}

restart() {
  if command -v "$nmcli_bin" > /dev/null 2>&1 && "$systemctl_bin" is-active --quiet NetworkManager.service 2> /dev/null; then
    "$systemctl_bin" restart NetworkManager.service
  elif "$systemctl_bin" is-active --quiet systemd-networkd.service 2> /dev/null; then
    "$systemctl_bin" restart systemd-networkd.service
  elif "$systemctl_bin" is-active --quiet networking.service 2> /dev/null; then
    "$systemctl_bin" restart networking.service
  else
    fail 'No network service this computer knows is running, so nothing was restarted.' 3
  fi
  say 'The network service restarted. The connection may take a minute to come back.'
}

dns() {
  need_nmcli
  local uuid
  uuid=$("$nmcli_bin" -t -f UUID,TYPE connection show --active 2> /dev/null | awk -F: '$2 == "802-11-wireless" || $2 == "802-3-ethernet" { print $1; exit }')
  printf '%s' "$uuid" | grep -Eq '^[0-9a-f-]{36}$' || fail 'There is no active connection to change.' 3
  if [ "$1" = public ]; then
    "$nmcli_bin" connection modify uuid "$uuid" ipv4.dns '1.1.1.1 8.8.8.8' ipv4.ignore-auto-dns yes
  else
    "$nmcli_bin" connection modify uuid "$uuid" ipv4.dns '' ipv4.ignore-auto-dns no
  fi
  "$nmcli_bin" --wait 30 connection up uuid "$uuid" > /dev/null
  say "The name servers are $([ "$1" = public ] && echo 'public' || echo 'the ones the network hands out')."
}

case ${1:-} in
  scan) [ "$#" -eq 1 ] || fail 'scan takes no argument.' 2; scan ;;
  switch) [ "$#" -eq 1 ] || fail 'switch takes no argument.' 2; switch ;;
  run-switch) [ "$#" -eq 1 ] || fail 'run-switch takes no argument.' 2; run_switch ;;
  restart) [ "$#" -eq 1 ] || fail 'restart takes no argument.' 2; restart ;;
  dns-public) [ "$#" -eq 1 ] || fail 'dns-public takes no argument.' 2; dns public ;;
  dns-default) [ "$#" -eq 1 ] || fail 'dns-default takes no argument.' 2; dns default ;;
  *) fail 'Give one word: scan, switch, restart, dns-public or dns-default.' 2 ;;
esac
