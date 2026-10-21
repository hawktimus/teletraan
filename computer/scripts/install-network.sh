#!/bin/bash
# Usage: sudo install-network.sh [--undo]
# Installs the network watchdog and the settings that stop a wall display from losing its network when it sits idle
# (docs/network.md has the reasons and how to undo each one):
#   1. teletraan-network.service and .timer, which run network-watchdog.sh every 2 minutes as the login user
#   2. /etc/sudoers.d/teletraan-network: the commands that name an interface, for each Ethernet and Wi-Fi device that
#      NetworkManager manages (never docker, tailscale, bridge or veth devices), checked with visudo
#   3. Wi-Fi power saving off: a NetworkManager drop-in, the active Wi-Fi connections, and iw when it is installed
#   4. energy-efficient Ethernet off and USB autosuspend off for the network adapter, as udev rules
#   5. suspend, hibernate and hybrid sleep masked, and logind told to ignore idle and the lid
#   6. NetworkManager told never to give up on a connection (it stops after 4 tries by default)
# Every change is written only when it differs, so running this again changes nothing. --undo takes 3 to 6 away again
# and leaves the timer and the sudoers file alone. It installs no packages.
#
# Tests set NETWORK_ROOT (a folder that stands for /), and fake id, systemctl, nmcli, iw, ethtool, udevadm and visudo.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

units="$computer/systemd"
repo=$(cd "$computer/.." && pwd -P)
root=${NETWORK_ROOT:-}
target=$root/etc/systemd/system
sudoers_dir=$root/etc/sudoers.d
expected_repo=$root/opt/teletraan
nm_file=$root/etc/NetworkManager/conf.d/70-teletraan-network.conf
udev_file=$root/etc/udev/rules.d/70-teletraan-network.rules
logind_file=$root/etc/systemd/logind.conf.d/70-teletraan-no-sleep.conf
sys_net=$root/sys/class/net
sleep_targets=(sleep.target suspend.target hibernate.target hybrid-sleep.target suspend-then-hibernate.target)

undo=no
case "${1:-}" in
  '') ;;
  --undo) undo=yes ;;
  *) echo "Usage: sudo $0 [--undo]" >&2; exit 2 ;;
esac

say() {
  echo "network install: $*"
}

if [ "$(id -u)" -ne 0 ]; then
  echo "This changes the system, so it has to run with sudo:" >&2
  echo "  sudo $0${1:+ $1}" >&2
  exit 1
fi

# Writes a file only when its text is different. Says what it did.
put_file() {
  local file=$1 text=$2 mode=${3:-644}
  if [ -f "$file" ] && [ "$(cat "$file")" = "$text" ]; then
    say "$file is already as it should be."
    return 0
  fi
  mkdir -p "$(dirname "$file")"
  printf '%s\n' "$text" > "$file"
  chmod "$mode" "$file"
  say "wrote $file."
}

remove_file() {
  if [ -f "$1" ]; then
    rm -f "$1"
    say "removed $1."
  fi
}

# The Ethernet and Wi-Fi devices NetworkManager manages, or, without NetworkManager, the physical en, eth and wl names
find_interfaces() {
  local names='' line
  if command -v nmcli > /dev/null 2>&1; then
    # An unplugged port is "unavailable" and still managed. Docker, bridge and veth devices are unmanaged or other types.
    names=$(nmcli -t -f DEVICE,TYPE,STATE device 2> /dev/null | awk -F: '($2 == "ethernet" || $2 == "wifi") && $3 != "unmanaged" { print $1 }' || true)
  fi
  if [ -z "$names" ]; then
    names=$(ls "$sys_net" 2> /dev/null | grep -E '^(en|eth|wl)[a-z0-9]*$' || true)
  fi
  line=$(ip route show default 2> /dev/null | awk '/^default/ { for (i = 1; i < NF; i++) if ($i == "dev") { print $(i + 1); exit } }' || true)
  printf '%s\n%s\n' "$names" "$line" | grep -E '^(en|eth|wl)[a-z0-9]{0,12}$' | sort -u || true
}

