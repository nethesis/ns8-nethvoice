#!/bin/bash
string="$(cat -)"

arr=()
mapfile -t arr <<< "$string"

username=${arr[0]}
password=${arr[1]}

ldap_conf=$(runagent python3 -magent.ldapproxy | cut -d "{" -f 2 | echo "{$(cat -)" | tr "'" '"')

exec ldapsearch -x -s base \
	-b "$(echo $ldap_conf | jq -r .base_dn)" \
	-H "ldap://$(echo $ldap_conf | jq -r .host):$(echo $ldap_conf | jq -r .port)" \
	-D "uid=${username},ou=People,$(echo $ldap_conf | jq -r .base_dn)" \
	-w "${password}" >/dev/null

