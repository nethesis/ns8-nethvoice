#!/bin/bash

# wait for asterisk to start
while [[ $(/usr/sbin/asterisk -rx 'core show version' 2>/dev/null) != Asterisk* ]]; 
    do ((++attempt<300)) || exit 2
    sleep 1
done

# Install FreePBX modules if required

# Define arrays for module management
modules_to_install=(
    framework
    soundlang
    recordings
    announcement
    manager
    arimanager
    asterisk-cli
    asteriskinfo
    filestore
    backup
    pm2
    core
    cdr
    blacklist
    bosssecretary
    bulkhandler
    calendar
    callback
    callforward
    callrecording
    callwaiting
    cel
    certman
    conferences
    customappsreg
    customcontexts
    dashboard
    daynight
    directdid
    disa
    donotdisturb
    extraoptions
    fax
    featurecodeadmin
    findmefollow
    iaxsettings
    infoservices
    ivr
    languages
    logfiles
    miscapps
    music
    nethcqr
    nethcti3
    nethdash
    nethhotel
    outroutemsg
    paging
    parking
    pin
    pm2
    queues
    queueexit
    queuemetrics
    queueoptions
    queueprio
    rapidcode
    recallonbusy
    returnontransfer
    ringgroups
    satellite
    setcid
    sipsettings
    timeconditions
    userman
    visualplan
    voicemail
    vmblast
)

obsolete_modules=(
    bulkdids
    googletts
    inboundlookup
    outboundlookup
)

# Add or remove nethhotel
if [[ -n $NETHVOICE_HOTEL && $NETHVOICE_HOTEL == 'True' ]]; then
    modules_to_install+=("nethhotel")
else
    obsolete_modules+=("nethhotel")
fi

# List installed modules ant their status
module_status=$(mktemp)
trap 'rm -f ${module_status}' EXIT
fwconsole ma list | grep '^| ' | grep -v '^| Module'| awk '{print $2,$6}' > "$module_status"

# Install required modules
for module in "${modules_to_install[@]}"; do
    if ! test -s "$module_status" || grep -q "$module " "$module_status" && ! grep -q "$module Enabled" "$module_status" ; then
        echo Installing module "$module"
        fwconsole moduleadmin install "$module"
    fi
done

# Add custom freepbx modules
for module_file in $(ls /freepbx_custom_modules); do
	module=$(echo "${module_file}" | sed 's/.tar.gz//')
	mkdir -p /var/www/html/freepbx/admin/modules/"${module}"
	tar xzpf /freepbx_custom_modules/"${module_file}" --strip-component=1 -C /var/www/html/freepbx/admin/modules/${module}
	echo Installing custom module "$module"
    fwconsole moduleadmin install "$module"
done

# Remove obsolete modules if required
for module in "${obsolete_modules[@]}"; do
    if grep -q "$module" "$module_status" ; then
        echo Removing obsolete module "$module"
        fwconsole moduleadmin uninstall "$module" &>/dev/null || true # ignore errors, we know module files are missing
    fi
done

# Fix permissions
ionice -c2 -n7 nice -n 10 fwconsole chown

# Disable signature check
php -r 'include_once "/etc/freepbx_db.conf"; $db->query("UPDATE freepbx_settings SET value = 0 WHERE keyword = \"SIGNATURECHECK\"");'

# Apply rebranding to the FreePBX admin GUI (freepbx_settings table).
# The admin GUI reads branding from freepbx_settings, which the rebranding env
# vars never touched: this keeps titles/logo/favicon in sync with the other
# surfaces (CTI, wizard, reports). Same mechanism as the wizard: external URLs
# are written verbatim, empty values fall back to the in-image defaults.
freepbx_admin_brand_name="${WIZARD_BRAND_NAME:-${BRAND_NAME:-NethVoice}}"

freepbx_admin_logo_url="${FREEPBX_ADMIN_LOGO_URL-}"
if [[ -z "${FREEPBX_ADMIN_LOGO_URL+x}" ]]; then
	freepbx_admin_logo_url="${WIZARD_LOGIN_LOGO_URL:-${LOGIN_LOGO_URL:-}}"
fi

freepbx_admin_favicon_url="${FREEPBX_ADMIN_FAVICON_URL-}"
if [[ -z "${FREEPBX_ADMIN_FAVICON_URL+x}" ]]; then
	freepbx_admin_favicon_url="${WIZARD_FAVICON_URL:-${FAVICON_URL:-}}"
fi

# Write branding via a prepared statement so quotes/apostrophes in the brand
# name cannot break the query. Logo/favicon are updated only when a non-empty
# URL is provided, otherwise the default in-image asset is preserved.
BRAND_NAME="${freepbx_admin_brand_name}" \
LOGO_URL="${freepbx_admin_logo_url}" \
FAVICON_URL="${freepbx_admin_favicon_url}" \
php -r '
include_once "/etc/freepbx_db.conf";
$brand = getenv("BRAND_NAME") ?: "NethVoice";
$logo = getenv("LOGO_URL");
$favicon = getenv("FAVICON_URL");
$set = function($keyword, $value) use ($db) {
	$sth = $db->prepare("UPDATE freepbx_settings SET value = :value WHERE keyword = :keyword");
	$sth->execute([":value" => $value, ":keyword" => $keyword]);
};
$set("BRAND_TITLE", $brand . " Administration");
$set("DASHBOARD_FREEPBX_BRAND", $brand);
$set("BRAND_FREEPBX_ALT_LEFT", $brand);
if ($logo !== false && $logo !== "") { $set("BRAND_IMAGE_TANGO_LEFT", $logo); }
if ($favicon !== false && $favicon !== "") { $set("BRAND_IMAGE_FAVICON", $favicon); }
'

# Sync users
fwconsole userman --syncall --force --verbose

# Always apply changes on start
su asterisk -s /bin/sh -c "/var/lib/asterisk/bin/fwconsole reload"

# Apply low-priority background DB updates
ionice -c3 nice -n 19 php /initdb.d/slow_database_updates.php >/dev/null 2>&1 &
