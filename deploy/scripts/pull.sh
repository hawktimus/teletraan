#!/bin/sh
# Brings the repository up to date. A pull is a deploy: the web server shows
# the files in the repository as they are. When something new arrives, the
# commit is written to <data folder>/version.txt, and a dashboard that is
# open sees it change within a minute and reloads itself.
set -eu

deploy=$(cd "$(dirname "$0")/.." && pwd)
repo=$(cd "$deploy/.." && pwd)
env_file="$deploy/local.env"

# Fail with a message instead of waiting for a password nobody can type
GIT_TERMINAL_PROMPT=0
export GIT_TERMINAL_PROMPT

# The value of a NAME=value line in local.env, without its quotes
setting() {
  [ -f "$env_file" ] || return 0
  sed -n "s/^$1=//p" "$env_file" | tail -n 1 | sed "s/^['\"]//; s/['\"]\$//"
}

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}

if [ ! -d "$data" ]; then
  echo "The data folder $data does not exist. See docs/rebuilding-the-mini.md." >&2
  exit 1
fi

# version.txt must be readable by the web server inside the container
umask 022

cd "$repo"
before=$(git rev-parse HEAD)

# A power cut in the middle of a checkout leaves this file behind, and every
# pull after it would fail with a message that does not say what to do
if [ -f "$repo/.git/index.lock" ]; then
  echo "A git lock file is in the way: $repo/.git/index.lock. If no git command is running, remove it. See Recovering in docs/rebuilding-the-mini.md." >&2
  exit 1
fi

# A merge that cannot fast-forward stops without touching a file. A merge
# that works replaces files one by one, so a screen that starts during it can
# see a mix of old and new files, and reloads when version.txt changes.
git fetch --quiet
if ! git merge --quiet --ff-only '@{u}'; then
  echo "The pull stopped. The lines above say why. Do not follow git's hint to merge or rebase on the Mini. See Recovering in docs/rebuilding-the-mini.md." >&2
  exit 1
fi

after=$(git rev-parse HEAD)

# Also written when version.txt is missing or names another commit, which
# happens after a rebuild and after someone moves the Mini to a commit by
# hand. An open dashboard reloads only when version.txt changes.
if [ -f "$data/version.txt" ] && [ "$(cat "$data/version.txt")" = "$after" ]; then
  exit 0
fi

# Written last and in one step, so it never changes before the files do
printf '%s\n' "$after" > "$data/.version.txt.new"
mv -f "$data/.version.txt.new" "$data/version.txt"
echo "now at $(git rev-parse --short HEAD)"

# The container only reads its settings when it starts
if ! git diff --quiet "$before" "$after" -- deploy; then
  echo "Files in deploy/ changed. The new settings are not in use until someone applies them, see deploy/README.md." >&2
fi
