#!/bin/bash
# Installed by computer/install.sh as /usr/local/sbin/teletraan-install-tree, owned by root. The git hook of the login
# user runs it through sudo (computer/sudoers/teletraan-control) because that user is not in the docker group.
# It takes a staging folder and a short commit, checks both, and runs the same install as the Update tab.
# The root, the user ids and the image come from the root-owned file below, never from the caller.
set -eu

conf=/usr/local/etc/teletraan-install.conf

refuse() { printf 'teletraan-install-tree: %s\n' "$*" >&2; exit 2; }

[ "$#" -eq 2 ] || refuse "give a staging folder and a commit, and nothing else."
work=$1
commit=$2

case $work in
  /var/tmp/teletraan-push.*) ;;
  *) refuse "the staging folder has to be directly under /var/tmp and be named teletraan-push.*." ;;
esac
case ${work#/var/tmp/} in
  */*) refuse "the staging folder has to be directly under /var/tmp." ;;
esac
[ ! -L "$work" ] || refuse "the staging folder is a link."
[ -d "$work" ] || refuse "the staging folder is not a folder."
caller=${SUDO_USER:-$(id -un)}
[ -n "$(find "$work" -maxdepth 0 -user "$caller" 2> /dev/null)" ] || refuse "the staging folder does not belong to $caller."
printf '%s' "$commit" | grep -Eq '^[0-9a-f]{4,40}$' || refuse "the commit is not a short hash."

[ -f "$conf" ] || refuse "$conf is missing. Run the installer again from the Mac tool."
ROOT=''
UID_GID=''
IMAGE=''
# shellcheck disable=SC1090
. "$conf"
[ -n "$ROOT" ] && [ -n "$UID_GID" ] && [ -n "$IMAGE" ] || refuse "$conf is incomplete."

status=0
docker run --rm -u "$UID_GID" -e CONTROL_ROOT=/opt/teletraan -e HOME=/opt/teletraan/cache/home -e NPM_CONFIG_CACHE=/opt/teletraan/cache/npm \
  -v "$ROOT:/opt/teletraan" -v /run/teletraan:/run/teletraan -v "$work:/staging:ro" -w /staging "$IMAGE" \
  node control/bin/install-tree.js /staging --from git --commit "$commit" --note 'git push' || status=$?

# The service runs the code it started with; this starts it on the new release
if [ "$status" -eq 0 ]; then
  docker restart teletraan-control > /dev/null 2>&1 || true
fi
exit "$status"
