#!/usr/bin/env sh

if [ $# -ne 2 ]; then
    echo "No username/password provided or too many parameters passed."
    exit 1
fi

if [ "$NETHVOICE_LDAP_SCHEMA" = "rfc2307" ]; then
    exec ldapsearch \
        -x \
        -s base \
        -b "$NETHVOICE_LDAP_BASE" \
        -H "ldap://$NETHVOICE_LDAP_HOST:$NETHVOICE_LDAP_PORT" \
        -D "uid=$1,ou=People,$NETHVOICE_LDAP_BASE" \
        -w "$2" >  /dev/null
elif [ "$NETHVOICE_LDAP_SCHEMA" = "ad" ]; then
    NETHVOICE_AD_DOMAIN=$(echo "$NETHVOICE_LDAP_BASE" | sed -E 's/ *//g;s/OU=[^,]*,//Ig;s/CN=[^,]*,//Ig;s/DC=//Ig;s/,/./g')
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
