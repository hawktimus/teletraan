#!/bin/sh
# Merges a file of NAME='value' lines into deploy/local.env on the Mini.
# teletraan-mini sends this script and the new lines with scp, runs it on the
# Mini and removes both afterwards.
#
#   sh teletraan-merge.sh <local.env> <new lines>
#
# A name in the new lines replaces the same name in local.env, or is added at
# the end. A name with an empty value ('') is taken out. Every other line
# stays as it is, comments included. The file is made again with mode 600 and
# put in place in one step, so it is owned by whoever runs this. It prints
# names and never a value.
set -eu

env_file=${1:-}
incoming=${2:-}

if [ -z "$env_file" ] || [ -z "$incoming" ] || [ "$#" -ne 2 ]; then
  echo "Usage: sh teletraan-merge.sh <local.env> <new lines>" >&2
  exit 2
fi

if [ ! -f "$incoming" ]; then
  echo "The new values did not arrive, so nothing was changed." >&2
  exit 1
fi

# Only the keys and the calendars are handled here, so a wrong file cannot
# change the port or the data folder
names='SANITY_WRITE_TOKEN|MONDAY_API_TOKEN|TBA_AUTH_KEY|CALENDAR_[A-Za-z0-9_]+_URL'
bad=$(grep -n -v -E "^(($names)=.*)?\$" "$incoming" | cut -d : -f 1 | head -n 1)
if [ -n "$bad" ]; then
  echo "Line $bad of the new values is not a key or a calendar, so nothing was changed." >&2
  exit 1
fi

if [ -f "$env_file" ]; then
  source_file=$env_file
else
  source_file=/dev/null
  echo "local.env was not there. A new one is made with these lines only."
fi

umask 077
temp=$(mktemp "$env_file.XXXXXX")
trap 'rm -f "$temp"' EXIT

# The report comes first, because it compares the new lines with the old file.
# For each name it reads whether the last new line for it is empty.
awk '
  BEGIN { quote = sprintf("%c", 39) }
  {
    at = index($0, "=")
    if (at < 2) next
    name = substr($0, 1, at - 1)
    value = substr($0, at + 1)
    if (!(name in flag)) order[++count] = name
    flag[name] = (value == "" || value == quote quote || value == "\"\"") ? "yes" : "no"
  }
  END { for (i = 1; i <= count; i++) print order[i], flag[order[i]] }
' "$incoming" | while read -r name empty; do
  if grep -q "^$name=" "$source_file"; then there=yes; else there=no; fi
  case "$there $empty" in
    "yes yes") echo "removed $name" ;;
    "no yes") echo "$name was not there" ;;
    "yes no") echo "replaced $name" ;;
    *) echo "added $name" ;;
  esac
done

# The last new line for a name wins, and a repeated name in local.env keeps
# only its first place, because the scripts read the last one
awk -v incoming="$incoming" '
  BEGIN {
    quote = sprintf("%c", 39)
    while ((getline line < incoming) > 0) {
      at = index(line, "=")
      if (at < 2) continue
      name = substr(line, 1, at - 1)
      value = substr(line, at + 1)
      if (!(name in wanted)) {
        count += 1
        order[count] = name
      }
      wanted[name] = line
      empty[name] = (value == "" || value == quote quote || value == "\"\"")
    }
    close(incoming)
  }
  {
    at = index($0, "=")
    name = (at > 1) ? substr($0, 1, at - 1) : ""
    if (name == "" || !(name in wanted)) {
      print
      next
    }
    if (!(name in written)) {
      written[name] = 1
      if (!empty[name]) print wanted[name]
    }
  }
  END {
    for (i = 1; i <= count; i++) {
      name = order[i]
      if (!(name in written) && !empty[name]) print wanted[name]
    }
  }
' "$source_file" > "$temp"

chmod 600 "$temp"
mv -f "$temp" "$env_file"
echo "local.env is updated."
