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

# Change SIP plugins port
sed -i "s/\trtp_port_range = .*/\trtp_port_range = \"${RTPSTART:=10000}-${RTPEND:=20000}\"/" /usr/local/etc/janus/janus.plugin.sip.jcfg
if [[ -z ${LOCAL_IP} ]]; then
	sed -i "s/\t#local_ip = .*/\tlocal_ip = \"${LOCAL_IP}\"/" /usr/local/etc/janus/janus.plugin.sip.jcfg
	sed -i "s/\t#local_media_ip = .*/\tlocal_media_ip = \"${LOCAL_IP}\"/" /usr/local/etc/janus/janus.plugin.sip.jcfg
fi
sed -i "s/\tport = .*/\tport = \"${JANUS_TRANSPORT_PORT:=8089}\"/" /usr/local/etc/janus/janus.transport.http.jcfg

exec "$@"
