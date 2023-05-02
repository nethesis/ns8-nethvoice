#!/usr/bin/env sh

#
# Copyright (C) 2023 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

set -e

if [ $# -ne 2 ]; then
    echo "No username/password provided or too many parameters passed."
    exit 1
fi

ldap_schema=${NETHVOICE_LDAP_SCHEMA:?No LDAP schema provided.}

if [ "$ldap_schema" = "rfc2307" ]; then
    exec ldapsearch \
        -x \
        -s base \
        -b "$NETHVOICE_LDAP_BASE" \
        -H "ldap://$NETHVOICE_LDAP_HOST:$NETHVOICE_LDAP_PORT" \
        -D "uid=$1,ou=People,$NETHVOICE_LDAP_BASE" \
        -w "$2" >  /dev/null
elif [ "$ldap_schema" = "ad" ]; then
    NETHVOICE_AD_DOMAIN=$(echo "$NETHVOICE_LDAP_USER" | sed 's/.*@\(.*\)/\1/')
    exec ldapsearch \
        -x \
        -s base \
        -b "$NETHVOICE_LDAP_BASE" \
        -H "ldap://$NETHVOICE_LDAP_HOST:$NETHVOICE_LDAP_PORT" \
        -D "$1@$NETHVOICE_AD_DOMAIN" \
        -w "$2" > /dev/null
else
    echo "Unknown LDAP schema"
    exit 1
fi
