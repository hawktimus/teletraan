#!/bin/sh
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
git ls-files | grep -v '^tools/sweep-words\.txt$' | while IFS= read -r file; do
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
echo "sweep: clean."
