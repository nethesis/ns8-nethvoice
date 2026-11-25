<?php
// Exercise the patched Userman command with the same Symfony Console as fwconsole.
use FreePBX\Console\Command\Userman;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;

require $argv[2].'/amp_conf/htdocs/admin/libraries/Composer/vendor/autoload.php';
require $argv[1].'/Console/Userman.class.php';
if (!function_exists('_')) {
    function _($text) { return $text; }
}

class FreePBX {
    public static $provider;
    public static $runDir;
    public static function create() { return (object)['Userman' => self::$provider]; }
    public static function Config() { return new self(); }
    public function get($key) { return $key === 'ASTRUNDIR' ? self::$runDir : false; }
}

class TestDirectories {
    public $fail = true;
    public $locked = [];
    public $finished = [];
    public function getAllDirectories() {
        return [
            ['id' => 1, 'name' => 'first', 'active' => true, 'config' => ['sync' => '']],
            ['id' => 2, 'name' => 'second', 'active' => true, 'config' => ['sync' => '']],
            ['id' => 3, 'name' => 'disabled', 'active' => false],
        ];
    }
    public function getDirectoryObjectByID($id) {
        return new class($this->fail && $id === 1) {
            public function __construct(private bool $fail) {}
            public function sync($output) {
                if ($this->fail) { throw new RuntimeException('Directory unavailable'); }
            }
        };
    }
    public function getConfig($key) { return 0; }
    public function setConfig($key, $value) {}
    public function lockDirectory($id) { $this->locked[$id] = true; }
    public function unlockDirectory($id) { unset($this->locked[$id]); }
    public function syncDisplayNamesAfterDirectorySync($id) {
        $this->finished[] = $id;
        return ['updated' => 0, 'skipped' => 1, 'errors' => ['Display name update skipped']];
    }
}

FreePBX::$runDir = sys_get_temp_dir().'/userman-sync-'.bin2hex(random_bytes(8));
mkdir(FreePBX::$runDir);
$provider = FreePBX::$provider = new TestDirectories();
try {
    foreach ([true, false] as $fail) {
        $provider->fail = $fail;
        $provider->finished = [];
        $output = new BufferedOutput();
        $status = (new Userman())->run(new ArrayInput(['--syncall' => true, '--force' => true]), $output);
        $messages = $output->fetch();
        if ($status !== ($fail ? 1 : 0) || $provider->finished !== ($fail ? [2] : [1, 2])) {
            throw new RuntimeException('Unexpected --syncall result: '.$status.' '.$messages);
        }
        if ($provider->locked || file_exists(FreePBX::$runDir.'/userman.lock')) {
            throw new RuntimeException('Userman retained a sync lock');
        }
        if (!str_contains($messages, 'Display name update skipped')) {
            throw new RuntimeException('Missing display name warning in command output');
        }
        if ($fail && !str_contains($messages, 'Directory unavailable')) {
            throw new RuntimeException('Missing directory error in command output');
        }
    }
} finally {
    if (file_exists(FreePBX::$runDir.'/userman.lock')) { unlink(FreePBX::$runDir.'/userman.lock'); }
    rmdir(FreePBX::$runDir);
}
echo "PASS: --syncall reports directory failures and continues syncing remaining directories\n";
