#!/bin/sh
# Checks everything the screen needs to get its content, one plain line each:
# OK or FAIL, then what was found. The last line is OK if every check passed,
# FAIL if any did not. Run it over SSH from any computer:
#
#   ssh hawktimus@<address> /opt/teletraan/deploy/scripts/check-connection.sh
#
# Add -t after ssh if Docker needs sudo and sudo needs a password.
#
# There is no "set -e" here on purpose. A tool that is missing, or a check that
# fails, must print FAIL for its own line and let the others run. Nothing is
# printed from local.env except what is asked for below, and calendar
# addresses are never read.

deploy=$(cd "$(dirname "$0")/.." && pwd)
repo=$(dirname "$deploy")
config="$repo/dashboard/config.js"
env_file="$deploy/local.env"
compose_file="$deploy/docker-compose.yml"

failures=0

ok() {
  printf 'OK    %s\n' "$1"
}

fail() {
  printf 'FAIL  %s\n' "$1"
  failures=$((failures + 1))
}

have() {
  command -v "$1" > /dev/null 2>&1
}

# The quoted value of "name: 'value'," in dashboard/config.js. The project
# ID, the dataset and the API version are kept there and nowhere else.
config_value() {
  [ -f "$config" ] || return 0
  sed -n "s/^[[:space:]]*$1:[[:space:]]*'\([^']*\)'.*/\1/p" "$config" | head -n 1
}

# The value of one NAME=value line in local.env, without its quotes. Only the
# name asked for is read, because the other lines hold secrets.
env_value() {
  [ -f "$env_file" ] || return 0
  sed -n "s/^$1=//p" "$env_file" | tail -n 1 | sed "s/^['\"]//; s/['\"]\$//"
}

project=$(config_value projectId)
dataset=$(config_value dataset)
version=$(config_value apiVersion)

# The port the web container is published on. local.env says, and when it does
# not, docker-compose.yml has the default after ":-".
port=$(env_value TELETRAAN_PORT)
if [ -z "$port" ] && [ -f "$compose_file" ]; then
  port=$(sed -n 's/.*TELETRAAN_PORT:-\([0-9][0-9]*\)}.*/\1/p' "$compose_file" | head -n 1)
fi

# The status code of a web address, or 000 when there was no answer at all
# (or curl is missing). Extra curl options go before the address.
http_code() {
  address=$1
  shift
  have curl || {
    echo 000
    return 0
  }
  code=$(curl -sS -m 15 -o /dev/null -w '%{http_code}' "$@" "$address" 2> /dev/null)
  echo "${code:-000}"
}

# The answer to a GROQ query, as the text Sanity sends. The query is given to
# curl separately so that it does the encoding. This asks without a login:
# nothing here sends a token. $1 is the host and $2 is the query.
sanity_query() {
  host=$1
  query=$2
  have curl || return 0
  curl -sS -m 15 -G "$host/v$version/data/query/$dataset" \
    --data-urlencode "query=$query" --data-urlencode 'perspective=published' 2> /dev/null
}

if [ -z "$project" ] || [ -z "$dataset" ] || [ -z "$version" ]; then
  fail "config: could not read the project ID, dataset and API version from dashboard/config.js"
  printf '      The Sanity checks below cannot work without them.\n'
fi

# What the dashboard asks is on the ordinary host, so it sees a change at once.
# The cached host answers quickly and is the one to count documents with.
api_host="https://$project.api.sanity.io"
cdn_host="https://$project.apicdn.sanity.io"

# 1. DNS
if have getent; then
  address=$(getent hosts api.sanity.io 2> /dev/null | awk '{ print $1; exit }')
  if [ -n "$address" ]; then
    ok "DNS: api.sanity.io is found at $address"
  else
    fail "DNS: api.sanity.io was not found, so the Mini has no working DNS"
  fi
else
  fail "DNS: the getent command is missing, so DNS could not be checked"
fi

# 2. Sanity reachable. Any answer under 500 means the server is there.
if [ -n "$project" ]; then
  code=$(http_code "$cdn_host/")
  case $code in
    000) fail "Sanity: no answer from $project.apicdn.sanity.io (HTTP 000), the network or a firewall is in the way" ;;
    5??) fail "Sanity: $project.apicdn.sanity.io answered HTTP $code, a problem at Sanity" ;;
    *) ok "Sanity: $project.apicdn.sanity.io answered HTTP $code" ;;
  esac
else
  fail "Sanity: no project ID, so nothing to reach"
fi

# 3. The dataset is public. A count query with no login must answer with a number.
if [ -n "$project" ] && [ -n "$dataset" ] && [ -n "$version" ]; then
  answer=$(sanity_query "$api_host" 'count(*)')
  total=$(printf '%s' "$answer" | sed -n 's/.*"result":\([0-9][0-9]*\).*/\1/p')
  if [ -n "$total" ]; then
    ok "Dataset: $dataset can be read without a login ($total documents visible)"
  elif printf '%s' "$answer" | grep -q '"error"'; then
    fail "Dataset: $dataset needs a login, so it is not public. The dashboard cannot read a private dataset."
  else
    fail "Dataset: $dataset could not be read, no usable answer from Sanity"
  fi
else
  fail "Dataset: the project ID, dataset or API version is missing"
fi

