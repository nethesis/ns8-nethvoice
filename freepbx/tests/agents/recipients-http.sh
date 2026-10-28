#!/usr/bin/env bash
# Check the actual Apache/PHP request boundary in a disposable, disconnected image.
set -euo pipefail
freepbx_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
docker run --rm -i --network=none --entrypoint=bash \
    -e NETHVOICE_RECIPIENT_SERVICE_PORT=31043 \
    -e VOICE_AGENT_RECIPIENT_TOKEN=synthetic-recipient-key-000000000000000000 \
    -v "$freepbx_dir/entrypoint.sh:/entrypoint:ro" \
    -v "$freepbx_dir/usr/libexec/voice-agent-recipient.php:/usr/libexec/voice-agent-recipient.php:ro" \
    "${VOICE_AGENT_TEST_PHP_IMAGE:?}" -s <<'BASH'
set -euo pipefail
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
BASH
