<?php
/** Actual MariaDB and secretbox migration, including retry and rollback. */
$root = dirname(__DIR__, 2);
$module = $root . '/freepbx/var/www/html/freepbx/admin/modules/satellite';
require_once $module . '/lib/AgentCrypto.php';
function cloneCheck($condition, $message) { if (!$condition) { throw new RuntimeException($message); } }
$port = (int) getenv('PHASE5_DB_PORT');
$db = new PDO('mysql:host=127.0.0.1;port=' . $port . ';dbname=asterisk;charset=utf8mb4',
    'root', 'phase5-isolated', array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION));
$crypto = new AgentCrypto();
putenv('SATELLITE_AGENT_CONFIG_KEY=synthetic-source-key');
$values = array('synthetic-api-key', 'synthetic-sip-password', 'synthetic-webhook-key');
$encrypted = array_map(array($crypto, 'encryptSecret'), $values);
$query = $db->prepare("INSERT INTO satellite_agent_trunks
    (name,provider,runtime_owner,freepbx_trunk_name,api_key_encrypted,sip_auth_password_encrypted,webhook_signing_secret_encrypted)
    VALUES ('Clone secrets','openai','builtin','AgentClone',?,?,?)");
$query->execute($encrypted); $id = $db->lastInsertId();
$query = $db->prepare("INSERT INTO satellite_agent_webhook_previous_keys
    (binding_id,provider,secret_encrypted,expires_at) VALUES (?,'openai',?,DATE_ADD(NOW(), INTERVAL 1 DAY))");
$query->execute(array($id, $crypto->encryptSecret('synthetic-previous-webhook')));
$input = array('source_key'=>'synthetic-source-key', 'target_key'=>'synthetic-clone-key',
    'database'=>array('port'=>$port,'password'=>'phase5-isolated'));
$run = function () use ($module, $input) {
    $process = proc_open(array(PHP_BINARY, $module . '/bin/satellite_agent_clone'),
        array(0=>array('pipe','r'),1=>array('pipe','w'),2=>array('pipe','w')), $pipes);
    fwrite($pipes[0], json_encode($input)); fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]); fclose($pipes[1]);
    $stderr = stream_get_contents($pipes[2]); fclose($pipes[2]);
    return array(proc_close($process), $stdout, $stderr);
};
cloneCheck($run() === array(0, '', ''), 'Rotation failed or emitted private output');
$read = function () use ($db, $id) {
    return $db->query('SELECT api_key_encrypted,sip_auth_password_encrypted,webhook_signing_secret_encrypted
        FROM satellite_agent_trunks WHERE id=' . (int) $id)->fetch(PDO::FETCH_NUM);
};
$rotated = $read();
putenv('SATELLITE_AGENT_CONFIG_KEY=synthetic-clone-key');
cloneCheck(array_map(array($crypto,'decryptSecret'),$rotated) === $values, 'Retained values changed');
cloneCheck($crypto->decryptSecret($db->query('SELECT secret_encrypted FROM satellite_agent_webhook_previous_keys WHERE binding_id=' . (int) $id)->fetchColumn()) === 'synthetic-previous-webhook', 'Previous webhook key lost');
putenv('SATELLITE_AGENT_CONFIG_KEY=synthetic-source-key');
try { $crypto->decryptSecret($rotated[0]); throw new LogicException('Source key still decrypts clone'); }
catch (RuntimeException $expected) {}
cloneCheck($run() === array(0, '', ''), 'Retry failed');
cloneCheck($read() === $rotated, 'Retry changed already migrated ciphertext');
// A corrupt later column must roll back earlier changes in the same transaction.
putenv('SATELLITE_AGENT_CONFIG_KEY=synthetic-source-key');
$before = $crypto->encryptSecret('synthetic-new-api');
$db->prepare('UPDATE satellite_agent_trunks SET api_key_encrypted=?,sip_auth_password_encrypted=? WHERE id=?')
    ->execute(array($before, 'invalid-ciphertext', $id));
$result = $run();
cloneCheck($result === array(1, '', "Clone Agent credential rotation failed\n"), 'Unexpected migration error output');
cloneCheck($read()[0] === $before, 'Failed migration partially committed');
$db->exec('DELETE FROM satellite_agent_webhook_previous_keys WHERE binding_id=' . (int) $id);
$db->exec('DELETE FROM satellite_agent_trunks WHERE id=' . (int) $id);
echo "Clone native secret migration, new-key isolation, previous webhooks, retry and atomic rollback passed\n";
