<?php
// Disposable databases only. Failure injection tests recovery after implicit DDL commits.
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/Schema.php';
use NethVoice\Agents\Schema;
$dsn=getenv('M0_TEST_DSN');
$db=new PDO($dsn,'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
if ($db->query('SHOW DATABASES LIKE "asterisk"')->fetchColumn()) throw new RuntimeException('fresh_disposable_database_required');
function fresh(PDO $db): void {
    $db->exec('DROP DATABASE IF EXISTS asterisk');
    $db->exec('DROP DATABASE IF EXISTS asteriskcdrdb');
    $db->exec('CREATE DATABASE asterisk');
    $db->exec('CREATE DATABASE asteriskcdrdb');
    $db->exec('CREATE TABLE asterisk.users (extension VARCHAR(20) PRIMARY KEY,name VARCHAR(100))');
    $db->exec('CREATE TABLE asterisk.userman_users (username VARCHAR(100),default_extension VARCHAR(20))');
}
foreach (['asterisk.voice_agent_schema','asterisk.voice_agent_agents','asteriskcdrdb.voice_agent_runs'] as $old) {
    fresh($db);
    $db->exec("CREATE TABLE $old (sentinel INT)");$db->exec("INSERT INTO $old VALUES (42)");
    try { Schema::install($db);throw new LogicException('unsupported_database_adopted'); }
    catch (RuntimeException $e) { assert($e->getMessage()==='unsupported_development_database'); }
    assert((int)$db->query("SELECT sentinel FROM $old")->fetchColumn()===42);
    assert((int)$db->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN ('asterisk','asteriskcdrdb')")->fetchColumn()===3);
}
class InterruptedInstall extends PDO {
    public int $remaining;
    public function exec(string $statement): int|false {
        $result=parent::exec($statement);
        if (--$this->remaining===0) throw new RuntimeException('simulated_interruption');
        return $result;
    }
}
foreach ([1,2,4,9,15,20,27,33] as $boundary) {
    fresh($db);
    $interrupted=new InterruptedInstall($dsn,'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $interrupted->remaining=$boundary;
    try { Schema::install($interrupted); }
    catch (RuntimeException $e) { assert($e->getMessage()==='simulated_interruption'); }
    unset($interrupted);
    Schema::install($db);Schema::install($db);
    assert($db->query('SELECT format FROM asterisk.voice_agent_installation')->fetchColumn()==='alpha-v8');
    assert((int)$db->query('SELECT COUNT(*) FROM asterisk.voice_agent_agents')->fetchColumn()===1);
    assert((int)$db->query('SELECT COUNT(*) FROM asterisk.voice_agent_drafts')->fetchColumn()===1);
    assert((int)$db->query('SELECT COUNT(*) FROM asterisk.voice_agent_versions')->fetchColumn()===0);
    assert((int)$db->query("SELECT enabled FROM asterisk.voice_agent_agents WHERE agent_id='receptionist'")->fetchColumn()===0);
    assert((int)$db->query('SELECT COUNT(*) FROM asterisk.voice_agent_builtin_tools')->fetchColumn()===5);
}
$db->exec('DROP DATABASE asterisk');$db->exec('DROP DATABASE asteriskcdrdb');
echo "Fresh baseline rejects development databases unchanged and resumes interrupted setup\n";
