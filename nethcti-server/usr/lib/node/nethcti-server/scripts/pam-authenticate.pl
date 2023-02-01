#!/bin/bash
source /usr/lib/node/nethcti-server/scripts/nethcti_env
string="$(cat -)"

arr=()
mapfile -t arr <<< "$string"

username=${arr[0]}
password=${arr[1]}

exec ldapsearch -x -s base \
	-b "$(echo $LDAP_CONF | jq -r .base_dn)" \
	-H "ldap://$(echo $LDAP_CONF | jq -r .host):$(echo $LDAP_CONF | jq -r .port)" \
	-D "uid=${username},ou=People,$(echo $LDAP_CONF | jq -r .base_dn)" \
	-w "${password}" >/dev/null
