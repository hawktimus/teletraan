#!/bin/bash
# Usage: network-info.sh [--summary]   (run by the helper words network-info and status, as the login user)
# What the network of the Teletraan computer looks like right now, in plain label: value lines, for the control page.
# It only reads. The one command that uses sudo is the journal, with the fixed arguments that
# computer/sudoers/teletraan-control allows, because the login user is not in the systemd-journal group.
# Nothing secret is printed: the Wi-Fi configuration is never read, and the journal lines pass through the same
# cleaning as the control page's log (a password, a key or a long token becomes REDACTED).
# --summary prints only the lines of the network watchdog's status.json, for the status word.
# Tests set NETWORK_SYS (instead of /sys/class/net) and TELETRAAN_DATA through local.env.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
folder="$data/network"
sys=${NETWORK_SYS:-/sys/class/net}

# One value of status.json
status_value() {
  sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p" "$folder/status.json" 2> /dev/null | head -n 1 || true
}

summary() {
  if [ ! -s "$folder/status.json" ]; then
    echo "networkState: not known"
    return 0
  fi
  if [ -n "$(status_value networkDownSince)" ]; then echo "networkState: down"; else echo "networkState: ok"; fi
  echo "networkLastOkAt: $(status_value networkLastOkAt)"
  echo "networkDownSince: $(status_value networkDownSince)"
  echo "networkLastProblemAt: $(status_value networkLastProblemAt)"
  echo "networkLastStep: $(status_value networkLastStep)"
  echo "networkRecoveries: $(sed -n 's/.*"networkRecoveries":\([0-9]*\).*/\1/p' "$folder/status.json" 2> /dev/null | head -n 1 || true)"
}

if [ "${1:-}" = --summary ]; then
  summary
  exit 0
fi

# Takes passwords, keys and long tokens out of a line
clean() {
  sed -E 's/((psk|passphrase|password|pass|key|secret|token|sae|wep-key[0-9]?)[A-Za-z0-9_-]*[=: ]+)[^ ]+/\1REDACTED/Ig; s/[A-Fa-f0-9]{32,}/REDACTED/g; s/[A-Za-z0-9+\/=_-]{40,}/REDACTED/g' | tr -c '[:print:]\n' '?' | cut -c 1-200
}

interface=$(ip route show default 2> /dev/null | awk '/^default/ { for (i = 1; i < NF; i++) if ($i == "dev") { print $(i + 1); exit } }' || true)
if ! printf '%s' "$interface" | grep -Eq '^[a-z][a-z0-9]{0,14}$'; then
  interface=$(ls "$sys" 2> /dev/null | grep -E '^(en|eth|wl)[a-z0-9]*$' | head -n 1 || true)
fi

echo "interface: ${interface:-none found}"
if [ -z "$interface" ]; then
  echo "type: not known"
  echo "link: there is no default route and no Ethernet or Wi-Fi device"
else
  if [ -d "$sys/$interface/wireless" ] || [ -d "$sys/$interface/phy80211" ]; then kind=Wi-Fi; else kind=Ethernet; fi
  echo "type: $kind"
  echo "link: $(cat "$sys/$interface/operstate" 2> /dev/null || echo not known), carrier $(cat "$sys/$interface/carrier" 2> /dev/null || echo not known)"

  if [ "$kind" = Wi-Fi ]; then
    signal=''
    if command -v iw > /dev/null 2>&1; then
      signal=$(iw dev "$interface" link 2> /dev/null | sed -n 's/^[[:space:]]*signal: //p' | head -n 1 || true)
    fi
    if [ -z "$signal" ] && command -v nmcli > /dev/null 2>&1; then
      percent=$(nmcli -t -f IN-USE,SIGNAL device wifi list ifname "$interface" 2> /dev/null | sed -n 's/^\*://p' | head -n 1 || true)
      [ -z "$percent" ] || signal="$percent percent"
    fi
    if [ -z "$signal" ]; then
      signal=$(awk -v name="$interface:" '$1 == name { print $4 " (link quality " $3 ")" }' /proc/net/wireless 2> /dev/null | head -n 1 || true)
    fi
    echo "signal: ${signal:-not known}"
  fi
fi

