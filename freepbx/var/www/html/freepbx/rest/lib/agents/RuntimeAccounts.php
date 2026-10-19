<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;

/** Provision two private DB identities from NS8 secrets, never Redis metadata. */
final class RuntimeAccounts
{
    public static function install(): bool
    {
        $config=getenv('VOICE_AGENT_CONFIG_PASSWORD'); $monitor=getenv('VOICE_AGENT_MONITOR_PASSWORD');
        if (!$config || !$monitor) return false; // M0-only deployments do not start execution.
        $root=getenv('MARIADB_ROOT_PASSWORD'); $port=getenv('NETHVOICE_MARIADB_PORT');
        if (!$root || !$port || !ctype_digit($port)) throw new \RuntimeException('runtime_accounts_unavailable');
        $db=new \PDO('mysql:host=127.0.0.1;port='.$port,'root',$root,[\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION]);
        foreach (['voice_agent_config'=>$config,'voice_agent_monitor'=>$monitor] as $user=>$password) {
            foreach (['127.0.0.1','localhost'] as $host) {
                $identity=$db->quote($user).'@'.$db->quote($host);
                $db->exec('CREATE USER IF NOT EXISTS '.$identity.' IDENTIFIED BY '.$db->quote($password));
                $db->exec('ALTER USER '.$identity.' IDENTIFIED BY '.$db->quote($password));
                $db->exec('REVOKE ALL PRIVILEGES, GRANT OPTION FROM '.$identity);
                if ($user==='voice_agent_config') {
                    foreach (['voice_agent_published','voice_agent_runtime_bindings','voice_agent_extension_directory','voice_agent_runtime_tools','voice_agent_queue_directory','voice_agent_ivr_directory','voice_agent_ivr_branches'] as $view) $db->exec('GRANT SELECT ON asterisk.'.$view.' TO '.$identity);
                } else {
                    $db->exec('GRANT SELECT,INSERT ON asteriskcdrdb.voice_agent_runs TO '.$identity);
                    $db->exec('GRANT UPDATE (provider_call_id,ended_at,outcome,error_code) ON asteriskcdrdb.voice_agent_runs TO '.$identity);
                    $db->exec('GRANT SELECT,INSERT ON asteriskcdrdb.voice_agent_run_events TO '.$identity);
                    $db->exec('GRANT INSERT ON asteriskcdrdb.voice_agent_transcripts TO '.$identity);
                    $db->exec('GRANT SELECT,INSERT ON asteriskcdrdb.voice_agent_pending_calls TO '.$identity);
                    $db->exec('GRANT UPDATE (state,provider_call_id) ON asteriskcdrdb.voice_agent_pending_calls TO '.$identity);
                }
            }
        }
        return true;
    }
}