# ----- undo -----
if [ "$undo" = yes ]; then
  remove_file "$nm_file"
  remove_file "$udev_file"
  remove_file "$logind_file"
  for name in "${sleep_targets[@]}"; do
    if [ "$(systemctl is-enabled "$name" 2> /dev/null || true)" = masked ]; then
      systemctl unmask "$name" > /dev/null 2>&1 && say "unmasked $name."
    fi
  done
  if command -v nmcli > /dev/null 2>&1; then
    nmcli general reload conf > /dev/null 2>&1 || true
    for uuid in $(nmcli -t -f UUID,TYPE connection show --active 2> /dev/null | awk -F: '$2 == "802-11-wireless" { print $1 }' || true); do
      nmcli connection modify uuid "$uuid" 802-11-wireless.powersave 0 > /dev/null 2>&1 && say "Wi-Fi power saving is back to the default for connection $uuid."
    done
  fi
  command -v udevadm > /dev/null 2>&1 && udevadm control --reload > /dev/null 2>&1 || true
  say "undone. The timer and the sudoers file stay. Reboot to be sure every setting is the default."
  exit 0
fi

# ----- the timer and the sudoers file: checks first, nothing is changed until they pass -----
for unit in teletraan-network.service teletraan-network.timer; do
  if [ ! -s "$units/$unit" ]; then
    echo "The unit file $units/$unit is missing or empty. Pull the newest files first." >&2
    exit 1
  fi
done
for file in "$computer/scripts/network-watchdog.sh" "$computer/sudoers/teletraan-network"; do
  if [ ! -s "$file" ]; then
    echo "$file is missing. Pull the newest files first." >&2
    exit 1
  fi
done
if [ ! -x "$computer/scripts/network-watchdog.sh" ]; then
  echo "$computer/scripts/network-watchdog.sh cannot be run." >&2
  exit 1
fi

missing=""
command -v curl > /dev/null 2>&1 || missing="$missing curl"
command -v ip > /dev/null 2>&1 || missing="$missing iproute2"
command -v flock > /dev/null 2>&1 || missing="$missing util-linux"
command -v awk > /dev/null 2>&1 || missing="$missing gawk"
if [ -n "$missing" ]; then
  echo "These packages are not installed:$missing" >&2
  echo "Ask the team mentor, install them, and run this again:" >&2
  echo "  sudo apt install curl iproute2 util-linux gawk" >&2
  exit 1
fi

if [ "$repo" != "$expected_repo" ]; then
  echo "The unit files expect the repository at $expected_repo, but it is at $repo." >&2
  echo "Move it there, or change the paths in the files in $units first." >&2
  exit 1
fi

account=$(stat -c %U "$repo")
if [ "$account" = root ] || [ "$account" = UNKNOWN ] || ! id "$account" > /dev/null 2>&1; then
  echo "The repository at $repo is owned by $account, and the timer should not run as that." >&2
  echo "Give it to the account the Teletraan computer logs in with. If that account is called hawktimus:" >&2
  echo "  sudo chown -R hawktimus:hawktimus $repo" >&2
  exit 1
fi

if ! grep -qs 'restart NetworkManager.service' "$sudoers_dir/teletraan-control"; then
  echo "Note: $sudoers_dir/teletraan-control does not allow the network restarts yet. Run computer/install.sh again, or the" >&2
  echo "network watchdog will log that sudo refused them." >&2
fi

interfaces=$(find_interfaces)
if [ -z "$interfaces" ]; then
  echo "No Ethernet or Wi-Fi device was found (nmcli device, ls /sys/class/net), so the sudo rules for the repairs cannot be written." >&2
  echo "Connect the computer to the network and run this again." >&2
  exit 1
fi

