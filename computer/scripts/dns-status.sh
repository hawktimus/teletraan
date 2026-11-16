#!/bin/bash
# Usage: dns-status.sh   (make dns-status)
# The name servers the computer is told to use, the ones it uses now, and whether the two agree. It reads and prints; it
# changes nothing and uses no sudo. The configured ones are in /usr/local/etc/teletraan-network.conf (computer/config/network.conf
# is the copy the installer starts from); what netwatch.sh chose is in /var/lib/teletraan/dns.json.
#
#   state: as configured                              the configured servers are the ones in use
#   state: temporarily on the network's own           netwatch switched because the configured ones stopped answering
#   state: not as configured                          something else changed them (DNS_ENFORCE=yes, run teletraan-net dns-apply)
set -euo pipefail
. "$(dirname "$0")/lib.sh"

conf=${TELETRAAN_NETWORK_CONF:-/usr/local/etc/teletraan-network.conf}
state_file=${NETWATCH_DNS_STATE:-/var/lib/teletraan/dns.json}
nmcli_bin=${TELETRAAN_NMCLI:-nmcli}

item() {
  [ -f "$conf" ] || return 0
  sed -n "s/^$1=//p" "$conf" | tail -n 1 | sed "s/^['\"]//; s/['\"]\$//"
}

first=$(item DNS_PRIMARY | grep -E '^([0-9]{1,3}\.){3}[0-9]{1,3}$' || true)
second=$(item DNS_SECONDARY | grep -E '^([0-9]{1,3}\.){3}[0-9]{1,3}$' || true)
first=${first:-8.8.8.8}
second=${second:-8.8.4.4}
enforce=yes
[ "$(item DNS_ENFORCE)" != no ] || enforce=no

# The servers in use: NetworkManager's answer for the active device, else the resolver file
active=''
if command -v "$nmcli_bin" > /dev/null 2>&1; then
  active=$("$nmcli_bin" -g IP4.DNS device show 2> /dev/null | tr '\n|' '  ' | xargs 2> /dev/null || true)
fi
if [ -z "$active" ] && [ -r /etc/resolv.conf ]; then
  active=$(awk '$1 == "nameserver" { printf "%s ", $2 }' /etc/resolv.conf | xargs 2> /dev/null || true)
fi

mode=$(sed -n 's/.*"mode":"\([a-z]*\)".*/\1/p' "$state_file" 2> /dev/null | head -n 1 || true)
mode=${mode:-configured}

if [ "$enforce" = no ]; then
  state='not enforced (DNS_ENFORCE=no)'
elif [ "$mode" = network ]; then
  state="temporarily on the network's own"
elif printf ' %s ' "$active" | grep -q " $first " && printf ' %s ' "$active" | grep -q " $second "; then
  state='as configured'
else
  state='not as configured'
fi

printf 'configured: %s %s\n' "$first" "$second"
printf 'enforce: %s\n' "$enforce"
printf 'active: %s\n' "${active:-not known}"
printf 'mode: %s\n' "$mode"
printf 'state: %s\n' "$state"
