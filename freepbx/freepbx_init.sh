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
    googletts
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

# Re-apply the allocated service ports.
# Installing the iaxsettings/sipsettings modules above reseeds their tables and
# drops the ports injected at DB init (mariadb 70_asterisk_ports.sh). We must
# restore them BEFORE the reload below: a `fwconsole reload` does not rebind an
# already-loaded PJSIP transport, so the transport has to be generated with the
# correct port on the first reload to avoid a restart. Ports come from the
# container environment (ASTERISK_*). kvstore_Sipsettings rows are managed by
# the module and only UPDATEd to avoid inserting a duplicate under a mismatched
# `id` (UNIQUE(`key`,`id`)).
php <<'PHP'
<?php
include_once "/etc/freepbx_db.conf";
$iax    = (int) getenv("ASTERISK_IAX_PORT");
$sipudp = (int) getenv("ASTERISK_SIP_UDP_PORT");
$siptcp = (int) getenv("ASTERISK_SIP_PORT");
$sips   = (int) getenv("ASTERISK_SIPS_PORT");
$rtps   = (int) getenv("ASTERISK_RTPSTART");
$rtpe   = (int) getenv("ASTERISK_RTPEND");
$astmgr = (int) getenv("ASTMANAGERPORT");
if ($iax && $sipudp && $siptcp && $sips && $rtps && $rtpe) {
    $db->query("INSERT INTO `iaxsettings` (`keyword`,`data`,`seq`,`type`) VALUES ('bindport','$iax',1,0) ON DUPLICATE KEY UPDATE `data`=VALUES(`data`)");
    $db->query("INSERT INTO `sipsettings` (`keyword`,`data`,`seq`,`type`) VALUES ('rtpstart','$rtps',0,0),('rtpend','$rtpe',0,0),('bindport','$sipudp',1,0) ON DUPLICATE KEY UPDATE `data`=VALUES(`data`)");
    $db->query("UPDATE `kvstore_Sipsettings` SET `val` = CASE `key` WHEN 'udpport-0.0.0.0' THEN '$sipudp' WHEN 'tcpport-0.0.0.0' THEN '$siptcp' WHEN 'tlsport-0.0.0.0' THEN '$sips' WHEN 'bindport' THEN '$siptcp' WHEN 'tlsbindport' THEN '$sips' WHEN 'rtpstart' THEN '$rtps' WHEN 'rtpend' THEN '$rtpe' END WHERE `key` IN ('udpport-0.0.0.0','tcpport-0.0.0.0','tlsport-0.0.0.0','bindport','tlsbindport','rtpstart','rtpend')");
    if ($astmgr) {
        $db->query("INSERT INTO `freepbx_settings` (`keyword`,`value`,`name`,`level`,`description`,`type`,`options`,`defaultval`,`readonly`,`hidden`,`category`,`module`,`emptyok`,`sortorder`) VALUES ('ASTMANAGERPORT','$astmgr','Asterisk Manager Port',2,'Port for the Asterisk Manager','int','1024,65535','$astmgr',1,0,'Asterisk Manager','',0,0) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`), `defaultval`=VALUES(`defaultval`)");
    }
}
PHP

# Sync users
fwconsole userman --syncall --force --verbose

# Always apply changes on start
su asterisk -s /bin/sh -c "/var/lib/asterisk/bin/fwconsole reload"

# Apply low-priority background DB updates
ionice -c3 nice -n 19 php /initdb.d/slow_database_updates.php >/dev/null 2>&1 &

