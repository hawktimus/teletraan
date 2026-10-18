#!/bin/bash
# Installs the control page on the Teletraan computer and moves the computer to the releases layout (docs/control-page.md).
#
#   sudo computer/install.sh [--from FOLDER] [--commit HASH] [--note TEXT] [--yes]
#
# It runs from the Mac tool for the first install (tools/teletraan/teletraan-tool bootstrap copies the tree to a staging
# folder in the home folder of the login user and runs this from there), and again when the units change. With no
# --from it installs the tree it is part of. Steps, in order:
#   1. refuse a tree that still has deploy/
#   2. migrate: today's /opt/teletraan becomes releases/1, local.env moves up to /opt/teletraan/local.env
#   3. install the helper socket, its service and the sudoers file
#   4. install the tree as the next release (control/bin/install-tree.js in the Node image), which builds the Studio
#   5. start the containers, start the screen again, install the nightly timer
#   6. make the bare git repository for the optional git path
# It installs no package. The Node image and git have to be there already (the lines say what to run).
#
# Settings for tests: TELETRAAN_ROOT, TELETRAAN_SYSTEMD, TELETRAAN_SUDOERS, TELETRAAN_GIT, TELETRAAN_ACCOUNT, TELETRAAN_DATA_DIR.

set -eu

here=$(cd "$(dirname "$0")" && pwd)
tree=$(cd "$here/.." && pwd)
root=${TELETRAAN_ROOT:-/opt/teletraan}
systemd_dir=${TELETRAAN_SYSTEMD:-/etc/systemd/system}
sudoers_dir=${TELETRAAN_SUDOERS:-/etc/sudoers.d}
git_repo=${TELETRAAN_GIT:-/srv/teletraan.git}
sbin_dir=${TELETRAAN_SBIN:-/usr/local/sbin}
conf_dir=${TELETRAAN_CONF:-/usr/local/etc}
node_image=node:22-alpine
web_image=nginx:1.28-alpine
commit=''
note='Installed with computer/install.sh'
assume_yes=no

say() { printf '%s\n' "$*"; }
step() { printf '\n==> %s\n' "$*"; }
stop() { printf '\nStopped: %s\n' "$*" >&2; exit 1; }

while [ "$#" -gt 0 ]; do
  case $1 in
    --from) [ "$#" -ge 2 ] || stop "--from needs a folder."; tree=$(cd "$2" && pwd); shift ;;
    --commit) [ "$#" -ge 2 ] || stop "--commit needs a hash."; commit=$2; shift ;;
    --note) [ "$#" -ge 2 ] || stop "--note needs text."; note=$2; shift ;;
    --yes|-y) assume_yes=yes ;;
    *) stop "that is not a word this script knows." ;;
  esac
  shift
done

# 1. A tree from before the folder move would put the old layout under the new units
if [ -d "$tree/deploy/scripts" ]; then
  stop "This copy is older than round 6; update it."
fi
for needed in dashboard/index.html computer/scripts/kiosk.sh control/server.js; do
  [ -f "$tree/$needed" ] || stop "$tree has no $needed. Give the folder of the Teletraan repository."
