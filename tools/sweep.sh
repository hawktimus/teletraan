#!/bin/sh
# Also looks for strings shaped like a key (see the end of this file).
# Looks through the files git tracks for the words in tools/sweep-words.txt: names of AI tools, of films,
# shows and franchises, and the lines that credit a tool or a co-author. Exit 1 and the file and line
# of each hit when there is one, exit 0 when there is none. The word list is the only file allowed to
# hold the words, so it is left out. Run it by hand, or let .githooks/pre-push run it (docs/coaches-guide.md).
#
#   tools/sweep.sh
set -eu

tools=$(cd "$(dirname "$0")" && pwd)
repo=$(dirname "$tools")
words="$tools/sweep-words.txt"

if [ ! -f "$words" ]; then
  echo "sweep: $words is missing." >&2
  exit 2
fi

cd "$repo"

# The list without its comments and empty lines, as patterns for grep -F
patterns=$(mktemp)
trap 'rm -f "$patterns"' EXIT
sed -e '/^[[:space:]]*#/d' -e '/^[[:space:]]*$/d' "$words" > "$patterns"

found=$(mktemp)
trap 'rm -f "$patterns" "$found"' EXIT

# Tracked files only, so node_modules and local files are never looked at. -I leaves binary files alone and
# -w keeps a word from matching inside a longer one.
# The vendored library under control/static/vendor/ is not our text; its short variable names match the list
git ls-files | grep -v -e '^tools/sweep-words\.txt$' -e '^control/static/vendor/' | while IFS= read -r file; do
  [ -f "$file" ] || continue
  grep -IniwF -f "$patterns" -- "$file" 2> /dev/null | cut -c1-160 | sed "s|^|$file:|" >> "$found" || true
done

hits=0
if [ -s "$found" ]; then
  cat "$found"
  hits=1
fi

if [ "$hits" -ne 0 ]; then
  echo "sweep: the lines above hold a word from tools/sweep-words.txt." >&2
  exit 1
fi

# Strings shaped like a key or a token: a Google key, an AWS key, a GitHub token, a private key, a JWT, a Sanity token,
# or a long value typed after a name that ends in TOKEN, SECRET, API_KEY or AUTH_KEY. Only the file and the line are
# printed, never the string, so a hit does not copy a key into a terminal or a log. package-lock.json holds long hashes.
# A made-up key in a test is built from two pieces, so that it is not shaped like one.
shapes='AIza[0-9A-Za-z_-]{35}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,}|-----BEGIN [A-Z ]*PRIVATE KEY-----'
shapes="$shapes"'|eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
shapes="$shapes"'|['"'"'"= :]sk[A-Za-z0-9]{60,}['"'"'" ]'
shapes="$shapes"'|(TOKEN|SECRET|API_KEY|AUTH_KEY)['"'"'"]?[[:space:]]*[=:][[:space:]]*['"'"'"][A-Za-z0-9_.-]{40,}['"'"'"]'
secrets=$(git grep -InE "$shapes" -- . ':!*package-lock.json' 2> /dev/null | cut -d: -f1,2 || true)
if [ -n "$secrets" ]; then
  printf '%s\n' "$secrets" | sed 's|$|: looks like a key or a token|'
  echo "sweep: the lines above look like a key or a token. Take it out, and make a new key if it was real (docs/security-review.md)." >&2
  exit 1
fi
echo "sweep: clean."
