<?php

// TANCREDI_ROOT=/path/to/tancredi php tests/unit/test_tancredi_lldp.php
$tancredi_root = getenv('TANCREDI_ROOT');
if (!$tancredi_root || !is_file($tancredi_root . '/vendor/autoload.php')) {
    throw new RuntimeException('Set TANCREDI_ROOT to a Tancredi checkout with Composer dependencies');
}
putenv('tancredi_conf=' . $tancredi_root . '/tancredi.conf.sample');
require_once $tancredi_root . '/vendor/autoload.php';

class LldpTestStorage extends \Tancredi\Entity\FileStorage {
    public $failId = null;
    public $writes = [];

    public function storageWrite($id, $data) {
        if ($id === $this->failId) {
            return false;
        }
        $this->writes[] = $id;
        return parent::storageWrite($id, $data);
    }
}

$checks = 0;
$test_dirs = [];
function check($condition, $message) {
    global $checks;
    if (!$condition) {
        throw new RuntimeException($message);
    }
    ++$checks;
}

function fixture($fresh = false, $explicit_default = null) {
    global $tancredi_root, $test_dirs;
    $directory = sys_get_temp_dir() . '/tancredi-lldp-' . bin2hex(random_bytes(6));
    mkdir($directory . '/scopes', 0777, true);
    $test_dirs[] = $directory;
    $logger = new \Psr\Log\NullLogger();
    $storage = new LldpTestStorage($logger, ['ro_dir' => $tancredi_root . '/data/', 'rw_dir' => $directory . '/']);
    $defaults = $storage->storageRead('defaults', true);
    if (!$fresh) {
        $defaults['metadata']['version'] = 4;
        unset($defaults['data']['lldp_enable']);
        if ($explicit_default !== null) {
            $defaults['data']['lldp_enable'] = $explicit_default;
        }
    }
    $storage->storageWrite('defaults', $defaults);
    $storage->writes = [];
    return $storage;
}

function seed($storage, $id, $parent, $data = [], $type = 'model') {
    $metadata = ['scopeType' => $type, 'displayName' => $id];
    if ($parent !== null) {
        $metadata['inheritFrom'] = $parent;
    }
    $storage->storageWrite($id, ['metadata' => $metadata, 'data' => $data]);
}

function migrate($storage) {
    $container = new \DI\Container(['storage' => $storage, 'logger' => new \Psr\Log\NullLogger()]);
    include __DIR__ . '/../../tancredi/usr/share/tancredi/scripts/upgrade.d/016-custom.php';
}

function variables($storage, $id) {
    return (new \Tancredi\Entity\Scope($id, $storage, new \Psr\Log\NullLogger()))->getVariables();
}

function seed_legacy_scopes($storage) {
    seed($storage, 'custom-copy', null, ['tmpl_phone' => 'nethesis.tmpl', 'adminpw' => 'test-password']);
    seed($storage, 'zz-parent', 'fanvil-X5');
    seed($storage, 'aa-disabled-child', 'zz-parent', ['tmpl_phone' => 'yealink.tmpl']);
    seed($storage, 'aa-phone', 'aa-disabled-child', [], 'phone');
    seed($storage, 'fanvil-phone', 'fanvil-X5', [], 'phone');
    seed($storage, 'phone-template-override', 'yealink-T46', ['tmpl_phone' => 'fanvil-X3.tmpl'], 'phone');
    seed($storage, 'explicit-model', 'fanvil-X5', ['lldp_enable' => '0']);
    seed($storage, 'explicit-phone', 'explicit-model', ['lldp_enable' => '1'], 'phone');
    seed($storage, 'explicit-blank', 'fanvil-X5', ['lldp_enable' => '']);
    seed($storage, 'blank-child', 'explicit-blank', [], 'phone');
    seed($storage, 'unsupported-parent', 'fanvil-X5', ['tmpl_phone' => 'custom.tmpl']);
    seed($storage, 'supported-child', 'unsupported-parent', ['tmpl_phone' => 'snom.tmpl']);
    $storage->writes = [];
}