echo "ip: $(ip -4 -o addr show dev "${interface:-lo}" 2> /dev/null | awk '{ print $4 }' | paste -sd' ' - || true)"
echo "gateway: $(ip route show default 2> /dev/null | awk '/^default/ { for (i = 1; i < NF; i++) if ($i == "via") { print $(i + 1); exit } }' || true)"

dns=''
if [ -n "$interface" ] && command -v nmcli > /dev/null 2>&1; then
  dns=$(nmcli -g IP4.DNS device show "$interface" 2> /dev/null | tr '\n|' '  ' || true)
fi
if [ -z "$dns" ] && command -v resolvectl > /dev/null 2>&1; then
  dns=$(resolvectl dns 2> /dev/null | sed 's/^[^:]*: *//' | tr '\n' ' ' || true)
fi
if [ -z "$dns" ]; then
  dns=$(awk '$1 == "nameserver" { print $2 }' /etc/resolv.conf 2> /dev/null | tr '\n' ' ' || true)
fi
echo "dns: ${dns:-not known}"

# Power saving: what the settings say, with the reason when it cannot be read
if [ "${kind:-}" = Wi-Fi ]; then
  if command -v iw > /dev/null 2>&1; then
    echo "powerSave: $(iw dev "$interface" get power_save 2> /dev/null | sed 's/^Power save: //' | head -n 1 || true)"
  else
    echo "powerSave: iw is not installed, so the adapter's own state cannot be read (sudo apt install iw)"
  fi
  if command -v nmcli > /dev/null 2>&1; then
    connection=$(nmcli -t -f UUID,TYPE connection show --active 2> /dev/null | awk -F: '$2 == "802-11-wireless" { print $1; exit }' || true)
    if [ -n "$connection" ]; then
      echo "powerSaveSetting: $(nmcli -g 802-11-wireless.powersave connection show uuid "$connection" 2> /dev/null | head -n 1 || true) (2 means off, 0 is the default)"
    fi
  fi
elif [ "${kind:-}" = Ethernet ]; then
  if command -v ethtool > /dev/null 2>&1; then
    echo "powerSave: $(ethtool --show-eee "$interface" 2> /dev/null | grep -i 'EEE status' | head -n 1 | sed 's/^[[:space:]]*//' || true)"
  else
    echo "powerSave: ethtool is not installed, so energy-efficient Ethernet cannot be read"
  fi
fi
for name in sleep suspend hibernate; do
  printf 'sleepTarget: %s %s\n' "$name" "$(systemctl is-enabled "$name.target" 2> /dev/null || echo 'not known')"
done
for file in /etc/NetworkManager/conf.d/70-teletraan-network.conf /etc/udev/rules.d/70-teletraan-network.rules /etc/systemd/logind.conf.d/70-teletraan-no-sleep.conf; do
  if [ -f "$file" ]; then echo "installed: $file"; else echo "missing: $file (run install-network.sh)"; fi
done

# The last 5 lines of the journal that tell of the link going away or coming back
journal=$(sudo -n /usr/bin/journalctl -u NetworkManager.service -u wpa_supplicant.service -u systemd-networkd.service --no-pager -n 60 -o short-iso 2> /dev/null || true)
if [ -z "$journal" ]; then
  echo "journal: could not be read (the sudo rule for journalctl is missing: run computer/install.sh again)"
else
  printf '%s\n' "$journal" | grep -Ei 'disconnect|deauth|carrier|link (is )?(down|up)|dhcp|state change|lost|timeout|fail|connected|activated|beacon|roam' | tail -n 5 | clean | sed 's/^/journal: /' || true
fi

echo "---- watchdog ----"
if [ -f "$folder/state" ]; then
  grep -E '^(manager|interface|sanity|gateway|dns|fails|step|lastStep)=' "$folder/state" | sed 's/^/state: /'
  for name in checkedAt downSince lastOkAt lastProblemAt; do
    value=$(sed -n "s/^$name=//p" "$folder/state" | tail -n 1)
    case $value in ''|0|*[!0-9]*) echo "state: $name=never" ;; *) echo "state: $name=$(date -u -d "@$value" '+%Y-%m-%dT%H:%M:%SZ' 2> /dev/null || echo "$value")" ;; esac
  done
  tail -n 5 "$folder/history" 2> /dev/null | sed 's/^/history: /' || true
else
  echo "state: the network watchdog has not run yet"
fi
