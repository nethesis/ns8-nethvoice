#!/bin/bash

cat <<EOF > /etc/flexisip/flexisip.conf
[global]
default-servers=proxy
enable-snmp=false
log-directory=/var/log
log-level=warning
transports=sips:${NETHVOICE_HOST}:${FLEXISIP_PORT};maddr=0.0.0.0;tls-verify-outgoing=0

aliases=localhost,${NETHVOICE_HOST}
udp-mtu=4000
tls-certificates-dir=/etc/flexisip/tls/
require-peer-certificate=false

[cluster]
enabled=false

[mdns-register]
enabled=false

[event-logs]

[stun-server]
enabled=false
bind-address=0.0.0.0
port=3478

[presence-server]
enabled=false
long-term-enabled=false

[conference-server]
enabled=false

[module::DoSProtection]
enabled=false

[module::SanityChecker]
enabled=true

[module::GarbageIn]
enabled=false

[module::NatHelper]
enabled=true

[module::Authentication]
enabled=false
reject-wrong-client-certificates=false
db-implementation=file
file-path=/etc/flexisip/users.db.txt

[module::Redirect]

[module::Presence]
enabled=false

[module::Registrar]
enabled=true
reg-domains=*
reg-on-response=true
max-expires=604800
db-implementation=redis
redis-server-port=${REDIS_PORT}

[module::StatisticsCollector]
enabled=false

[module::Router]
enabled=true
filter=(is_request && request.uri.params contains 'doroute') || is_response
fork-late=true

[module::PushNotification]
enabled=true
timeout = 0
apple=false
firebase=false
windowsphone=false
display-from-uri=true
external-push-uri=http://127.0.0.1:${APACHE_PORT}/push-proxy/index.php?type=\$type&from=\$from-uri&callid=\$call-id&to=\$to-uri&caller=\$from-name&loglevel=debug

[module::MediaRelay]
enabled=false
sdp-port-range-min=10000
sdp-port-range-max=20000
prevent-loops=false

[module::Transcoder]
enabled=false

[module::Forward]
enabled=true
filter=
route=<sip:192.168.5.211:5062;transport=tcp>
add-path=true
rewrite-req-uri=false
default-transport=
params-to-remove=pn-tok pn-type app-id pn-msg-str pn-call-str pn-call-snd pn-msg-snd pn-timeout pn-silent pn-provider pn-prid pn-param

[inter-domain-connections]

[module::ContactRouteInserter]
enabled=true
masquerade-contacts-on-registers=true
masquerade-contacts-for-invites=false
insert-domain=true
EOF

cat <<EOF > /etc/asterisk/nethcti_push_configuration.json
{
    "NotificationServerURL": "https://pp.nethesis.it/NotificaPush",
    "Host": ""${NETHVOICE_HOST},
    "SystemId": "${SUBSCRIPTION_SYSTEMID}",
    "Secret": "${SUBSCRIPTION_SECRET}",
    "AppBrandingID" : "${BRAND_APPID}"
}
EOF

exec "$@"
