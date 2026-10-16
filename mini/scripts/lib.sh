# Shared by the scripts of this folder. Each one reads it with
#   . "$(dirname "$0")/lib.sh"
# right after "set -euo pipefail". It is read, never run.
#
# mini is the mini/ folder, repo the repository above it, config the dashboard
# settings file and env_file the keys file.
mini=$(cd "$(dirname "$0")/.." && pwd)
repo=$(dirname "$mini")
config="$repo/dashboard/config.js"
env_file="$mini/local.env"

# The value of a NAME=value line in local.env, without its quotes. Only the
# name asked for is read, because the other lines hold secrets. The last line
# wins when a name is repeated.
setting() {
  [ -f "$env_file" ] || return 0
  sed -n "s/^$1=//p" "$env_file" | tail -n 1 | sed "s/^['\"]//; s/['\"]\$//"
}

# The quoted value of "name: 'value'," in dashboard/config.js. The project ID,
# the dataset and the API version are kept there and nowhere else.
config_value() {
  [ -f "$config" ] || return 0
  sed -n "s/^[[:space:]]*$1:[[:space:]]*'\([^']*\)'.*/\1/p" "$config" | head -n 1
}
