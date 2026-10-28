#!/usr/bin/env bash
# Run inside a disposable FreePBX image with networking disabled.
set -euo pipefail
export NETHVOICE_RECIPIENT_SERVICE_PORT=31043
export VOICE_AGENT_RECIPIENT_TOKEN=synthetic-recipient-key-000000000000000000
# Run the listener's real configuration block without initializing a PBX.
sed -n '/# Reuse Apache/,/^# Don.t continue/p' /entrypoint > /tmp/recipient-listener.sh
bash /tmp/recipient-listener.sh
source /etc/apache2/envvars
apache2 -t
apache2ctl start
php -d zend.assertions=1 -d assert.exception=1 <<'PHP'
<?php
function checkRecipientRequest($method, $path, $token, $status, $error) {
    $context=stream_context_create(['http'=>['method'=>$method,'ignore_errors'=>true,
        'header'=>'Authorization: Bearer '.$token, 'timeout'=>5]]);
    $body=file_get_contents('http://127.0.0.1:31043'.$path,false,$context);
    assert(strpos($http_response_header[0], ' '.$status.' ')!==false);
    assert(json_decode($body,true)===['error'=>$error]);
    assert(in_array('Cache-Control: no-store',$http_response_header,true));
}
$token=getenv('VOICE_AGENT_RECIPIENT_TOKEN');
checkRecipientRequest('GET','/v1/recipients/203','invalid',403,'forbidden');
checkRecipientRequest('POST','/v1/recipients/203',$token,400,'invalid_request');
checkRecipientRequest('GET','/v1/recipients/203?admin=1',$token,400,'invalid_request');
// Passing authentication reaches native lookup, unavailable in this empty image.
checkRecipientRequest('GET','/v1/recipients/203',$token,503,'recipient_unavailable');
echo "Apache private listener forwards scoped authentication and fails closed without a PBX\n";
PHP

# Real AMI reads must distinguish absent flags from DND/forwarding values.
mkdir -p /tmp/recipient-ami
cat > /tmp/recipient-ami/asterisk.conf <<'CONF'
[directories]
astetcdir => /tmp/recipient-ami
astmoddir => /usr/lib/asterisk/modules
astvarlibdir => /var/lib/asterisk
astdbdir => /tmp/recipient-ami
astspooldir => /var/spool/asterisk
astrundir => /tmp/recipient-ami
astlogdir => /tmp/recipient-ami
[options]
nocolor=yes
CONF
printf '[modules]\nautoload=no\nload=pbx_config.so\nload=func_db.so\nload=func_devstate.so\n' > /tmp/recipient-ami/modules.conf
printf '[ext-local]\nexten => 203,hint,Custom:203\n' > /tmp/recipient-ami/extensions.conf
cat > /tmp/recipient-ami/manager.conf <<'CONF'
[general]
enabled=yes
bindaddr=127.0.0.1
port=5038
[synthetic]
secret=synthetic-only-local-key
read=all
write=all
CONF
asterisk -f -C /tmp/recipient-ami/asterisk.conf > /tmp/recipient-ami/log 2>&1 &
ready=false
for attempt in {1..50}; do
    if grep -q 'Asterisk Ready' /tmp/recipient-ami/log; then ready=true; break; fi
    sleep 0.1
done
if [[ "$ready" != true ]]; then cat /tmp/recipient-ami/log; exit 1; fi
php -d zend.assertions=1 -d assert.exception=1 <<'PHP'
<?php
$bootstrap_settings=['amportal_conf_initialized'=>true];
$amp_conf=['ASTETCDIR'=>'/tmp/recipient-ami','ASTSPOOLDIR'=>'/var/spool/asterisk'];
require '/var/www/html/freepbx/admin/libraries/php-asmanager.php';
require '/var/www/html/freepbx/rest/lib/libExtensions.php';
$astman=new AGI_AsteriskManager();
assert($astman->connect('127.0.0.1:5038','synthetic','synthetic-only-local-key','off'));
$astman->Command('devstate change Custom:203 NOT_INUSE');
assert(getMainExtensionPresence('203')['effective_presence']==='online');
$astman->Command('database put DND 203 YES');
assert(getMainExtensionPresence('203')['effective_presence']==='dnd');
$astman->Command('database del DND 203');
$astman->Command('database put CF 203 *203');
assert(getMainExtensionPresence('203')['effective_presence']==='voicemail');
$astman->Command('database del CF 203');
$astman->Command('devstate change Custom:203 INUSE');
assert(getMainExtensionPresence('203')['effective_presence']==='busy');
$astman->Command('devstate change Custom:203 RINGING');
assert(getMainExtensionPresence('203')['effective_presence']==='ringing');
$astman->disconnect();
echo "Real AMI presence: online, DND, voicemail, busy and ringing passed\n";
PHP
