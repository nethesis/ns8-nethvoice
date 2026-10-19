<?php
// SPDX-License-Identifier: GPL-3.0-or-later
if (PHP_SAPI!=='cli') { http_response_code(404);exit; }
ini_set('display_errors','0');
try {
    if (getenv('NETHVOICE_HOST')!=='voice2.makako.sf.nethserver.net') throw new RuntimeException('development_target_mismatch');
    define('FREEPBX_IS_AUTH',1);
    $bootstrap_settings['freepbx_error_handler']=false;
    require '/etc/freepbx.conf';
    require_once __DIR__.'/DevelopmentReset.php';
    $reset=new \NethVoice\Agents\DevelopmentReset(FreePBX::Database(),new \NethVoice\Agents\Native());
    if (($argv[1]??'')!=='--clear') { echo json_encode($reset->inspect())."\n";exit; }
    if (getenv('VOICE_AGENT_DEVELOPMENT_RESET')!=='clear-development-agent-data:nethvoice57') throw new RuntimeException('development_reset_confirmation_required');
    exec('/usr/sbin/asterisk -rx '.escapeshellarg('core show channels count').' 2>/dev/null',$lines,$code);
    $counts=implode("\n",$lines);
    if ($code!==0 || !preg_match('/^0 active channels$/m',$counts) || !preg_match('/^0 active calls$/m',$counts)) throw new RuntimeException('zero_call_gate_failed');
    echo json_encode($reset->clear(getenv('VOICE_AGENT_DEVELOPMENT_RESET')))."\n";
} catch (Throwable $error) {
    fwrite(STDERR,"development_agent_reset_failed\n");exit(1);
}
