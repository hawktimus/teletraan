#!/bin/bash
# Usage: pull.sh
# Brings the repository up to date. A pull is a deploy: the web server shows
# the files in the repository as they are. When something new arrives, the
# commit is written to <data folder>/version.txt, and a dashboard that is
# open sees it change within a minute and reloads itself.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

# Fail with a message instead of waiting for a password nobody can type
GIT_TERMINAL_PROMPT=0
export GIT_TERMINAL_PROMPT

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}

if [ ! -d "$data" ]; then
  echo "The data folder $data does not exist. See docs/rebuilding-the-computer.md." >&2
  exit 1
fi

# version.txt must be readable by the web server inside the container
umask 022

cd "$repo"
before=$(git rev-parse HEAD)

# A power cut in the middle of a checkout leaves this file behind, and every
# pull after it would fail with a message that does not say what to do
if [ -f "$repo/.git/index.lock" ]; then
  echo "A git lock file is in the way: $repo/.git/index.lock. If no git command is running, remove it. See Recovering in docs/rebuilding-the-computer.md." >&2
  exit 1
fi

# A merge that cannot fast-forward stops without touching a file. A merge
# that works replaces files one by one, so a screen that starts during it can
# see a mix of old and new files, and reloads when version.txt changes.
git fetch --quiet
if ! git merge --quiet --ff-only '@{u}'; then
  echo "The pull stopped. The lines above say why. Do not follow git's hint to merge or rebase on the Teletraan computer. See Recovering in docs/rebuilding-the-computer.md." >&2
  exit 1
fi

after=$(git rev-parse HEAD)

# A copy from the Mac tool leaves a build stamp. After a pull git knows better.
rm -f "$computer/build.txt"

# Also written when version.txt is missing or names another commit, which
# happens after a rebuild and after someone moves the Teletraan computer to a commit by
# hand. An open dashboard reloads only when version.txt changes.
if [ -f "$data/version.txt" ] && [ "$(cat "$data/version.txt")" = "$after" ]; then
  exit 0
fi

# Written last and in one step, so it never changes before the files do
printf '%s\n' "$after" > "$data/.version.txt.new"
mv -f "$data/.version.txt.new" "$data/version.txt"
echo "now at $(git rev-parse --short HEAD)"

# The container only reads its settings when it starts
if ! git diff --quiet "$before" "$after" -- computer; then
  echo "Files in computer/ changed. The new settings are not in use until someone applies them, see computer/README.md." >&2
fi
