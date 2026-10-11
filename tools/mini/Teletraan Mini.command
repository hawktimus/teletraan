#!/bin/bash
# Double-click this file in Finder. It opens Terminal and runs teletraan-mini,
# which shows a menu (docs/updating-the-mini.md). The window waits at the end so
# you can read what happened.
cd "$(dirname "$0")" || exit 1
./teletraan-mini "$@"
status=$?
echo
read -r -n 1 -s -p "Press any key to close this window."
echo
exit $status