done
case $tree in
  "$root"|"$root"/*) stop "the tree to install cannot be inside $root. Copy it to a staging folder first." ;;
esac

if [ "$(id -u)" -ne 0 ]; then
  stop "this changes the system, so it has to run with sudo: sudo $0"
fi
account=${TELETRAAN_ACCOUNT:-${SUDO_USER:-}}
if [ -z "$account" ] || [ "$account" = root ]; then
  stop "run it with sudo from the login user, not as root itself."
fi
account_uid=$(id -u "$account")
account_gid=$(id -g "$account")

command -v docker > /dev/null 2>&1 || stop "docker is not installed. See docs/rebuilding-the-computer.md."

# A missing image is downloaded here, as root, because the login user is not in the docker group
need_image() {
  if docker image inspect "$1" > /dev/null 2>&1; then
    return 0
  fi
  say "The image $1 is not on this computer. Downloading it now. This is a download from the internet and can take a few minutes."
  if ! docker pull "$1"; then
    say "The download of $1 did not work. Check that this computer is online and that the name $1 is right, then run this again."
    stop "$1 is missing."
  fi
}
need_image "$node_image"
need_image "$web_image"

ask() {
  [ "$assume_yes" = yes ] && return 0
  printf '%s [y/N] ' "$1"
  IFS= read -r reply || return 1
  [ "$reply" = y ] || [ "$reply" = yes ]
}

# 2. Migration. Everything in the root except what belongs to the releases layout becomes release 1.
migrate() {
  mkdir -p "$root"
  if [ -d "$root/releases" ]; then
    say "Already on the releases layout."
    return 0
  fi
  if [ -z "$(find "$root" -mindepth 1 -maxdepth 1 ! -name local.env ! -name logs ! -name cache ! -name control-secret 2> /dev/null | head -n 1)" ]; then
    say "Nothing is installed in $root yet, so there is nothing to move."
    mkdir -p "$root/releases"
    return 0
  fi

  say "$root holds a tree. It becomes releases/1, and its local.env moves to $root/local.env."
  say "The screen keeps running; the pull timer is turned off, because updates come from the control page now."
  ask "Go ahead?" || stop "nothing was changed."

  mkdir -p "$root/releases/1"
  for entry in "$root"/* "$root"/.[!.]*; do
    [ -e "$entry" ] || [ -L "$entry" ] || continue
    case $(basename "$entry") in
      releases|local.env|logs|cache|control-secret) continue ;;
    esac
    mv "$entry" "$root/releases/1/"
  done

  for old in mini deploy; do
    if [ -f "$root/releases/1/$old/local.env" ] && [ ! -L "$root/releases/1/$old/local.env" ] && [ ! -f "$root/local.env" ]; then
      mv "$root/releases/1/$old/local.env" "$root/local.env"
    fi
  done

  first=$(git -C "$root/releases/1" rev-parse --short HEAD 2> /dev/null || true)
  printf '{\n  "version": 1,\n  "commit": "%s",\n  "date": "%s",\n  "from": "git",\n  "note": "Before the control page",\n  "treeHash": ""\n}\n' \
    "$first" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$root/releases/1/RELEASE.json"
  printf '1\n' > "$root/releases/COUNTER"
  ln -sfn releases/1 "$root/current"
  # The units and scripts name /opt/teletraan/computer and so on; these links keep those names working (control/lib/releases.js)
  for folder in "$root"/releases/1/*/; do
    name=$(basename "$folder")
    [ -e "$root/$name" ] || ln -s "current/$name" "$root/$name"
  done
  say "Release 1 is the old tree. It stays as a record and cannot be switched back to, because its folders are from before round 6."
  systemctl disable --now teletraan-pull.timer > /dev/null 2>&1 || true
}
step "Move the Teletraan computer to the releases layout"
migrate
# The folder was called mini/ before it was called computer/; the link of the old name points at nothing
[ -L "$root/mini" ] && rm -f "$root/mini"

mkdir -p "$root/releases" "$root/logs" "$root/cache"

# local.env stays at the root, mode 600, and is linked into each release
if [ ! -f "$root/local.env" ]; then
  cp "$tree/computer/local.example.env" "$root/local.env"
  say "Made $root/local.env from the example. The Mac tool fills in the keys."
fi
chmod 600 "$root/local.env"
# Port 3229 now belongs to the control page. An older local.env that gave it to the dashboard would stop the web server from starting.
if grep -q "^TELETRAAN_PORT=['\"]\{0,1\}3229['\"]\{0,1\}$" "$root/local.env"; then
  sed "s/^TELETRAAN_PORT=.*/TELETRAAN_PORT='8080'/" "$root/local.env" > "$root/local.env.new" && cat "$root/local.env.new" > "$root/local.env" && rm -f "$root/local.env.new"
  say "TELETRAAN_PORT was 3229. It is 8080 now, because the control page uses 3229."
fi
for name in TELETRAAN_UID TELETRAAN_GID TELETRAAN_ROOT; do
  if ! grep -q "^$name=" "$root/local.env"; then
    case $name in
      TELETRAAN_UID) value=$account_uid ;;
      TELETRAAN_GID) value=$account_gid ;;
      *) value=$root ;;
    esac
    printf "%s='%s'\n" "$name" "$value" >> "$root/local.env"
  fi
done
for old in mini deploy; do
  if [ -d "$root/releases/1/$old" ] && [ ! -e "$root/releases/1/$old/local.env" ]; then
    ln -s "$root/local.env" "$root/releases/1/$old/local.env"
  fi
done
chown -R "$account:$(id -gn "$account")" "$root"

# 3. The helper socket, its service and the sudoers file
step "Install the helper socket and the sudoers file"
group=$(id -gn "$account")
mkdir -p "$systemd_dir" "$sudoers_dir"
sed "s/ACCOUNT/$account/g" "$tree/computer/systemd/teletraan-control.socket" | sed "s/^SocketGroup=.*/SocketGroup=$group/" > "$systemd_dir/teletraan-control.socket"
sed "s/ACCOUNT/$account/g" "$tree/computer/systemd/teletraan-control@.service" > "$systemd_dir/teletraan-control@.service"
chmod 644 "$systemd_dir/teletraan-control.socket" "$systemd_dir/teletraan-control@.service"

sudoers_new=$(mktemp)
sed "s/ACCOUNT/$account/g" "$tree/computer/sudoers/teletraan-control" > "$sudoers_new"
if command -v visudo > /dev/null 2>&1 && ! visudo -cf "$sudoers_new" > /dev/null; then
  rm -f "$sudoers_new"
  stop "the sudoers file did not pass visudo, so it was not installed."
