# The --check run: asks Monday who the token belongs to and writes nothing
run_check() {
  work=$(mktemp -d "${TMPDIR:-/tmp}/monday-check.XXXXXX")
  trap 'rm -rf "$work"' EXIT
  : > "$work/errors.txt"
  failed=0

  case $monday_token in
    ''|'['*)
      echo "FAIL  MONDAY_API_TOKEN is not in local.env"
      failed=1
      ;;
    *)
      looks_like_key MONDAY_API_TOKEN "$monday_token"
      jq -n --arg query "$monday_query_me" '{query: $query}' > "$work/body.json"
      ask "$work/body.json" "$work/answer.json"
      if [ "$outcome" = ok ]; then
        name=$(jq -r "$paths$helpers"'me_name | first_name(12) | strings' "$work/answer.json" 2> /dev/null || true)
        echo "OK    Monday accepts the token (connected as ${name:-nobody})"
      else
        echo "FAIL  $(tail -n 1 "$work/errors.txt")"
        failed=1
      fi
      ;;
  esac

  case $write_token in
    ''|'['*)
      echo "FAIL  SANITY_WRITE_TOKEN is not in local.env, so nothing can be written to Sanity"
      failed=1
      ;;
    *) echo "OK    SANITY_WRITE_TOKEN is in local.env" ;;
  esac

  exit "$failed"
}

# The --debug run: asks Monday for the first two items of one board, with every column, and prints what came back
# so a coach can see why a board reads empty. It prints the kind of board, the API version and the shape of each
# value. The text of a column is shown only for the kinds that hold no names of people, and a people column
# shows how many people it holds. The token is never printed. Writes nothing.
run_debug() {
  work=$(mktemp -d "${TMPDIR:-/tmp}/monday-debug.XXXXXX")
  trap 'rm -rf "$work"' EXIT
  : > "$work/errors.txt"

  case $monday_token in
    ''|'['*)
      echo "FAIL  MONDAY_API_TOKEN is not in local.env"
      exit 1
      ;;
  esac
  looks_like_key MONDAY_API_TOKEN "$monday_token"

  jq -n --arg query "$monday_query_debug" --arg board "$1" '{query: $query, variables: {board: [$board]}}' > "$work/body.json"
  ask "$work/body.json" "$work/answer.json"
  if [ "$outcome" != ok ]; then
    echo "FAIL  $(tail -n 1 "$work/errors.txt")"
    exit 1
  fi

  echo "API version: $monday_version"
  jq -r "$paths$helpers"'
    def text_is_safe: . as $type | ["status", "color", "numbers", "numeric", "date", "timeline", "timerange", "board_relation", "dropdown", "battery", "checkbox"] | index($type) != null;
    def shape:
      (del(.id, .type, .text)
        | if has("persons_and_teams") then .persons_and_teams |= (if type == "array" then {count: length} else . end) else . end) as $rest
      | (if (.text | type) != "string" or .text == "" then {}
         elif (.type | type) == "string" and (.type | text_is_safe) then {text: (.text | safe_text)}
         else {text: "(hidden)"} end) + $rest;
    first_board as $board
    | if $board == null then "No board came back. The account of the token may not be able to see this board."
      else
        ("Board: \($board | board_name | whole_text(60))",
         "Hierarchy: \($board | board_kind // "not given")",
         (first_items[]
          | "Item: \(item_name | safe_text)\(if item_parent == null then "" else " (subitem)" end)",
            (item_values[]? | "  \(value_column) \(value_type): \(shape | tojson)")))
      end' "$work/answer.json"
  exit 0
}
