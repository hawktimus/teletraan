#!/bin/bash
# Usage: notify.sh "short text"      sends one push message, or keeps it when it cannot be sent
#        notify.sh --flush           sends the messages that are waiting
#        notify.sh --test            sends one message and says how it went (make heartbeat-test)
# The push message of the Teletraan computer: it went offline, it came back, netwatch took an action, a remote action was
# received. Any script can raise one by calling this with one argument. The address is NOTIFY_URL in local.env. With no
# value this does nothing and says nothing. NOTIFY_FORMAT is json (the default, {"content": "<text>"}, which a chat
# webhook takes) or text (the text as the plain body).
#
# Every message starts with the machine name, teletraan, and holds no address and no key: anything that looks like a host
# name or an IP address is taken out before it is sent. A message that cannot be sent is logged and kept (the last 5 are
# kept, in <data folder>/notify/pending), and goes with the next message. Nothing here ever stops the script that calls
# it: the exit code is 0 except for --test.
# The address is given to curl on standard input, so it never shows in the process list or in a log.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

mode=send
case "${1:-}" in
  --flush) mode=flush ;;
  --test) mode=test ;;
  '') echo "Usage: notify.sh \"text\" | --flush | --test" >&2; exit 0 ;;
esac

url=$(setting NOTIFY_URL)
format=$(setting NOTIFY_FORMAT)
case $url in
  ''|'['*)
    [ "$mode" != test ] || echo "NOTIFY_URL is empty in local.env, so no push message is sent."
    exit 0
    ;;
esac
case $url in
  https://*) ;;
  *) log_json notify push skipped "NOTIFY_URL is not an https address"; [ "$mode" != test ] || echo "NOTIFY_URL must start with https://"; exit 0 ;;
esac

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
folder="$data/notify"
pending="$folder/pending"
mkdir -p "$folder" 2> /dev/null || true

# One line of plain text: no address, no host name, no key-like word, not too long
clean() {
  printf '%s' "$1" | tr -d '\000-\037' |
    sed -E 's#[A-Za-z][A-Za-z0-9+.-]*://[^ ]*#[address]#g; s#[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+#[host]#g' | cut -c 1-300
}

# 0 when the push service took the text
send() {
  local body type code=0
  if [ "$format" = text ]; then
    body=$1
    type='text/plain'
  else
    body=$(jq -cn --arg content "$1" '{content: $content}') || return 1
    type='application/json'
  fi
  printf 'url = "%s"\n' "$url" |
    curl --silent --fail --max-time 15 --connect-timeout 10 --proto '=https' --config - \
      --request POST --header "Content-Type: $type" --data-binary "$body" --output /dev/null 2> /dev/null || code=$?
  return "$code"
}

waiting=''
[ ! -s "$pending" ] || waiting=$(cat "$pending")

if [ "$mode" = send ] || [ "$mode" = test ]; then
  text='test message from make heartbeat-test'
  [ "$mode" != send ] || text=$(clean "$1")
  line="teletraan: [$(date +%H:%M)] $text"
  waiting=$(printf '%s\n%s\n' "$waiting" "$line" | awk 'NF' | tail -n 5)
elif [ -z "$waiting" ]; then
  exit 0
fi

code=0
send "$waiting" || code=$?
if [ "$code" -eq 0 ]; then
  rm -f "$pending" 2> /dev/null || true
  log_json notify push sent "$(printf '%s\n' "$waiting" | awk 'END { print NR }') message(s)"
  [ "$mode" != test ] || echo "push: sent."
else
  printf '%s\n' "$waiting" > "$pending" 2> /dev/null || true
  log_json notify push failed "curl exit $code, the message is kept for the next one"
  if [ "$mode" = test ]; then
    echo "push: not sent (curl exit $code)."
    exit 1
  fi
fi
exit 0