# 4. CORS. The browser on the Mini asks from http://localhost:<port>, and
# Sanity only lets it read the answer if it has that address in its CORS
# origins list. Sanity answers a wrong origin with 403, or leaves the
# access-control-allow-origin line out.
origin="http://localhost:$port"
if [ -z "$port" ]; then
  fail "CORS: could not find the port in deploy/local.env or deploy/docker-compose.yml"
elif ! have curl; then
  fail "CORS: the curl command is missing, so CORS could not be checked"
elif [ -z "$project" ] || [ -z "$dataset" ] || [ -z "$version" ]; then
  fail "CORS: the project ID, dataset or API version is missing"
else
  headers=$(curl -sS -m 15 -G -D - -o /dev/null -H "Origin: $origin" \
    "$api_host/v$version/data/query/$dataset" \
    --data-urlencode 'query=count(*)' --data-urlencode 'perspective=published' 2> /dev/null | tr -d '\r')
  code=$(printf '%s\n' "$headers" | sed -n '1s/^HTTP[^ ]* \([0-9][0-9]*\).*/\1/p')
  allowed=$(printf '%s\n' "$headers" | sed -n 's/^[Aa]ccess-[Cc]ontrol-[Aa]llow-[Oo]rigin:[[:space:]]*//p' | head -n 1)

  if [ -z "$code" ]; then
    fail "CORS: no answer from Sanity, so $origin could not be checked"
  elif [ "$code" = 200 ] && { [ "$allowed" = "$origin" ] || [ "$allowed" = '*' ]; }; then
    ok "CORS: Sanity allows $origin (HTTP $code)"
  elif [ "$code" = 200 ]; then
    fail "CORS: HTTP $code but no access-control-allow-origin for $origin. Add it in the project's CORS origins at sanity.io/manage."
  else
    fail "CORS: HTTP $code for $origin. Add it in the project's CORS origins at sanity.io/manage."
  fi
fi

# 5. BAND. The calendars come from it. Any answer at all, even "not found" for
# a made up address, means it can be reached.
code=$(http_code https://api.band.us/)
if [ "$code" = 000 ]; then
  fail "BAND: no answer from api.band.us (HTTP 000), the Mini cannot download the calendars"
else
  ok "BAND: api.band.us answered HTTP $code"
fi

# 6. The web container. Docker may need sudo for this account. Without a
# terminal sudo cannot ask for a password, so it is only tried without asking.
run_docker() {
  have docker || return 1
  docker "$@" 2> /dev/null && return 0
  have sudo || return 1
  if [ -t 0 ]; then
    sudo docker "$@" 2> /dev/null
  else
    sudo -n docker "$@" 2> /dev/null
  fi
}

if have docker; then
  container=$(run_docker ps --filter name=teletraan-web --format '{{.Names}}: {{.Status}}')
  if [ -n "$container" ]; then
    ok "Web container: $container"
  elif run_docker ps > /dev/null; then
    fail "Web container: teletraan-web is not running. See step 9 in docs/rebuilding-the-mini.md."
  else
    fail "Web container: could not ask Docker. Check that Docker is running, or try ssh -t so sudo can ask for a password."
  fi
else
  fail "Web container: the docker command is missing"
fi

# 7. The kiosk service, which is the browser on the TV
if have systemctl; then
  state=$(systemctl is-active teletraan-kiosk.service 2> /dev/null)
  if [ "$state" = active ]; then
    ok "Kiosk: teletraan-kiosk.service is active"
  else
    fail "Kiosk: teletraan-kiosk.service is ${state:-not known}"
  fi
else
  fail "Kiosk: the systemctl command is missing"
fi

# 8. The clock. The date, the countdown and the schedule all come from it.
if have timedatectl; then
  synced=$(timedatectl show -p NTPSynchronized 2> /dev/null | sed -n 's/^NTPSynchronized=//p')
  now=$(date '+%Y-%m-%d %H:%M %Z' 2> /dev/null)
  if [ "$synced" = yes ]; then
    ok "Time: the clock is in sync, now $now"
  else
    fail "Time: the clock is not in sync (now $now). See step 3 in docs/rebuilding-the-mini.md."
  fi
else
  fail "Time: the timedatectl command is missing"
fi

# 9. What is published, by type. One query returns the type of every document,
# and the counting is done here. Only published documents are asked for, so
# drafts are not counted. Sanity's own documents, like the pictures, are left
# out. The type names are not secret, and neither are the counts.
if [ -n "$project" ] && [ -n "$dataset" ] && [ -n "$version" ]; then
  answer=$(sanity_query "$cdn_host" '*[]._type')
  types=$(printf '%s' "$answer" | sed -n 's/.*"result":\[\([^]]*\)\].*/\1/p')

  if printf '%s' "$answer" | grep -q '"result":\['; then
    counts=$(printf '%s' "$types" | tr ',' '\n' | tr -d '"' | grep -v '^$' | grep -v '^sanity\.' | grep -v '^system\.' | sort | uniq -c)
    total=$(printf '%s\n' "$counts" | awk '{ sum += $1 } END { print sum + 0 }')
    ok "Documents: $total published"
    printf '%s\n' "$counts" | while read -r number name; do
      [ -n "$name" ] && printf '        %s: %s\n' "$name" "$number"
    done
  else
    fail "Documents: could not count the published documents, no usable answer from Sanity"
  fi
else
  fail "Documents: the project ID, dataset or API version is missing"
fi

if [ "$failures" -eq 0 ]; then
  echo OK
  exit 0
fi

echo FAIL
exit 1
