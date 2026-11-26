#!/bin/bash

#
# Copyright (C) 2022 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

# Tag all output, including JANUS_PRINT and library messages that bypass
# Janus's configured logger. Keep already prefixed messages unchanged.
# Process substitution lets Janus remain PID 1 and receive signals directly.
exec > >(
	unset JANUS_ADMIN_SECRET
	exec sed -u '/^\[janus\] /!s/^/[janus] /'
) 2>&1

# Change SIP plugins port
if [[ ! -z ${LOCAL_IP} ]]; then
	sed -i "s/\t#local_ip = .*/\tlocal_ip = \"${LOCAL_IP}\"/" /usr/local/etc/janus/janus.plugin.sip.jcfg
	sed -i "s/\t#local_media_ip = .*/\tlocal_media_ip = \"${LOCAL_IP}\"/" /usr/local/etc/janus/janus.plugin.sip.jcfg
fi
# SIP plugin RTP ports towards Asterisk, inside the instance UDP block
if [[ -n ${JANUS_SIP_RTPSTART} && -n ${JANUS_SIP_RTPEND} ]]; then
	sed -i "s/\trtp_port_range = .*/\trtp_port_range = \"${JANUS_SIP_RTPSTART}-${JANUS_SIP_RTPEND}\"/" /usr/local/etc/janus/janus.plugin.sip.jcfg
fi
sed -i "s/\tport = .*/\tport = \"${JANUS_TRANSPORT_PORT:=8089}\"/" /usr/local/etc/janus/janus.transport.http.jcfg

set_admin_key() (
	local config=$1 temporary
	[[ -f $config && ! -L $config ]] || return 1
	temporary=$(mktemp -- "$config.XXXXXX") || return 1
	trap 'rm -f -- "$temporary"' EXIT

	# Match the sample setting and the active setting written by permanent saves.
	awk '
		tolower($0) ~ /^[[:blank:]]*#?[[:blank:]]*admin_key[[:blank:]]*=[[:blank:]]*"[^"]*"[[:blank:]]*;?[[:blank:]]*(#.*|\/\/.*)?$/ {
			print "\tadmin_key = \"" ENVIRON["JANUS_ADMIN_SECRET"] "\";"
			updated++
			next
		}
		{ print }
		END { exit(updated != 1) }
	' "$config" > "$temporary" || return 1

	chmod 600 "$temporary" && mv -fT -- "$temporary" "$config"
)

# Janus dumps the plugin configuration at LOG_VERB (5). The bundled default
# is 3; also check explicit overrides, including GLib's grouped short options.
check_keyed_log_level() {
	local level=3
	while (( $# )); do
		case $1 in
			--) break ;;
			--debug-level=*) level=${1#*=} ;;
			--debug-level|-d*|-[!-]*d*) shift; level=$1 ;;
			*) shift; continue ;;
		esac
		[[ $level == [0-7] ]] || return 1
		shift
	done
	if [[ $level == [5-7] ]]; then
		echo "WARNING: Janus debug level $level can expose the plugin admin_key in logs" >&2
	fi
	return 0
}

if [[ -v JANUS_ADMIN_SECRET ]]; then
	if [[ -z $JANUS_ADMIN_SECRET || $JANUS_ADMIN_SECRET == *[!abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789]* ]]; then
		echo "JANUS_ADMIN_SECRET must be non-empty and contain only ASCII letters and digits" >&2
		exit 1
	fi
	if [[ ${1##*/} == janus ]] && ! check_keyed_log_level "${@:2}"; then
		echo "Janus debug level must be 0 through 7 when JANUS_ADMIN_SECRET is set" >&2
		exit 1
	fi
	# Permanent saves can recreate a config. Keep newly created files private.
	umask 077
	for plugin in audiobridge textroom streaming; do
		config="/usr/local/etc/janus/janus.plugin.$plugin.jcfg"
		if ! LC_ALL=C set_admin_key "$config"; then
			echo "Cannot set admin_key in $config" >&2
			exit 1
		fi
	done
	unset JANUS_ADMIN_SECRET
fi

exec "$@"
