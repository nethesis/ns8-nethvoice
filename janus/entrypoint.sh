#!/bin/bash

#
# Copyright (C) 2022 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

# Change SIP plugins port
sed -i "s/\trtp_port_range = .*/\trtp_port_range = \"${RTPSTART:=10000}-${RTPEND:=20000}\"/" /usr/local/etc/janus/janus.plugin.sip.jcfg
if [[ -z ${LOCAL_IP} ]]; then
	sed -i "s/\t#local_ip = .*/\tlocal_ip = \"${LOCAL_IP}\"/" /usr/local/etc/janus/janus.plugin.sip.jcfg
	sed -i "s/\t#local_media_ip = .*/\tlocal_media_ip = \"${LOCAL_IP}\"/" /usr/local/etc/janus/janus.plugin.sip.jcfg
fi
sed -i "s/\tport = .*/\tport = \"${JANUS_TRANSPORT_PORT:=8089}\"/" /usr/local/etc/janus/janus.transport.http.jcfg

exec "$@"
