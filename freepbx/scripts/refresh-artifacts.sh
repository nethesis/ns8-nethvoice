#!/usr/bin/env bash
# Helper to discover the latest release/17.X tag for each FreePBX module
# (or latest tag for Nethesis forks that have no 17.x), download the tarball,
# compute SHA256, and emit:
#   - install_module lines for Containerfile (stdout, prefix "CF: ")
#   - remote-artifacts.sha256 entries (stdout, prefix "SHA: ")
#
# Usage: bash refresh-artifacts.sh [cache-dir]
#
# Modules table: name<TAB>github_repo<TAB>tag_pattern
#   tag_pattern:
#     "17"      = latest release/17.X[.X.X] tag
#     "latest"  = newest tag overall
#     "explicit:<tag>" = use this tag literally

set -euo pipefail

CACHE="${1:-/tmp/fpbx-artifacts}"
mkdir -p "$CACHE"

# token usage: export GH_TOKEN=... to raise rate limit
AUTH_HEADER=()
if [[ -n "${GH_TOKEN:-}" ]]; then
  AUTH_HEADER=(-H "Authorization: Bearer ${GH_TOKEN}")
fi

# Each line: alias repo selector
MODULES=$(cat <<'EOF'
announcement       FreePBX/announcement                17
arimanager         FreePBX/arimanager                  17
asterisk-cli       FreePBX/asterisk-cli                17
asteriskinfo       FreePBX/asteriskinfo                17
backup             FreePBX/backup                      17
blacklist          FreePBX/blacklist                   17
bulkhandler        FreePBX/bulkhandler                 17
calendar           FreePBX/calendar                    17
callback           FreePBX/callback                    17
callforward        FreePBX/callforward                 17
callrecording      FreePBX/callrecording               17
callwaiting        FreePBX/callwaiting                 17
cdr                FreePBX/cdr                         17
cel                FreePBX/cel                         17
certman            FreePBX/certman                     17
conferences        FreePBX/conferences                 17
customappsreg      FreePBX/customappsreg               17
daynight           FreePBX/daynight                    17
dashboard          FreePBX/dashboard                   17
disa               FreePBX/disa                        17
donotdisturb       FreePBX/donotdisturb                17
fax                FreePBX/fax                         17
featurecodeadmin   FreePBX/featurecodeadmin            17
filestore          FreePBX/filestore                   17
findmefollow       FreePBX/findmefollow                17
framework          FreePBX/framework                   17
iaxsettings        FreePBX/iaxsettings                 17
infoservices       FreePBX/infoservices                17
ivr                FreePBX/ivr                         17
languages          FreePBX/languages                   17
logfiles           FreePBX/logfiles                    17
manager            FreePBX/manager                     17
miscapps           FreePBX/miscapps                    17
music              FreePBX/music                       17
outroutemsg        FreePBX/outroutemsg                 17
parking            FreePBX/parking                     17
pm2                FreePBX/pm2                         latest
queueprio          FreePBX/queueprio                   17
ringgroups         FreePBX/ringgroups                  17
setcid             FreePBX/setcid                      17
sipsettings        FreePBX/sipsettings                 17
soundlang          FreePBX/soundlang                   17
timeconditions     FreePBX/timeconditions              17
userman            FreePBX/userman                     17
vmblast            FreePBX/vmblast                     17
bosssecretary      nethesis/freepbx-bosssecretary      latest
core               FreePBX/core                        17
customcontexts     nethesis/freepbx-customcontexts     latest
directdid          nethesis/directdid                  latest
extraoptions       nethesis/freepbx-extraoptions       latest
nethdash           nethesis/nethdash                   latest
paging             FreePBX/paging                      17
queueexit          nethesis/queueexit                  latest
queuemetrics       nethesis/queuemetrics               latest
queues             FreePBX/queues                      17
rapidcode          nethesis/RapidCode                  latest
recordings         FreePBX/recordings                  17
returnontransfer   nethesis/returnontransfer           latest
voicemail          FreePBX/voicemail                   17
EOF
)

api() {
  local path="$1"
  curl -fsSL "${AUTH_HEADER[@]}" -H "Accept: application/vnd.github+json" \
    "https://api.github.com/${path}"
}

# Find tag matching selector
find_tag() {
  local repo="$1" sel="$2"
  case "$sel" in
    explicit:*)
      echo "${sel#explicit:}"
      ;;
    17)
      api "repos/${repo}/tags?per_page=100" \
        | jq -r '.[].name' \
        | grep -E '^release/17(\.|$)' \
        | sort -V | tail -1
      ;;
    latest)
      # First try tag list (handles non-conventional tags like "1.0.1")
      api "repos/${repo}/tags?per_page=10" \
        | jq -r '.[0].name'
      ;;
  esac
}

# Build a tag → tarball URL
tarball_url() {
  local repo="$1" tag="$2"
  echo "https://github.com/${repo}/archive/refs/tags/${tag}.tar.gz"
}

# Derive a short "version" string and an artifact filename matching the
# pattern used in remote-artifacts.sha256 and Containerfile ("<alias>-<ver>.tar.gz")
version_from_tag() {
  local tag="$1"
  # strip "release/ns8/" prefix or "release/" prefix
  local v="${tag#release/ns8/}"
  v="${v#release/}"
  echo "$v"
}

declare -A RESULT_VERSION RESULT_URL RESULT_SHA

for line in $MODULES; do :; done  # avoid unused warning

while IFS= read -r row; do
  [[ -z "$row" ]] && continue
  alias=$(awk '{print $1}' <<<"$row")
  repo=$(awk '{print $2}' <<<"$row")
  sel=$(awk '{print $3}' <<<"$row")

  echo "==> ${alias} (${repo} :: ${sel})" >&2

  tag=$(find_tag "$repo" "$sel" || true)
  if [[ -z "$tag" || "$tag" == "null" ]]; then
    echo "    !! no tag found" >&2
    continue
  fi
  ver=$(version_from_tag "$tag")
  url=$(tarball_url "$repo" "$tag")
  artifact="${alias}-${ver}.tar.gz"
  cache_path="${CACHE}/${artifact}"

  if [[ ! -s "$cache_path" ]]; then
    echo "    downloading ${url}" >&2
    curl -fsSL -o "$cache_path" "$url"
  fi

  sha=$(sha256sum "$cache_path" | awk '{print $1}')

  echo "    tag=${tag} ver=${ver} sha=${sha}" >&2
  RESULT_VERSION[$alias]="$ver"
  RESULT_URL[$alias]="$url"
  RESULT_SHA[$alias]="$sha"
done <<< "$MODULES"

echo
echo "===== install_module lines ====="
while IFS= read -r row; do
  [[ -z "$row" ]] && continue
  alias=$(awk '{print $1}' <<<"$row")
  [[ -n "${RESULT_URL[$alias]:-}" ]] || continue
  echo "CF: 	install_module ${alias} ${RESULT_URL[$alias]} && \\"
done <<< "$MODULES"

echo
echo "===== remote-artifacts.sha256 entries ====="
while IFS= read -r row; do
  [[ -z "$row" ]] && continue
  alias=$(awk '{print $1}' <<<"$row")
  ver=${RESULT_VERSION[$alias]:-}
  sha=${RESULT_SHA[$alias]:-}
  [[ -n "$ver" && -n "$sha" ]] || continue
  echo "SHA: ${sha}  ${alias}-${ver}.tar.gz"
done <<< "$MODULES"