function check_legacy_scopes($storage) {
    $expected = [
        'defaults' => '0', 'yealink-T46' => '0', 'snom-D120' => '0',
        'snom-D862' => '0', 'gigaset-P710' => '0', 'gigaset-P810' => '0',
        'akuvox-SPR50P' => '0', 'akuvox-WP410' => '0', 'akuvox-WP480' => '0',
        'fanvil-X3' => '1', 'fanvil-X5' => '1', 'fanvil-V67' => '1',
        'nethesis-NPX5' => '1', 'sangoma-S500' => '1', 'custom-copy' => '1',
        'zz-parent' => '1', 'aa-disabled-child' => '0', 'aa-phone' => '0',
        'fanvil-phone' => '1', 'phone-template-override' => '1',
        'explicit-model' => '0', 'explicit-phone' => '1',
        'explicit-blank' => '', 'blank-child' => '', 'supported-child' => '0',
    ];
    foreach ($expected as $id => $value) {
        check(variables($storage, $id)['lldp_enable'] === $value, "Incorrect LLDP for $id");
    }
    check(variables($storage, 'custom-copy')['adminpw'] === 'test-password', 'Unrelated scope data changed');
    check($storage->storageRead('defaults')['metadata']['version'] === '16', 'Missing completion marker');
    check(!array_key_exists('lldp_enable', $storage->storageRead('fanvil-phone')['data']), 'Unnecessary phone override');
}

try {
    $storage = fixture(true);
    migrate($storage);
    check($storage->writes === [], 'Fresh installation was migrated');
    check(variables($storage, 'yealink-T46')['lldp_enable'] === '1', 'Fresh phone must enable LLDP');

    $storage = fixture();
    seed_legacy_scopes($storage);
    migrate($storage);
    check_legacy_scopes($storage);
    seed($storage, 'new-phone', 'yealink-T46', [], 'phone');
    seed($storage, 'new-fanvil-phone', 'fanvil-X5', [], 'phone');
    check(variables($storage, 'new-phone')['lldp_enable'] === '0', 'New phone lost migrated default');
    check(variables($storage, 'new-fanvil-phone')['lldp_enable'] === '1', 'New phone lost migrated model setting');
    foreach (['defaults' => '1', 'fanvil-X5' => '0', 'explicit-phone' => '0'] as $id => $value) {
        $scope = new \Tancredi\Entity\Scope($id, $storage, new \Psr\Log\NullLogger());
        $scope->setVariables(['lldp_enable' => $value]);
    }
    $before = [];
    foreach ($storage->listScopes() as $id) {
        $before[$id] = $storage->storageRead($id);
    }
    $storage->writes = [];
    migrate($storage);
    check($storage->writes === [], 'Migration reran after administrator changes');
    foreach ($before as $id => $data) {
        check($storage->storageRead($id) === $data, "Restart changed scope $id");
    }
    $scope = new \Tancredi\Entity\Scope('explicit-phone', $storage, new \Psr\Log\NullLogger());
    $scope->setVariables(['lldp_enable' => null]);
    check(variables($storage, 'explicit-phone')['lldp_enable'] === '0', 'Removing phone override must inherit model');

    foreach (['0', '1', ''] as $value) {
        $storage = fixture(false, $value);
        seed($storage, 'override-model', 'yealink-T46', ['lldp_enable' => $value === '1' ? '0' : '1']);
        migrate($storage);
        check(variables($storage, 'defaults')['lldp_enable'] === $value, 'Explicit default overwritten');
        check(variables($storage, 'fanvil-X5')['lldp_enable'] === $value, 'Explicit inherited default overwritten');
        check(variables($storage, 'override-model')['lldp_enable'] !== $value, 'Explicit model overwritten');
    }

    foreach (['aa-disabled-child', 'fanvil-X5', 'defaults'] as $failure) {
        $storage = fixture();
        seed_legacy_scopes($storage);
        $original_defaults = $storage->storageRead('defaults');
        $storage->failId = $failure;
        $failed = false;
        try {
            migrate($storage);
        } catch (RuntimeException $error) {
            $failed = true;
        }
        check($failed, "Expected migration write failure for $failure");
        check($storage->storageRead('defaults') === $original_defaults, 'Failed migration changed defaults or completion marker');
        $storage->failId = null;
        migrate($storage);
        check_legacy_scopes($storage);
    }

    $storage = fixture();
    seed($storage, 'cycle-a', 'cycle-b');
    seed($storage, 'cycle-b', 'cycle-a');
    $storage->writes = [];
    $failed = false;
    try {
        migrate($storage);
    } catch (RuntimeException $error) {
        $failed = true;
    }
    check($failed && $storage->writes === [], 'Invalid inheritance must fail before any writes');
    echo "Passed $checks LLDP migration assertions\n";
} finally {
    foreach ($test_dirs as $directory) {
        foreach (glob($directory . '/scopes/*') as $file) {
            unlink($file);
        }
        rmdir($directory . '/scopes');
        rmdir($directory);
    }
}
