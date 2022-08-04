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
    
touch /etc/asterisk/manager_additional.conf
touch /etc/asterisk/manager_custom.conf

cd /var/lib/asterisk
/usr/sbin/asterisk -f -C /etc/asterisk/asterisk.conf
