# Read by monday-sync.sh, never run. Asking Monday, writing to Sanity and reading one board.
# curl's exit code in plain words. curl's own messages can include the address,
# so they are not shown.
explain() {
  case $1 in
    6) echo "could not find the server, so the network may be down" ;;
    7) echo "could not connect to the server" ;;
    22) echo "Sanity refused it, so the token may be wrong or may not have Editor access" ;;
    28) echo "the server took too long to answer" ;;
    35|51|58|59|60) echo "the secure connection failed" ;;
    63) echo "the answer is too big" ;;
    *) echo "curl failed with exit code $1" ;;
  esac
}

# A value that is missing, or still the placeholder from local.example.env that
# starts with [, means Monday is not set up yet. The timer's run ends without an
# error then, so the service does not show as failed. A run by hand says so.
not_set_up() {
  echo "$1 is not in local.env yet, so nothing was read. See docs/monday.md."
  exit 0
}

# A token is letters, digits and a few signs. Anything else would not be one, and
# must not be put in a curl setting.
looks_like_key() {
  if ! printf '%s' "$2" | grep -Eq '^[A-Za-z0-9_.-]+$'; then
    echo "$1 in local.env does not look like a token. Paste it again, with nothing else on the line." >&2
    exit 1
  fi
}

# The secret part of a request: Monday wants the token in a header. curl reads it
# on standard input, so it never shows in the process list.
secret_settings() {
  printf 'header = "Authorization: %s"\n' "$monday_token"
}

# The helpers the filters share. They are logic and not places in an answer, so
# they are not in monday-contract.sh. \u0027 is the ' sign, which cannot be
# written inside a string that is in single quotes.
helpers='
def plain: explode | map(if . < 32 or . == 127 then 32 else . end) | implode | gsub(" +"; " ") | sub("^ "; "") | sub(" $"; "");
def safe_text: plain | gsub("[^A-Za-z0-9 ,.:()\u0027_-]"; " ") | gsub(" +"; " ") | sub("^ "; "") | sub(" $"; "") | .[0:120];
def whole_text($limit): if type == "string" then plain | .[0:$limit] | sub(" $"; "") else "" end;
def column_name: if type == "string" and test("\\A[A-Za-z0-9_-]{1,50}\\z") then . else null end;
def first_name($limit):
  if type != "string" then null
  else
    (plain | split(",")[0] // "" | plain | split(" ")[0] // "") as $word
    | if ($word | contains("@")) then null
      else ($word | gsub("[^\\p{L}\u0027.-]"; "") | sub("^[-.\u0027]+"; "") | sub("[-.\u0027]+$"; "") | .[0:$limit] | if . == "" then null else . end) end
  end;
def real_day: . as $day | (try (($day + "T00:00:00Z") | fromdateiso8601 | todate | .[0:10]) catch "") == $day;
def day_of: if type == "string" then ([scan("(?<![0-9])(?:19|20)[0-9]{2}-[0-9]{2}-[0-9]{2}(?![0-9])") | select(real_day)] | first) else null end;
def first_of_each($key): reduce .[] as $item ([]; if any(.[]; .[$key] == $item[$key]) then . else . + [$item] end);
'

# Counts the requests made to Monday in this run, and why the run stopped asking
requests=0
stopped=""
outcome=failed

# Writes one problem of this run, in plain words, on a line of its own
problem() {
  printf '%s\n' "$1" >> "$work/errors.txt"
}

# Sends the question in file $1 to Monday and keeps the answer in file $2. Leaves one
# word in $outcome: ok, failed, refused (Monday turned the token away), limit (Monday
# says there were too many requests) or capped (this run has made all the requests it
# may). The problem is written in plain words.
ask() {
  outcome=failed
  if [ -n "$stopped" ]; then
    outcome=$stopped
    return 0
  fi
  if [ "$requests" -ge "$max_requests" ]; then
    stopped=capped
    outcome=capped
    problem "This run stopped after $max_requests requests to Monday and goes on at the next run."
    return 0
  fi
  requests=$((requests + 1))

  curl_status=0
  answer_code=$(secret_settings |
    curl --disable --silent --max-time 30 --connect-timeout 10 --max-filesize 10000000 --proto '=https' \
      --header 'Content-Type: application/json' --header "API-Version: $monday_version" \
      --request POST --data-binary "@$1" --output "$2" --write-out '%{http_code}' --config - "$monday_address" 2> /dev/null) || curl_status=$?

  if [ "$curl_status" -ne 0 ]; then
    problem "Monday did not answer, $(explain "$curl_status")."
    return 0
  fi

  case $answer_code in
    200)
      if ! jq empty "$2" > /dev/null 2>&1; then
        problem "Monday sent an answer that is not data."
        return 0
      fi
      said=$(jq -r "$paths$helpers"'error_messages | map(safe_text) | unique | .[0:2] | join("; ")' "$2" 2> /dev/null || true)
      if [ -n "$said" ]; then
        problem "Monday said: $said"
        return 0
      fi
      outcome=ok
      ;;
    401|403)
      stopped=refused
      outcome=refused
      problem "Monday refused the token. Check MONDAY_API_TOKEN in local.env."
      ;;
    429)
      stopped=limit
      outcome=limit
      problem "Monday says there were too many requests, so this run stopped. It goes on at the next run."
      ;;
    *)
      problem "Monday answered with code $answer_code."
      ;;
  esac
}

