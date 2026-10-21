# Finds the connected screen and sets it so that the framebuffer is 1920 by
# 1080 (or KIOSK_RESOLUTION), whatever the TV offers. kiosk.sh sources this file and calls
# set_display. It is a file of its own so that tests/display.test.mjs can
# run it with a fake xrandr.
#
# The TV is never renegotiated: no mode is added, only a mode the TV lists is
# used. A TV that lists only 3840x2160 is shown at that mode, scaled by half,
# so the dashboard still draws 1920 by 1080 pixels.
#
# KIOSK_RESOLUTION in local.env (WIDTHxHEIGHT, 1920x1080 to start with) names another size for the framebuffer and the
# browser window, for example 3840x2160 to use a 4K TV at its own resolution. The dashboard then scales its 1920 by 1080
# picture up by two with one transform (core/screen-fit.js). A value that is not a size is ignored.
#
# Two settings for tests, with the defaults the Teletraan computer uses:
#   DISPLAY_POLL_INTERVAL   seconds between looks for a connected screen (2)
#   DISPLAY_POLL_LIMIT      seconds to look before giving up (20)

# The wanted size as WIDTHxHEIGHT: KIOSK_RESOLUTION when it is a size of 640 to 7680 by 360 to 4320, else 1920x1080
display_wanted() {
  wanted=$(setting KIOSK_RESOLUTION 2> /dev/null || true)
  if printf '%s' "$wanted" | grep -Eq '^[0-9]{3,4}x[0-9]{3,4}$' \
    && [ "${wanted%x*}" -ge 640 ] && [ "${wanted%x*}" -le 7680 ] && [ "${wanted#*x}" -ge 360 ] && [ "${wanted#*x}" -le 4320 ]; then
    printf '%s' "$wanted"
  else
    printf '1920x1080'
  fi
}

# The window size for the browser, as WIDTH,HEIGHT
display_window() {
  wanted=$(display_wanted)
  printf '%s,%s' "${wanted%x*}" "${wanted#*x}"
}

# The name of the first connected output, or nothing
display_output() {
  xrandr --query 2> /dev/null | awk '$2 == "connected" { print $1; exit }'
}

# The mode lines of output $1, as xrandr prints them
display_mode_lines() {
  xrandr --query 2> /dev/null | awk -v name="$1" '
    $1 == name && $2 == "connected" { inside = 1; next }
    /^[^ \t]/ { inside = 0 }
    inside && $1 ~ /^[0-9]+x[0-9]+/ { print }
  '
}

# Waits for an output, looking now and then once every interval until the limit
display_wait() {
  interval=${DISPLAY_POLL_INTERVAL:-2}
  limit=${DISPLAY_POLL_LIMIT:-20}
  polls=$(awk -v limit="$limit" -v interval="$interval" 'BEGIN { if (interval > 0) print int(limit / interval); else print 0 }')

  found=$(display_output)
  while [ -z "$found" ] && [ "$polls" -gt 0 ]; do
    sleep "$interval"
    polls=$((polls - 1))
    found=$(display_output)
  done
  printf '%s' "$found"
}

# Sets the screen and logs one line: output, mode, scale. Never fails, because
# the browser must start even when the screen cannot be set.
set_display() {
  output=$(display_wait)
  if [ -z "$output" ]; then
    echo "display: no connected output after ${DISPLAY_POLL_LIMIT:-20} seconds, starting the browser anyway"
    return 0
  fi

  lines=$(display_mode_lines "$output")
  wanted=$(display_wanted)

  # One line: the mode, the rate to use and the scale. A rate is the number on
  # a mode line, without the * (in use now) and the + (preferred).
  choice=$(printf '%s\n' "$lines" | awk -v want="$wanted" '
    function bare(token) { gsub(/[*+]/, "", token); return token }
    function remember(mode, rate, marked) {
      if (mode == want) {
        if (firstRate == "") firstRate = rate
        if (rate + 0 == 60) sixty = rate
        have = 1
      }
      if (!marked) return
      if (preferred == "") { preferred = mode; preferredRate = rate }
    }
    NF > 0 {
      mode = $1
      if (first == "") { first = mode; firstModeRate = "" }
      last = ""
      for (i = 2; i <= NF; i++) {
        token = $i
        number = bare(token)
        if (number ~ /^[0-9.]+$/) {
          last = number
          if (firstModeRate == "" && mode == first) firstModeRate = number
          if (token ~ /\+/) remember(mode, number, 1); else remember(mode, number, 0)
        } else if (token ~ /\+/ && last != "") {
          remember(mode, last, 1)
        }
      }
    }
    END {
      if (have) {
        rate = sixty != "" ? sixty : firstRate
        print want, (rate == "" ? "none" : rate), "1x1"
        exit
      }
      mode = preferred != "" ? preferred : first
      rate = preferred != "" ? preferredRate : firstModeRate
      if (mode == "") exit
      split(mode, size, "x")
      gsub(/[^0-9]/, "", size[2])
      split(want, wanted, "x")
      printf "%s %s %.6gx%.6g\n", mode, (rate == "" ? "none" : rate), wanted[1] / size[1], wanted[2] / size[2]
    }
  ')

  if [ -z "$choice" ]; then
    echo "display: $output lists no modes, left as it is"
    return 0
  fi

  # Not "set --", which would replace the address kiosk.sh was given
  mode=$(printf '%s' "$choice" | awk '{ print $1 }')
  rate=$(printf '%s' "$choice" | awk '{ print $2 }')
  scale=$(printf '%s' "$choice" | awk '{ print $3 }')
  if [ "$rate" != none ]; then
    xrandr --output "$output" --mode "$mode" --rate "$rate" --scale "$scale" > /dev/null 2>&1 || echo "display: xrandr could not set $output"
  else
    xrandr --output "$output" --mode "$mode" --scale "$scale" > /dev/null 2>&1 || echo "display: xrandr could not set $output"
  fi
  echo "display: output $output, mode $mode, scale $scale"
  return 0
}
