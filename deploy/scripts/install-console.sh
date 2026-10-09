#!/bin/sh
# Installs the boot and shutdown screens. The login prompt on the Mini's text
# screen prints /etc/issue before it asks for a name, so this puts the startup
# drawing there. It also copies teletraan-console.service and turns it on: when
# the Mini shuts down or reboots, that unit shows the shutdown drawing on the
# TV. It installs no packages and leaves the timers and the kiosk alone.
set -eu

deploy=$(cd "$(dirname "$0")/.." && pwd)
console="$deploy/console"
units="$deploy/systemd"
repo=$(cd "$deploy/.." && pwd -P)
unit=teletraan-console.service

# Empty on the Mini. The test sets it to a temporary folder, so the script can
# run there without touching the computer.
root=${CONSOLE_ROOT:-}
target=$root/etc/systemd/system
issue=$root/etc/issue
saved=$root/etc/issue.before-teletraan

# The unit file names the repository location directly
expected_repo=$root/opt/teletraan

# 70 spaces in front of each line put the 100 columns of the drawing in the
# middle of the 240 columns of a 1920 pixel wide screen. The unit file uses the
# same number.
margin=70

# These checks only read, so they come first and nothing is changed until they
# pass. An empty file would be installed as an empty file, so it counts as
# missing.
for file in "$console/startup.txt" "$console/shutdown.txt" "$units/$unit"; do
  if [ ! -s "$file" ]; then
    echo "The file $file is missing or empty. Pull the newest files first." >&2
    exit 1
  fi
done

# The login prompt reads a backslash in /etc/issue as a code, such as \n for
# the name of the Mini, so a drawing with one would come out wrong
if grep -qF -- '\' "$console/startup.txt"; then
  echo "The file $console/startup.txt has a backslash in it. Use another character." >&2
  exit 1
fi

# The first run keeps a copy of the text that was in /etc/issue, and every
# later run builds the file again from that copy
if [ ! -e "$saved" ]; then
  if [ ! -s "$issue" ]; then
    echo "$issue is missing or empty, so there is no text to keep a copy of." >&2
    echo "Restore the text of $issue first, then run this again." >&2
    exit 1
  fi
  # The last line of the drawing is the words "starting up" with the spaces
  # that centre them. Finding it in the file means an earlier run already
  # replaced the text and the copy was lost.
  if grep -qF -- "$(tail -n 1 "$console/startup.txt")" "$issue"; then
    echo "$issue already shows the drawing, but there is no copy of the original text." >&2
    echo "Put the original text back in $issue first, then run this again." >&2
    exit 1
  fi
  original=$issue
else
  original=$saved
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "This changes the system, so it has to run with sudo:" >&2
  echo "  sudo $0" >&2
  exit 1
fi

if [ "$repo" != "$expected_repo" ]; then
  echo "The unit file expects the repository at $expected_repo, but it is at $repo." >&2
  echo "Move it there, or change the path in $units/$unit first." >&2
  exit 1
fi

echo "This will:"
echo "  1. keep a copy of the text in $issue as $saved,"
echo "     unless that copy is already there"
echo "  2. write $issue again: the drawing from console/startup.txt,"
echo "     then the saved text, so the login prompt still works"
echo "  3. copy $unit to $target, reload systemd and turn"
echo "     it on. When the Mini stops, it shows console/shutdown.txt on the TV"
echo "It leaves the timers and the kiosk alone."
echo
printf 'Press Enter to go ahead, or Ctrl+C to stop. '
read -r answer

# The new text is made and checked before anything is written
art=$(mktemp)
new=$(mktemp)
trap 'rm -f "$art" "$new"' EXIT
pr -t -o "$margin" "$console/startup.txt" > "$art"
if [ ! -s "$art" ]; then
  echo "The drawing came out empty, so nothing was changed." >&2
  exit 1
fi
cat "$art" > "$new"
echo >> "$new"
cat "$original" >> "$new"

if [ ! -e "$saved" ]; then
  cp -p "$issue" "$saved"
  echo "Saved a copy of the text in $issue as $saved."
else
  echo "Kept the copy in $saved."
fi

if [ -f "$issue" ] && cmp -s "$new" "$issue"; then
  echo "$issue already shows the drawing."
else
  install -m 644 "$new" "$issue"
  echo "Wrote $issue: the drawing above the original text."
fi

if [ -f "$target/$unit" ] && cmp -s "$units/$unit" "$target/$unit"; then
  echo "$unit is already in $target."
else
  mkdir -p "$target"
  install -m 644 "$units/$unit" "$target/$unit"
  echo "Copied $unit to $target."
fi

# Never restart this unit. Stopping it prints the shutdown drawing and
# switches the TV to the text screen, and enable --now leaves a running unit
# alone.
systemctl daemon-reload
systemctl enable --now "$unit"
echo "$unit is turned on."
echo
echo "Done. The drawing shows on the next start, and the shutdown drawing at the"
echo "next shutdown or reboot."
