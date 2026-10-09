#!/bin/bash

#
# Copyright (C) 2022 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

# Tag all output, including JANUS_PRINT and library messages that bypass
# Janus's configured logger. Keep already prefixed messages unchanged.
# Process substitution lets Janus remain PID 1 and receive signals directly.
exec > >(sed -u '/^\[janus\] /!s/^/[janus] /') 2>&1

# Change SIP plugins port
if [[ ! -z ${LOCAL_IP} ]]; then
	sed -i "s/\t#local_ip = .*/\tlocal_ip = \"${LOCAL_IP}\"/" /usr/local/etc/janus/janus.plugin.sip.jcfg
	sed -i "s/\t#local_media_ip = .*/\tlocal_media_ip = \"${LOCAL_IP}\"/" /usr/local/etc/janus/janus.plugin.sip.jcfg
fi
sed -i "s/\tport = .*/\tport = \"${JANUS_TRANSPORT_PORT:=8089}\"/" /usr/local/etc/janus/janus.transport.http.jcfg

exec "$@"