# Sends the mutations in file $1 to Sanity. Gives back 1 and writes the problem
# when Sanity does not take them.
write_to_sanity() {
  status=0
  printf 'header = "Authorization: Bearer %s"\n' "$write_token" |
    curl --disable --silent --fail --max-time 30 --connect-timeout 10 --proto '=https' --config - \
      --request POST --header 'Content-Type: application/json' --data-binary "@$1" \
      --output /dev/null "$host/v$version/data/mutate/$dataset" 2> /dev/null || status=$?

  if [ "$status" -ne 0 ]; then
    problem "Could not write to Sanity, $(explain "$status")."
    return 1
  fi
}

# The kind of a board, classic or multi_level, from the list of this run when it was asked for, and else
# from the list the last run wrote. A board that is in neither is read as classic.
hierarchy_of() {
  said=""
  if [ -s "$work/boards-answer.json" ]; then
    said=$(jq -r --arg board "$1" "$paths"'[board_list | arrays | .[] | objects | select((board_id | tostring) == $board) | board_hierarchy][0] // empty' "$work/boards-answer.json" 2> /dev/null || true)
  fi
  if [ -z "$said" ]; then
    said=$(jq -r --arg board "$1" '[.result.listed | arrays | .[] | objects | select(.id == $board) | .hierarchy][0] // empty' "$work/sanity.json" 2> /dev/null || true)
  fi
  case $said in
    multi_level) echo multi_level ;;
    *) echo classic ;;
  esac
}

# Reads every page of one board. $1 is tasks or milestones, $2 the board number and $3 the columns
# as a list. The parent items are left in $work/<kind>-items.ndjson. Leaves read_all (yes when the
# board was read to its end) and board_title. A problem is written for a page that did not come.
read_board() {
  kind=$1
  board=$2
  printf '%s' "$3" > "$work/columns.json"
  : > "$work/$kind-items.ndjson"
  errors_before=$(wc -l < "$work/errors.txt" | tr -d ' ')
  cursor=""
  read_all=no
  board_title=""
  seen=yes
  query_first=$monday_query_items
  query_more=$monday_query_more
  if [ "$(hierarchy_of "$board")" = multi_level ]; then
    query_first=$monday_query_items_multi
    query_more=$monday_query_more_multi
  fi
  echo '{}' > "$work/labels.json"

  while :; do
    if [ -z "$cursor" ]; then
      page='first_page'
      jq -n --arg query "$query_first" --arg board "$board" --slurpfile columns "$work/columns.json" --argjson limit "$page_size" \
        '{query: $query, variables: {board: [$board], columns: $columns[0], limit: $limit}}' > "$work/body.json"
    else
      page='more_page'
      jq -n --arg query "$query_more" --arg cursor "$cursor" --slurpfile columns "$work/columns.json" --argjson limit "$page_size" \
        '{query: $query, variables: {cursor: $cursor, columns: $columns[0], limit: $limit}}' > "$work/body.json"
    fi
    ask "$work/body.json" "$work/page.json"
    [ "$outcome" = ok ] || break

    if ! jq -e "$paths$page"' | page_items | arrays' "$work/page.json" > /dev/null 2>&1; then
      problem "Monday gave no items for board $board, so the account of the token may not be able to see it."
      seen=no
      break
    fi

    if [ -z "$cursor" ]; then
      board_title=$(jq -r "$paths$helpers"'first_board_name | whole_text(60)' "$work/page.json" 2> /dev/null || true)
      jq -c "$paths"'board_labels' "$work/page.json" > "$work/labels.json" 2> /dev/null || echo '{}' > "$work/labels.json"
    fi

    jq -c --slurpfile labels "$work/labels.json" "$paths$page"'
      | def with_battery: value_battery as $key | ((value_column | tostring) as $column | $labels[0][$column][($key // "")] // null) as $named
          | {index: (value_index // ($key | if . == null then null else tonumber end)), label: (value_label // $named)};
        page_items | .[] | objects
      | {
          id: (item_id | tostring),
          name: item_name,
          parent: (item_parent | if . == null then null else tostring end),
          values: (((item_values | arrays) // []) | map(select(type == "object") | {key: (value_column | tostring), value: ({text: (value_text // "")} + with_battery + {linked: value_linked, date: value_date, from: value_from, to: value_to})}) | from_entries)
        }' "$work/page.json" >> "$work/$kind-items.ndjson"

    cursor=$(jq -r "$paths$page"' | page_cursor | strings' "$work/page.json")
    if [ -z "$cursor" ]; then
      read_all=yes
      break
    fi
    case $cursor in
      *[!A-Za-z0-9_=+/.-]*)
        problem "Monday sent a place to carry on from that cannot be used, for board $board."
        break
        ;;
    esac
    if [ "${#cursor}" -gt 2000 ]; then
      problem "Monday sent a place to carry on from that is too long, for board $board."
      break
    fi
  done

  board_items=$(wc -l < "$work/$kind-items.ndjson" | tr -d ' ')
  board_note=""
  if [ "$(wc -l < "$work/errors.txt" | tr -d ' ')" -gt "$errors_before" ]; then
    board_note=$(tail -n 1 "$work/errors.txt")
  fi
  board_ok=false
  if [ "$read_all" = yes ] || [ "$seen" = no ]; then
    board_ok=true
  elif [ -z "$board_note" ]; then
    board_note="This run stopped before it read this board, and goes on at the next run."
  fi
  # What this run read from the board, for the Monday Boards page and the connection block. A board
  # that stopped half way keeps the reading of the run before, and only gets the reason.
  jq -n -c --arg board "$board" --arg name "$board_title" --argjson items "$board_items" --argjson ok "$board_ok" --arg note "$board_note" \
    '{board: $board, name: $name, items: $items, ok: $ok, note: $note}' >> "$work/readings.ndjson"
}
