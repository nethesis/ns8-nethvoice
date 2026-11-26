<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;
require_once __DIR__.'/Preview.php';

/** Provision two private DB identities from NS8 secrets, never Redis metadata. */
final class RuntimeAccounts
{
    private static function database(): \PDO
    {
        $root=getenv('MARIADB_ROOT_PASSWORD'); $port=getenv('NETHVOICE_MARIADB_PORT');
        if (!$root || !$port || !ctype_digit($port)) throw new \RuntimeException('runtime_accounts_unavailable');
        return new \PDO('mysql:host=127.0.0.1;port='.$port,'root',$root,[\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION]);
    }

    public static function disable(): void
    {
        $db=self::database();
        $accounts=$db->query("SELECT User,Host FROM mysql.user WHERE User IN ('voice_agent_config','voice_agent_monitor')
            AND Host IN ('127.0.0.1','localhost')")->fetchAll(\PDO::FETCH_ASSOC);
        foreach ($accounts as $account) {
            $identity=$db->quote($account['User']).'@'.$db->quote($account['Host']);
            $db->exec('REVOKE ALL PRIVILEGES, GRANT OPTION FROM '.$identity);
        }
    }

    public static function install(): bool
    {
        $config=Preview::value('VOICE_AGENT_CONFIG_PASSWORD'); $monitor=Preview::value('VOICE_AGENT_MONITOR_PASSWORD');
        if (!$config || !$monitor) return false; // M0-only deployments do not start execution.
        $db=self::database();
        foreach (['voice_agent_config'=>$config,'voice_agent_monitor'=>$monitor] as $user=>$password) {
            foreach (['127.0.0.1','localhost'] as $host) {
                $identity=$db->quote($user).'@'.$db->quote($host);
                $db->exec('CREATE USER IF NOT EXISTS '.$identity.' IDENTIFIED BY '.$db->quote($password));
                $db->exec('ALTER USER '.$identity.' IDENTIFIED BY '.$db->quote($password));
                $db->exec('REVOKE ALL PRIVILEGES, GRANT OPTION FROM '.$identity);
                if ($user==='voice_agent_config') {
                    foreach (['voice_agent_published','voice_agent_runtime_bindings','voice_agent_extension_directory','voice_agent_runtime_tools','voice_agent_queue_directory','voice_agent_ivr_directory','voice_agent_ivr_branches','voice_agent_callback_devices','voice_agent_callback_trunks','voice_agent_callback_patterns','voice_agent_recent_cdr'] as $view) $db->exec('GRANT SELECT ON asterisk.'.$view.' TO '.$identity);
                } else {
                    $db->exec('GRANT SELECT (binding_id,signing_generation), UPDATE (webhook_verified_at,webhook_verified_key_generation) ON asterisk.voice_agent_webhook_verification TO '.$identity);
                    $db->exec('GRANT SELECT,INSERT ON asteriskcdrdb.voice_agent_runs TO '.$identity);
                    $db->exec('GRANT UPDATE (parent_run_id,provider_call_id,ended_at,outcome,error_code,duration_ms,setup_duration_ms,first_output_ms,trace_status,usage_json,usage_complete) ON asteriskcdrdb.voice_agent_runs TO '.$identity);
                    $db->exec('GRANT SELECT,INSERT ON asteriskcdrdb.voice_agent_run_events TO '.$identity);
                    $db->exec('GRANT SELECT,INSERT,UPDATE ON asteriskcdrdb.voice_agent_metric_hours TO '.$identity);
                    $db->exec('GRANT SELECT,INSERT,UPDATE ON asteriskcdrdb.voice_agent_runtime_health TO '.$identity);
                    $db->exec('GRANT INSERT ON asteriskcdrdb.voice_agent_transcripts TO '.$identity);
                    $db->exec('GRANT SELECT,INSERT ON asteriskcdrdb.voice_agent_pending_calls TO '.$identity);
                    $db->exec('GRANT UPDATE (state,provider_call_id) ON asteriskcdrdb.voice_agent_pending_calls TO '.$identity);
                }
            }
        }
        return true;
    }
}
