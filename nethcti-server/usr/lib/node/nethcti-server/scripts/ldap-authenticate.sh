#!/usr/bin/env sh

if [ $# -ne 2 ]; then
    echo "No username/password provided or too many parameters passed."
    exit 1
fi

exec ldapsearch \
    -x \
    -s base \
    -b "$NETHVOICE_LDAP_BASE" \
    -H "ldap://$NETHVOICE_LDAP_HOST:$NETHVOICE_LDAP_PORT" \
    -D "uid=$1,ou=People,$NETHVOICE_LDAP_BASE" \
    -w "$2" > /dev/null
