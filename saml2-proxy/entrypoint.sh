#!/bin/bash

#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

#
# Render the Shibboleth SP + Apache configuration from the SP_* env vars
# (see imageroot/systemd/user/saml2-proxy.service) and start shibd + apache.
#
set -e

: "${SP_HOST:?SP_HOST is required}"
SP_PORT="${SP_PORT:-20090}"
SP_IDENTITY_ATTRIBUTE="${SP_IDENTITY_ATTRIBUTE:-uid}"
SP_ENTITY_ID="https://${SP_HOST}/shibboleth"
export SP_HOST SP_PORT SP_IDENTITY_ATTRIBUTE SP_ENTITY_ID

state_dir=/var/lib/saml2-proxy
mkdir -p "${state_dir}" /run/shibboleth

# Per-install SP key pair, generated on first start and persisted in the state
# volume: never baked into the image, so every installation gets its own.
if [ ! -s "${state_dir}/sp-key.pem" ]; then
    shib-keygen -f -o "${state_dir}" -h "${SP_HOST}" -y 10 -e "${SP_ENTITY_ID}"
fi
# keys stay owned by container root (= the module user on the host, so
# extract-image can chown them on update); shibd runs as root and reads them
chown root:root "${state_dir}/sp-key.pem" "${state_dir}/sp-cert.pem"
chmod 600 "${state_dir}/sp-key.pem"

# Fetch the IdP metadata, resolving local Traefik hosts to 127.0.0.1 (hairpin
# NAT); a fetch failure falls back to the cached copy of a previous start.
: "${SP_IDP_METADATA_URL:?SP_IDP_METADATA_URL is required}"
idp_host=$(echo "${SP_IDP_METADATA_URL}" | sed -E 's|^[a-z]+://([^/:]+).*|\1|')
curl_opts=(-fsS --max-time 20)
for local_host in ${SP_RESOLVE_LOCAL_HOSTS}; do
    if [ "${idp_host}" == "${local_host}" ]; then
        curl_opts+=(--resolve "${idp_host}:443:127.0.0.1")
    fi
done
if curl "${curl_opts[@]}" -o "${state_dir}/idp-metadata.xml.new" "${SP_IDP_METADATA_URL}"; then
    mv "${state_dir}/idp-metadata.xml.new" "${state_dir}/idp-metadata.xml"
else
    echo "warning: IdP metadata fetch failed, using the cached copy if any" >&2
fi
if [ ! -s "${state_dir}/idp-metadata.xml" ]; then
    echo "error: no IdP metadata available" >&2
    exit 1
fi

# the SSO SessionInitiator needs an explicit default IdP entityID
SP_IDP_ENTITY_ID=$(sed -n 's/.*entityID="\([^"]*\)".*/\1/p' "${state_dir}/idp-metadata.xml" | head -1)
export SP_IDP_ENTITY_ID
if [ -z "${SP_IDP_ENTITY_ID}" ]; then
    echo "error: could not read entityID from the IdP metadata" >&2
    exit 1
fi

# attribute-map: map the identity attribute to REMOTE_USER whether the IdP
# releases it by friendly name, by common NameFormats or by OID
case "${SP_IDENTITY_ATTRIBUTE}" in
    uid) oid=0.9.2342.19200300.100.1.1 ;;
    mail | email) oid=0.9.2342.19200300.100.1.3 ;;
    eppn | eduPersonPrincipalName) oid=1.3.6.1.4.1.5923.1.1.1.6 ;;
    displayName) oid=2.16.840.1.113730.3.1.241 ;;
    cn) oid=2.5.4.3 ;;
    sn) oid=2.5.4.4 ;;
    givenName) oid=2.5.4.42 ;;
    *) oid= ;;
esac
SP_ATTRIBUTE_MAP_ENTRIES="  <Attribute name=\"${SP_IDENTITY_ATTRIBUTE}\" id=\"${SP_IDENTITY_ATTRIBUTE}\"/>
  <Attribute name=\"${SP_IDENTITY_ATTRIBUTE}\" id=\"${SP_IDENTITY_ATTRIBUTE}\" nameFormat=\"urn:oasis:names:tc:SAML:2.0:attrname-format:basic\"/>
  <Attribute name=\"${SP_IDENTITY_ATTRIBUTE}\" id=\"${SP_IDENTITY_ATTRIBUTE}\" nameFormat=\"urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified\"/>"
if [ -n "${oid}" ]; then
    SP_ATTRIBUTE_MAP_ENTRIES+=$'\n'"  <Attribute name=\"urn:oid:${oid}\" id=\"${SP_IDENTITY_ATTRIBUTE}\"/>"
fi
export SP_ATTRIBUTE_MAP_ENTRIES

# scoped attribute filter: permit ONLY the identity attribute (never a
# wildcard), optionally constraining its value with the configured regex
if [ -n "${SP_IDENTITY_VALUE_REGEX}" ]; then
    export SP_VALUE_RULE="<afp:PermitValueRule xsi:type=\"basic:AttributeValueRegex\" regex=\"${SP_IDENTITY_VALUE_REGEX}\"/>"
else
    export SP_VALUE_RULE='<afp:PermitValueRule xsi:type="basic:ANY"/>'
fi

# anti-TOFU hardening: when the IdP signing certificate is provided, verify the
# IdP metadata signature instead of trusting whatever was fetched
if [ -n "${SP_IDP_SIGNING_CERT_B64}" ]; then
    echo "${SP_IDP_SIGNING_CERT_B64}" | base64 -d > /etc/shibboleth/idp-signing.crt
    export SP_METADATA_PROVIDER="<MetadataProvider type=\"XML\" validate=\"true\" path=\"${state_dir}/idp-metadata.xml\">
            <MetadataFilter type=\"Signature\" certificate=\"idp-signing.crt\"/>
        </MetadataProvider>"
else
    export SP_METADATA_PROVIDER="<MetadataProvider type=\"XML\" validate=\"true\" path=\"${state_dir}/idp-metadata.xml\"/>"
fi

# Render the configuration in place (only listed variables are substituted);
# podman run --replace always restarts from the pristine image files.
subst='$SP_HOST $SP_PORT $SP_ENTITY_ID $SP_IDP_ENTITY_ID $SP_IDENTITY_ATTRIBUTE
       $SP_ATTRIBUTE_MAP_ENTRIES $SP_VALUE_RULE $SP_METADATA_PROVIDER'
render() {
    envsubst "${subst}" < "$1" > "$1.rendered"
    mv "$1.rendered" "$1"
}
render /etc/shibboleth/shibboleth2.xml
render /etc/shibboleth/attribute-map.xml
render /etc/shibboleth/attribute-policy.xml
render /etc/apache2/sites-available/000-default.conf

# tiny static body so /sso-auth returns 200 (the identity travels in the
# Remote-User response header set by the vhost, not in the body)
echo ok > /var/www/html/authcheck

# start shibd (mod_shib talks to it over the unix socket), then apache in
# foreground as the container main process
shibd -f -w 30 &
source /etc/apache2/envvars
exec apache2 -D FOREGROUND
