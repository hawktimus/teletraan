// The fake sudo of the Mac tool tests. With sudo-password.txt in the stub folder it wants that password: -n fails,
// and -S or -v read one line from the input and compare it, and "sudo asked once" is logged for each good one.
// Without the file it needs none. Options are dropped and the rest is run as it is.
export const fakeSudo = `#!/bin/sh
echo "sudo $*" >> "$STUB_LOG"
needs_password=no
[ -f "$STUB_DIR/sudo-password.txt" ] && needs_password=yes
no_ask=no
read_stdin=no
check_only=no
while [ "$#" -gt 0 ]; do
  case $1 in
    -n) no_ask=yes; shift ;;
    -S) read_stdin=yes; shift ;;
    -v) check_only=yes; shift ;;
    -p) shift 2 ;;
    *) break ;;
  esac
done
if [ "$needs_password" = yes ]; then
  [ "$no_ask" = no ] || exit 1
  [ "$read_stdin" = yes ] || exit 1
  IFS= read -r given
  [ "$given" = "$(cat "$STUB_DIR/sudo-password.txt")" ] || exit 1
  echo "sudo asked once" >> "$STUB_LOG"
fi
[ "$check_only" = yes ] && exit 0
exec "$@"
`;
