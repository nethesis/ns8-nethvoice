#!/bin/bash

# wait for asterisk to start
while [[ $(/usr/sbin/asterisk -rx 'core show version' 2>/dev/null) != Asterisk* ]]; 
    do ((++attempt<30)) || exit 2
    sleep 1
done

# Install FreePBX modules if required
module_status=$(mktemp)
trap 'rm -f ${module_status}' EXIT
fwconsole ma list | grep '^| ' | grep -v '^| Module'| awk '{print $2,$6}' > $module_status
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
        bulkdids \
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
        inboundlookup \
        infoservices \
        ivr \
        languages \
        logfiles \
        miscapps \
        music \
        nethcqr \
        nethcti3 \
        nethdash \
        outboundlookup \
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

# Disable signature check
php -r 'include_once "/etc/freepbx_db.conf"; $db->query("UPDATE freepbx_settings SET value = 0 WHERE keyword = \"SIGNATURECHECK\"");'

# Sync users
fwconsole userman --syncall --force --verbose

# Always apply changes on start
su - asterisk -s /bin/sh -c "/var/lib/asterisk/bin/fwconsole reload"