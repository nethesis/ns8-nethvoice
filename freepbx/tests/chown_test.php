#!/usr/bin/env php
<?php
// Usage: php chown_test.php <patched-framework-dir>
namespace Symfony\Component\Console\Command {
    class Command {}
}
namespace {
    if ($argc !== 2) { exit(2); }
    require $argv[1].'/amp_conf/htdocs/admin/libraries/Console/Chown.class.php';
    function check($condition, $message) {
        if (!$condition) { throw new \RuntimeException($message); }
    }
    $root = sys_get_temp_dir().'/nethvoice-chown-'.bin2hex(random_bytes(8));
    mkdir($root, 0700);
    register_shutdown_function(function () use ($root) {
        exec('rm -rf -- '.escapeshellarg($root));
    });
    $bin = $root.'/bin';
    mkdir($bin);
    $log = $root.'/mutations';
    foreach (['chmod', 'chown'] as $command) {
        $real = trim(shell_exec('command -v '.$command));
        file_put_contents($bin.'/'.$command, "#!/bin/sh\nprintf '%s\\n' ".escapeshellarg($command)." >> ".escapeshellarg($log)."\nexec ".escapeshellarg($real)." \"\$@\"\n");
        chmod($bin.'/'.$command, 0755);
    }
    putenv('PATH='.$bin.':'.getenv('PATH'));
    $tree = $root."/files with 'quotes'";
    mkdir($tree);
    mkdir($tree.'/excluded');
    file_put_contents($tree.'/excluded/keep', 'excluded directory');
    file_put_contents($tree.'/skip', 'excluded file');
    file_put_contents($tree.'/correct', 'correct');
    file_put_contents($tree.'/repair', 'incorrect');
    file_put_contents($root.'/outside', 'symlink target');
    symlink($root.'/outside', $tree.'/link');
    chmod($tree, 0775);
    chmod($tree.'/correct', 0664);
    chmod($tree.'/repair', 0600);
    chmod($tree.'/skip', 0600);
    chmod($tree.'/excluded/keep', 0600);
    chmod($root.'/outside', 0600);
    $class = new \ReflectionClass(\FreePBX\Console\Command\Chown::class);
    $command = $class->newInstanceWithoutConstructor();
    $class->getProperty('blacklist')->setValue($command, [
        'files' => [$tree.'/skip'], 'dirs' => [$tree.'/excluded'],
    ]);
    $apply = $class->getMethod('systemSetRecursivePermissions');
    $owner = (string) posix_geteuid();
    $group = (string) posix_getegid();
    $apply->invoke($command, $tree, 0775, $owner, $group);
    clearstatcache();
    check((fileperms($tree.'/repair') & 07777) === 0664, 'incorrect mode not repaired');
    check(file_get_contents($log) === "chmod\n", 'already-correct metadata was rewritten');
    foreach (['/skip', '/excluded/keep'] as $path) {
        check((fileperms($tree.$path) & 07777) === 0600, 'blacklisted path changed');
    }
    check((fileperms($root.'/outside') & 07777) === 0600, 'symlink target changed');
    file_put_contents($log, '');
    $apply->invoke($command, $tree, 0775, $owner, $group);
    check(file_get_contents($log) === '', 'second pass rewrote correct metadata');
    $apply->invoke($command, $tree, 0775, $owner, $group, 'execdir', 0027);
    clearstatcache();
    check((fileperms($tree.'/correct') & 07777) === 0750, 'execdir or umask changed');
    check((fileperms($tree) & 07777) === 0750, 'directory umask changed');
    if (posix_geteuid() === 0) {
        chown($tree.'/repair', 12345);
        chgrp($tree.'/correct', 12345);
        $apply->invoke($command, $tree, 0775, $owner, $group);
        clearstatcache();
        check(fileowner($tree.'/repair') === 0, 'owner mismatch not repaired');
        check(filegroup($tree.'/correct') === posix_getegid(), 'group mismatch not repaired');
    }
    echo "FreePBX permission repair, exclusions and idempotence passed\n";
}
