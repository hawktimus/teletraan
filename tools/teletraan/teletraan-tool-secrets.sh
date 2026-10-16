# Read by teletraan-tool, never run. The keys and calendar links saved on this Mac.
# "Build season" becomes BUILD_SEASON, which is the middle of
# CALENDAR_BUILD_SEASON_URL
calendar_id() {
  printf '%s' "$1" | tr '[:lower:]' '[:upper:]' | sed 's/[^A-Z0-9]\{1,\}/_/g; s/^_//; s/_$//'
}

# The lowercase code that Studio uses for CALENDAR_<ID>_URL
calendar_code() {
  local code=${1#CALENDAR_}
  code=${code%_URL}
  printf '%s' "$code" | tr '[:upper:]' '[:lower:]'
}

# The place of the calendar with this code in the list, or nothing
find_calendar() {
  local wanted i=0
  wanted=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  while [ "$i" -lt "$cal_count" ]; do
    if [ "$(calendar_code "${cal_names[$i]}")" = "$wanted" ]; then
      printf '%s' "$i"
      return 0
    fi
    i=$((i + 1))
  done
  return 1
}

set_calendar() {
  local place
  place=$(find_calendar "$(calendar_code "$1")")
  if [ -n "$place" ]; then
    cal_values[$place]=$2
  else
    cal_names[$cal_count]=$1
    cal_values[$cal_count]=$2
    cal_count=$((cal_count + 1))
  fi
}

set_key() {
  local i=0
  while [ "$i" -lt "${#key_names[@]}" ]; do
    if [ "${key_names[$i]}" = "$1" ]; then
      key_values[$i]=$2
      if [ -n "$2" ]; then key_states[$i]=1; else key_states[$i]=2; fi
      return 0
    fi
    i=$((i + 1))
  done
  return 1
}

# The value of a NAME=value line without its quotes, the way the scripts on the
# computer read it
unquote() {
  local value=$1
  case $value in [\'\"]*) value=${value#?} ;; esac
  case $value in *[\'\"]) value=${value%?} ;; esac
  printf '%s' "$value"
}

take_line() {
  local name=${1%%=*} value
  value=$(unquote "${1#*=}")
  case $name in
    SANITY_WRITE_TOKEN|MONDAY_API_TOKEN|TBA_AUTH_KEY)
      case $value in
        '') set_key "$name" '' ;;
        '['*) ;;
        *)
          if check_key "$value"; then set_key "$name" "$clean_value"; else skipped="$skipped $name"; fi
          ;;
      esac
      ;;
    CALENDAR_*_URL)
      if ! printf '%s' "$name" | grep -Eq '^CALENDAR_[A-Za-z0-9_]+_URL$'; then
        skipped="$skipped $name"
        return 0
      fi
      case $value in
        '') set_calendar "$name" '' ;;
        '['*) ;;
        *)
          if check_link "$value"; then set_calendar "$name" "$clean_value"; else skipped="$skipped $name"; fi
          ;;
      esac
      ;;
  esac
}

reset_secrets() {
  key_values=('' '' '' '')
  key_states=(0 0 0 0)
  cal_names=()
  cal_values=()
  cal_count=0
}

load_secrets() {
  local line
  reset_secrets
  skipped=''
  [ -f "$secrets_file" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    take_line "$line"
  done < "$secrets_file"
  if [ -n "$skipped" ]; then
    say "These saved values were not usable and were left out:$skipped"
  fi
  return 0
}

# Writes ~/.teletraan/secrets.env with mode 600, in one step
write_secrets() {
  local temp=$secrets_file.new i=0
  (
    umask 077
    {
      while [ "$i" -lt "${#key_names[@]}" ]; do
        case ${key_states[$i]} in
          1) printf "%s='%s'\n" "${key_names[$i]}" "${key_values[$i]}" ;;
          2) printf "%s=''\n" "${key_names[$i]}" ;;
        esac
        i=$((i + 1))
      done
      i=0
      while [ "$i" -lt "$cal_count" ]; do
        printf "%s='%s'\n" "${cal_names[$i]}" "${cal_values[$i]}"
        i=$((i + 1))
      done
    } > "$temp"
  ) && chmod 600 "$temp" && mv -f "$temp" "$secrets_file"
}

# After the Teletraan computer has the values, a cleared key and a removed calendar are gone
# for good, so the saved file matches the Teletraan computer
forget_cleared() {
  local i=0 names=() values=() count=0
  while [ "$i" -lt "${#key_names[@]}" ]; do
    if [ "${key_states[$i]}" = 2 ]; then key_states[$i]=0; fi
    i=$((i + 1))
  done
  i=0
  while [ "$i" -lt "$cal_count" ]; do
    if [ -n "${cal_values[$i]}" ]; then
      names[$count]=${cal_names[$i]}
      values[$count]=${cal_values[$i]}
      count=$((count + 1))
    fi
    i=$((i + 1))
  done
  cal_names=()
  cal_values=()
  cal_count=0
  i=0
  while [ "$i" -lt "$count" ]; do
    cal_names[$i]=${names[$i]}
    cal_values[$i]=${values[$i]}
    i=$((i + 1))
  done
  cal_count=$count
}

# Everything in the output of the Teletraan computer goes through this, so that a script that
# one day prints a link or a key still cannot show one on this screen. It hides
# every saved value and anything that looks like a web address.
hide_secrets() {
  awk -v file="$secrets_file" '
    BEGIN {
      quote = sprintf("%c", 39)
      while ((getline line < file) > 0) {
        at = index(line, "=")
        if (at < 2) continue
        value = substr(line, at + 1)
        if (substr(value, 1, 1) == quote) value = substr(value, 2)
        if (substr(value, length(value), 1) == quote) value = substr(value, 1, length(value) - 1)
        if (length(value) >= 6) hide[++count] = value
      }
      close(file)
    }
    {
      text = $0
      for (i = 1; i <= count; i++) {
        done = ""
        while ((at = index(text, hide[i])) > 0) {
          done = done substr(text, 1, at - 1) "(hidden)"
          text = substr(text, at + length(hide[i]))
        }
        text = done text
      }
      gsub(/[A-Za-z][A-Za-z0-9+.-]*:\/\/[^ ]*/, "(address hidden)", text)
      print text
    }
  '
}