echo "This will:"
echo "  1. copy teletraan-network.service and .timer to $target, set to run as the account $account, and turn the timer on"
echo "  2. allow the repairs for these devices in $sudoers_dir/teletraan-network:" $interfaces
echo "  3. turn Wi-Fi power saving off, energy-efficient Ethernet off and USB autosuspend off for the network adapter"
echo "  4. mask suspend, hibernate and hybrid sleep, and tell logind to ignore idle and the lid"
echo "  5. tell NetworkManager never to give up on a connection"
echo "Each change is described in docs/network.md, with how to undo it (sudo $0 --undo)."
echo
printf 'Press Enter to go ahead, or Ctrl+C to stop. '
read -r answer

# 1. The units
tmp=$(mktemp)
mkdir -p "$target"
for unit in teletraan-network.service teletraan-network.timer; do
  sed "s/^User=ACCOUNT\$/User=$account/" "$units/$unit" > "$tmp"
  if [ ! -s "$tmp" ]; then
    echo "The copy of $unit came out empty, so nothing was installed." >&2
    rm -f "$tmp"
    exit 1
  fi
  install -m 644 "$tmp" "$target/$unit"
done
if ! grep -q "^User=$account\$" "$target/teletraan-network.service"; then
  echo "The account name was not filled in. Check the User= line in $units." >&2
  rm -f "$tmp"
  exit 1
fi

# 2. The sudo rules that name an interface: the block of the template once for each device
mkdir -p "$sudoers_dir"
block=$(sed -n '/^# --- block ---$/,/^# --- end ---$/p' "$computer/sudoers/teletraan-network" | sed '1d;$d')
{
  sed -n '/^# --- block ---$/q;p' "$computer/sudoers/teletraan-network"
  for name in $interfaces; do
    printf '%s\n' "$block" | sed "s/IFACE/$name/g; s/ACCOUNT/$account/g"
  done
} > "$tmp"
if command -v visudo > /dev/null 2>&1 && ! visudo -cf "$tmp" > /dev/null; then
  rm -f "$tmp"
  echo "The sudoers file did not pass visudo, so it was not installed." >&2
  exit 1
fi
if [ -f "$sudoers_dir/teletraan-network" ] && cmp -s "$tmp" "$sudoers_dir/teletraan-network"; then
  say "the sudo rules are already as they should be."
else
  install -m 440 "$tmp" "$sudoers_dir/teletraan-network"
  say "wrote the sudo rules for: $(echo $interfaces)."
fi
rm -f "$tmp"

# The data folder of the watchdog is made by the script itself, as the login user
systemctl daemon-reload
systemctl enable --now teletraan-network.timer
systemctl restart teletraan-network.timer

# 3 and 6. NetworkManager: Wi-Fi power saving off, and never give up on a connection. The DHCP client has no keepalive;
# the nearest thing is a client that never stops asking (a 45 second wait and 4 tries is the default).
if command -v nmcli > /dev/null 2>&1; then
  put_file "$nm_file" "# Written by computer/scripts/install-network.sh. Undo: sudo computer/scripts/install-network.sh --undo
[connection]
wifi.powersave = 2
connection.autoconnect-retries = 0
ipv4.dhcp-timeout = 2147483647"
  nmcli general reload conf > /dev/null 2>&1 || true
  # The drop-in is read by connections made from now on. The ones in use are changed as well.
  for uuid in $(nmcli -t -f UUID,TYPE connection show --active 2> /dev/null | awk -F: '$2 == "802-11-wireless" { print $1 }' || true); do
    current=$(nmcli -g 802-11-wireless.powersave connection show uuid "$uuid" 2> /dev/null || true)
    if [ "$current" = 2 ] || [ "$current" = "2 (disable)" ]; then
      say "Wi-Fi power saving is already off for connection $uuid."
    elif nmcli connection modify uuid "$uuid" 802-11-wireless.powersave 2 > /dev/null 2>&1; then
      say "Wi-Fi power saving is off for connection $uuid."
      for name in $interfaces; do
        case $name in wl*) nmcli device reapply "$name" > /dev/null 2>&1 || true ;; esac
      done
    else
      say "could not change connection $uuid." >&2
    fi
  done
else
  say "NetworkManager (nmcli) is not here, so its settings are skipped. See docs/network.md for the other managers."