fi
install -m 440 "$sudoers_new" "$sudoers_dir/teletraan-control"
rm -f "$sudoers_new"

# The screen, the timers and their jobs name the folders of the release layout. Copy them again on every install,
# so a unit written by an older install does not point at a folder that is gone. Whether a timer is on does not change.
# The pull timer is left out: updates come from the control page.
for unit in "$tree"/computer/systemd/teletraan-*; do
  name=$(basename "$unit")
  case $name in teletraan-control.socket | teletraan-control@.service | teletraan-pull.*) continue ;; esac
  # The picture of the screen needs python3 and nothing else. Without it the unit is left out, the Live preview shows the
  # still copy that follows the screen, and the install goes on.
  if [ "$name" = teletraan-mirror.service ] && ! python3 --version > /dev/null 2>&1; then
    say "python3 is not installed here, so the moving picture of the screen (the mirror) is skipped. The Live preview shows the still copy."
    continue
  fi
  sed "s/ACCOUNT/$account/g" "$unit" > "$systemd_dir/$name"
  chmod 644 "$systemd_dir/$name"
done
systemctl daemon-reload
systemctl enable --now teletraan-control.socket

# 4. The tree becomes the next release. The Node image runs the same code the Update tab runs.
step "Install this tree as the next release"
install_args=(--no-restart --from upload --note "$note")
[ -z "$commit" ] || install_args+=(--commit "$commit")
docker run --rm -u "$account_uid:$account_gid" \
  -e CONTROL_ROOT=/opt/teletraan -e HOME=/opt/teletraan/cache/home -e NPM_CONFIG_CACHE=/opt/teletraan/cache/npm \
  -v "$root:/opt/teletraan" -v "$tree:/staging:ro" -w /staging "$node_image" \
  node control/bin/install-tree.js /staging "${install_args[@]}"

# The data folder is mounted by the compose file, which does not create it. Root may own it from an older install, so
# it is given to the login user, with the folders the calendar and slides timers write into.
data_dir=${TELETRAAN_DATA_DIR:-$(sed -n "s/^TELETRAAN_DATA=['\"]\{0,1\}\([^'\"]*\)['\"]\{0,1\}$/\1/p" "$root/local.env" | tail -n 1)}
data_dir=${data_dir:-/var/lib/teletraan/data}
step "Make the data folder $data_dir"
install -d -m 755 "$data_dir" "$data_dir/calendars" "$data_dir/slides" "$data_dir/mirror"
chown -R "$account:$group" "$data_dir"

# 5. The containers read through current, so they are made again, and the screen starts on the new build
step "Start the containers and the screen"
# Root runs docker. The compose file sets user: for the control container, so the files it makes belong to the login user.
(cd "$root/current/computer" && docker compose --env-file local.env up -d --force-recreate)
systemctl restart teletraan-kiosk.service 2> /dev/null || say "The screen service is not installed here; skipped."

# The nightly restart timer belongs to the control page's idea of a computer that looks after itself; its script asks for Enter
step "Install the nightly timer"
if [ -x "$root/computer/scripts/install-nightly.sh" ]; then
  echo | "$root/computer/scripts/install-nightly.sh" || say "install-nightly.sh stopped (exit $?). Run it again by hand."
else
  say "This release has no install-nightly.sh, so the nightly timer was skipped."
fi

# 6. The optional git path
step "Make the bare git repository"
if command -v git > /dev/null 2>&1; then
  if [ ! -d "$git_repo" ]; then
    git init --bare --initial-branch=main "$git_repo" > /dev/null
  fi
  hook="$git_repo/hooks/post-receive"
  cp "$tree/computer/git/post-receive" "$hook"
  chmod 755 "$hook"
  # The hook cannot use docker as the login user. This root-owned wrapper does, for a checked staging folder and commit,
  # with the root, the ids and the image taken from the root-owned file beside it.
  mkdir -p "$sbin_dir" "$conf_dir"
  install -m 755 "$tree/computer/git/install-tree-as-root.sh" "$sbin_dir/teletraan-install-tree"
  chown root:root "$sbin_dir/teletraan-install-tree"
  conf_new=$(mktemp)
  printf "ROOT='%s'\nUID_GID='%s'\nIMAGE='%s'\n" "$root" "$account_uid:$account_gid" "$node_image" > "$conf_new"
  install -m 644 "$conf_new" "$conf_dir/teletraan-install.conf"
  chown root:root "$conf_dir/teletraan-install.conf"
  rm -f "$conf_new"
  chown -R "$account:$group" "$git_repo"
  say "A push to $git_repo installs main as the next release."
else
  say "git is not installed, so the git path was skipped. The Update tab works without it."
fi

step "Done"
say "The control page is at http://$(hostname):3229/control/ (the Tailscale name works too)."
say "Next: add the origin to Sanity (docs/control-page.md, First time). The PIN is 3229 or 3426."
