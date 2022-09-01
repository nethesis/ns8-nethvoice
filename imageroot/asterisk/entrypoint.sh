#!/bin/bash

#
# Copyright (C) 2022 Nethesis S.r.l.
# http://www.nethesis.it - nethserver@nethesis.it
#
# This script is part of NethServer.
#
# NethServer is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License,
# or any later version.
#
# NethServer is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with NethServer.  If not, see COPYING.
#

# initialize modules.conf
if [[ ! -f /etc/asterisk/modules.conf ]]; then
    cat > /etc/asterisk/modules.conf <<EOF
[modules]
autoload=no
EOF
fi

if [[ ! -f /etc/asterisk/asterisk.conf ]]; then
	# Configure asterisk
	cat > /etc/asterisk/asterisk.conf <<EOF
[directories]
astetcdir=/etc/asterisk
astmoddir=/usr/lib64/asterisk/modules
astvarlibdir=/var/lib/asterisk
astagidir=/var/lib/asterisk/agi-bin
astspooldir=/var/spool/asterisk
astrundir=/var/run/asterisk
astlogdir=/var/log/asterisk
[options]
transmit_silence_during_record=yes<F6>
languageprefix=yes
execincludes=yes
dontwarn=yes
[files]
astctlpermissions=775
[modules]
autoload=yes
EOF
fi

if [[ ! -f /etc/asterisk/manager.conf ]]; then
        # Configure asterisk manager
        cat > /etc/asterisk/manager.conf <<EOF
[general]
enabled = yes
port = ${ASTMANAGERPORT:-5038}
bindaddr = 0.0.0.0
displayconnects=no

[${AMPMGRUSER}]
secret = ${AMPMGRPASS}
deny=0.0.0.0/0.0.0.0
permit=127.0.0.1/255.255.255.0
read = system,call,log,verbose,command,agent,user,config,command,dtmf,reporting,cdr,dialplan,originate,message
write = system,call,log,verbose,command,agent,user,config,command,dtmf,reporting,cdr,dialplan,originate,message
writetimeout = 5000
EOF
fi

cd /var/lib/asterisk
/usr/sbin/asterisk -f -C /etc/asterisk/asterisk.conf

# populate /var/spool/asterisk if it's needed

mkdir -p /var/spool/asterisk/tmp
mkdir -p /var/spool/asterisk/voicemail
mkdir -p /var/spool/asterisk/voicemail/default
mkdir -p /var/spool/asterisk/fax
mkdir -p /var/spool/asterisk/monitor
mkdir -p /var/spool/asterisk/cache
mkdir -p /var/spool/asterisk/outgoing
mkdir -p /var/spool/asterisk/uploads
chmod o+w /var/spool/asterisk/* 
