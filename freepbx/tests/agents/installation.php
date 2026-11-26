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
fresh($db);
$db->exec("CREATE TABLE asterisk.voice_agent_installation (singleton INT PRIMARY KEY, format VARCHAR(32))");
$db->exec("INSERT INTO asterisk.voice_agent_installation VALUES (1,'alpha-v8')");
try { Schema::install($db); throw new LogicException('alpha_database_adopted'); }
catch (RuntimeException $error) { assert($error->getMessage()==='unsupported_development_database'); }
assert($db->query('SELECT format FROM asterisk.voice_agent_installation')->fetchColumn()==='alpha-v8');
assert((int)$db->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN ('asterisk','asteriskcdrdb')")->fetchColumn()===3);
class InterruptedInstall extends PDO {
    public int $remaining;
    public function exec(string $statement): int|false {
        $result=parent::exec($statement);
        if (--$this->remaining===0) throw new RuntimeException('simulated_interruption');
        return $result;
    }
}
class Version3Install extends PDO {
    public function exec(string $statement): int|false {
        if (str_starts_with($statement,'ALTER TABLE asteriskcdrdb.voice_agent_run_events MODIFY COLUMN')) {
            throw new RuntimeException('stopped_at_version_3');
        }
        return parent::exec($statement);
    }
}
fresh($db);
try { Schema::install(new Version3Install($dsn,'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION])); assert(false); }
catch (RuntimeException $e) { assert($e->getMessage()==='stopped_at_version_3'); }
assert((int)$db->query('SELECT schema_version FROM asterisk.voice_agent_preview_schema')->fetchColumn()===3);
$eventType="SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='asteriskcdrdb' AND TABLE_NAME='voice_agent_run_events' AND COLUMN_NAME='event_type'";
assert(!str_contains($db->query($eventType)->fetchColumn(),'provider_warning'));
Schema::install($db);
assert(str_contains($db->query($eventType)->fetchColumn(),'provider_warning'));
foreach ([1,2,4,9,15,20,27,33] as $boundary) {
    fresh($db);
    $interrupted=new InterruptedInstall($dsn,'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $interrupted->remaining=$boundary;
    try { Schema::install($interrupted); }
    catch (RuntimeException $e) { assert($e->getMessage()==='simulated_interruption'); }
    unset($interrupted);
    Schema::install($db);Schema::install($db);
    assert((int)$db->query('SELECT schema_version FROM asterisk.voice_agent_preview_schema')->fetchColumn()===4);
    assert((int)$db->query('SELECT COUNT(*) FROM asterisk.voice_agent_agents')->fetchColumn()===2);
    assert((int)$db->query('SELECT COUNT(*) FROM asterisk.voice_agent_drafts')->fetchColumn()===2);
    assert((int)$db->query('SELECT COUNT(*) FROM asterisk.voice_agent_versions')->fetchColumn()===0);
    assert((int)$db->query("SELECT enabled FROM asterisk.voice_agent_agents WHERE agent_id='receptionist'")->fetchColumn()===0);
    assert((int)$db->query('SELECT COUNT(*) FROM asterisk.voice_agent_builtin_tools')->fetchColumn()===5);
}
$db->exec('DROP DATABASE asterisk');$db->exec('DROP DATABASE asteriskcdrdb');
echo "Fresh baseline rejects development databases unchanged and resumes interrupted setup\n";
