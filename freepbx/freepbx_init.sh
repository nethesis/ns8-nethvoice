#!/bin/bash

# wait for asterisk to start
while [[ $(/usr/sbin/asterisk -rx 'core show version' 2>/dev/null) != Asterisk* ]]; 
    do ((++attempt<300)) || exit 2
    sleep 1
done

# Install FreePBX modules if required
module_status=$(mktemp)
trap 'rm -f ${module_status}' EXIT
fwconsole ma list | grep '^| ' | grep -v '^| Module'| awk '{print $2,$6}' > "$module_status"
for module in \
    framework \
    soundlang \
    recordings \
    announcement \
    manager \
    arimanager \
    asteriskinfo \
    filestore \
    backup \
    pm2 \
    core \
    cdr \
    blacklist \
    bosssecretary \
    bulkhandler \
    calendar \
    callback \
    callforward \
    callrecording \
    callwaiting \
    cel \
    certman \
    conferences \
    customappsreg \
    customcontexts \
    dashboard \
    daynight \
    directdid \
    disa \
    donotdisturb \
    extraoptions \
    fax \
    featurecodeadmin \
    findmefollow \
    googletts \
    iaxsettings \
    infoservices \
    ivr \
    languages \
    logfiles \
    miscapps \
    music \
    nethcqr \
    nethcti3 \
    nethdash \
    outroutemsg \
    paging \
    parking \
    pin \
    pm2 \
    queues \
    queueexit \
    queuemetrics \
    queueoptions \
    queueprio \
    rapidcode \
    recallonbusy \
    returnontransfer \
    ringgroups \
    setcid \
    sipsettings \
    timeconditions \
    userman \
    visualplan \
    voicemail \
    vmblast
do
    if ! test -s "$module_status" || grep -q "$module " "$module_status" && ! grep -q "$module Enabled" "$module_status" ; then
        echo Installing module $module
        fwconsole moduleadmin install $module
    fi
done

# Remove obsolete modules if required
for module in \
    bulkdids \
    inboundlookup \
    outboundlookup
do
    if grep -q "$module" "$module_status" ; then
        echo Removing obsolete module $module
        fwconsole moduleadmin uninstall $module &>/dev/null || true # ignore errors, we know module files are missing
    fi
done

# install custom freepbx modules
for module_file in $(ls /freepbx_custom_modules); do
	module=$(echo ${module_file} | sed 's/.tar.gz//')
	mkdir -p /var/www/html/freepbx/admin/modules/${module}
	tar xzpf /freepbx_custom_modules/${module_file} --strip-component=1 -C /var/www/html/freepbx/admin/modules/${module}
	fwconsole moduleadmin install $module
done

# Fix permissions
fwconsole chown

# Disable signature check
php -r 'include_once "/etc/freepbx_db.conf"; $db->query("UPDATE freepbx_settings SET value = 0 WHERE keyword = \"SIGNATURECHECK\"");'

# Sync users
fwconsole userman --syncall --force --verbose

# Always apply changes on start
su asterisk -s /bin/sh -c "/var/lib/asterisk/bin/fwconsole reload"
