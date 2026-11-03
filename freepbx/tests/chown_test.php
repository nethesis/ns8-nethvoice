#!/usr/bin/env php
<?php
// Usage: php chown_test.php <framework-dir>
namespace Symfony\Component\Console\Command {
    class Command {}
}
namespace {
    if ($argc !== 2) { exit(2); }
    require $argv[1].'/amp_conf/htdocs/admin/libraries/BMO/LoadConfig.class.php';
    require $argv[1].'/amp_conf/htdocs/admin/libraries/Console/Chown.class.php';
    function check($condition, $message) {
        if (!$condition) { throw new \RuntimeException($message); }
    }
    class FreePBX {
        public static $config;
        public static function Config() { return self::$config; }
        public static function LoadConfig() {
            return new \FreePBX\LoadConfig((object) ['Config' => self::$config]);
        }
    }
    $root = sys_get_temp_dir().'/nethvoice-chown-'.bin2hex(random_bytes(8));
    mkdir($root, 0700);
    mkdir($root.'/etc');
    register_shutdown_function(function () use ($root) {
        exec('rm -rf -- '.escapeshellarg($root));
    });
    FreePBX::$config = new class($root) {
        public function __construct(private $root) {}
        public function get($key) { return $this->root.'/etc'; }
    };
    $entrypoint = file_get_contents(__DIR__.'/../entrypoint.sh');
    $start = strpos($entrypoint, '# Keep the managed rules');
    $end = strpos($entrypoint, '# create asterisk.conf', $start);
    $setup = str_replace(['/etc/asterisk', '/var/www/html/freepbx'], [$root.'/etc', $root.'/web'], substr($entrypoint, $start, $end - $start));
    $configFile = $root.'/etc/freepbx_chown.conf';
    $class = new \ReflectionClass(\FreePBX\Console\Command\Chown::class);
    // Cover new volumes, existing custom rules, and the legacy include on upgrades.
    foreach (['', "[blacklist]\ndirectory = $root/administrator\n[custom]\nfile = $root/custom,0600,root,root\n#include nethvoice_chown.conf"] as $existing) {
        file_put_contents($configFile, $existing);
        exec('bash -c '.escapeshellarg($setup), $unused, $status);
        check($status === 0, 'configuration setup failed');
        $first = file_get_contents($configFile);
        exec('bash -c '.escapeshellarg($setup), $unused, $status);
        check($status === 0 && $first === file_get_contents($configFile), 'configuration setup is not idempotent');
        check(!str_contains($first, '#include'), 'legacy include was not migrated');
        $command = $class->newInstanceWithoutConstructor();
        $class->getMethod('loadChownConf')->invoke($command);
        $blacklist = $class->getProperty('blacklist')->getValue($command)['dirs'];
        foreach (['rest', 'wizard', 'visualplan', 'admin/modules/visualplan/htdocs', 'admin/modules/framework/amp_conf'] as $path) {
            check(in_array($root.'/web/'.$path, $blacklist, true), 'missing exclusion: '.$path);
        }
        if ($existing !== '') {
            check(in_array($root.'/administrator', $blacklist, true), 'administrator exclusion lost');
            check(str_contains($first, "file = $root/custom,0600,root,root"), 'administrator custom rule lost');
        }
        $custom = $command->modfiles['byconfig'];
        check(in_array(['type' => 'file', 'path' => $root.'/etc/prometheus.conf', 'perms' => 0640, 'owner' => 'asterisk', 'group' => 'asterisk'], $custom, true), 'metrics credential permission rule not loaded');
    }
    // Exercise the unmodified upstream permission pass with the parsed rules.
    foreach (['rest/vendor', 'wizard', 'admin/modules/framework/amp_conf/bin', 'admin/modules/visualplan/htdocs', 'admin/modules/core/hooks', 'admin/assets/less/cache'] as $path) {
        mkdir($root.'/web/'.$path, 0700, true);
        file_put_contents($root.'/web/'.$path.'/file', 'fixture');
        chmod($root.'/web/'.$path.'/file', 0600);
    }
    $apply = $class->getMethod('systemSetRecursivePermissions');
    $apply->invoke($command, $root.'/web', 0775, (string) posix_geteuid(), (string) posix_getegid());
    clearstatcache();
    foreach (['rest/vendor', 'wizard', 'admin/modules/framework/amp_conf/bin', 'admin/modules/visualplan/htdocs'] as $path) {
        check((fileperms($root.'/web/'.$path.'/file') & 07777) === 0600, 'excluded file was changed: '.$path);
    }
    foreach (['admin/modules/core/hooks', 'admin/assets/less/cache'] as $path) {
        check((fileperms($root.'/web/'.$path.'/file') & 07777) === 0664, 'mutable file was not repaired: '.$path);
    }
    echo "FreePBX native exclusions, migration and mutable permissions passed\n";
}