fi

# 3 and 4. udev rules: they hold at every start, and the same commands are run now
rules=''
iw_bin=$(command -v iw 2> /dev/null || true)
ethtool_bin=$(command -v ethtool 2> /dev/null || true)
if [ -z "$iw_bin" ]; then
  say "iw is not installed. NetworkManager turns Wi-Fi power saving off instead. (sudo apt install iw adds the second way.)"
fi
for name in $interfaces; do
  case $name in
    wl*)
      if [ -n "$iw_bin" ]; then
        rules="$rules"$'\n'"ACTION==\"add\", SUBSYSTEM==\"net\", KERNEL==\"$name\", RUN+=\"$iw_bin dev $name set power_save off\""
        "$iw_bin" dev "$name" set power_save off > /dev/null 2>&1 && say "Wi-Fi power saving is off now on $name (iw)." || say "iw could not change $name now." >&2
      fi
      ;;
    en*|eth*)
      if [ -n "$ethtool_bin" ]; then
        if "$ethtool_bin" --show-eee "$name" 2> /dev/null | grep -Eiq 'EEE status: enabled|EEE enabled: yes'; then
          rules="$rules"$'\n'"ACTION==\"add\", SUBSYSTEM==\"net\", KERNEL==\"$name\", RUN+=\"$ethtool_bin --set-eee $name eee off\""
          "$ethtool_bin" --set-eee "$name" eee off > /dev/null 2>&1 && say "energy-efficient Ethernet is off now on $name." || say "ethtool could not change $name now." >&2
        else
          say "$name does not report energy-efficient Ethernet as on, so it is left alone."
        fi
      else
        say "ethtool is not installed, so energy-efficient Ethernet is not checked. (sudo apt install ethtool)"
      fi
      ;;
  esac
  # A USB adapter sleeps on its own after a few seconds of quiet. The device above the interface that has a vendor id is it.
  path=$(readlink -f "$sys_net/$name/device" 2> /dev/null || true)
  case $path in
    */usb*)
      while [ -n "$path" ] && [ "$path" != / ] && [ ! -f "$path/idVendor" ]; do path=$(dirname "$path"); done
      if [ -f "$path/idVendor" ] && [ -f "$path/idProduct" ]; then
        vendor=$(cat "$path/idVendor")
        product=$(cat "$path/idProduct")
        rules="$rules"$'\n'"ACTION==\"add\", SUBSYSTEM==\"usb\", ATTR{idVendor}==\"$vendor\", ATTR{idProduct}==\"$product\", TEST==\"power/control\", ATTR{power/control}=\"on\""
        [ ! -f "$path/power/control" ] || { echo on > "$path/power/control" 2> /dev/null && say "USB autosuspend is off now for the adapter of $name ($vendor:$product)."; } || true
      fi
      ;;
  esac
done
if [ -n "$rules" ]; then
  put_file "$udev_file" "# Written by computer/scripts/install-network.sh. Undo: sudo computer/scripts/install-network.sh --undo$rules"
else
  remove_file "$udev_file"
fi
command -v udevadm > /dev/null 2>&1 && udevadm control --reload > /dev/null 2>&1 || true

# 5. The computer never sleeps
for name in "${sleep_targets[@]}"; do
  if [ "$(systemctl is-enabled "$name" 2> /dev/null || true)" = masked ]; then
    say "$name is already masked."
  elif systemctl mask "$name" > /dev/null 2>&1; then
    say "masked $name."
  else
    say "could not mask $name." >&2
  fi
done
put_file "$logind_file" "# Written by computer/scripts/install-network.sh. Undo: sudo computer/scripts/install-network.sh --undo
[Login]
IdleAction=ignore
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
HandleSuspendKey=ignore
HandleHibernateKey=ignore"
# A hang-up makes logind read its settings again without ending the session of the screen
systemctl kill -s HUP systemd-logind.service > /dev/null 2>&1 || true

rm -f "$tmp" 2> /dev/null || true
systemctl list-timers 'teletraan-network*' || true
say "done."
