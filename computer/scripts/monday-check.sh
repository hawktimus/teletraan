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
