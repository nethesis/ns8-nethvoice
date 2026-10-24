#!/usr/bin/env php
<?php
// Usage: php reload_logging_test.php [framework-admin-libraries-directory]
namespace FreePBX {
    class DB_Helper {}
}

namespace {
    $libraries = $argv[1] ?? '/var/www/html/freepbx/admin/libraries';
    require $libraries . '/utility.functions.php';
    require $libraries . '/BMO/Logger.class.php';
    require $libraries . '/BMO/Modules.class.php';
    require $libraries . '/modulefunctions.legacy.php';
    set_error_handler(function ($severity, $message) { throw new \RuntimeException($message); });

    class TestLogger {
        public array $normal = [];
        public array $debug = [];
        public function log($level, $message) { $this->normal[] = [$level, $message]; }
        public function createLogDriver($driver, $path, $level, $multiline) { return $this; }
        public function debug($message) { $this->debug[] = $message; }
    }
    class FreePBX {
        public static TestLogger $logger;
        public static function Create() { return (object) ['Logger' => self::$logger]; }
        public static function Logger() { return self::$logger; }
    }
    function check($condition, $message) {
        if (!$condition) { throw new \RuntimeException($message); }
    }
    function deprecatedBmoCall($modules) { $modules->deprecatedFunction(); }
    function deprecatedLegacyCall() { _module_backtrace(); }

    FreePBX::$logger = new TestLogger();
    $modules = (new \ReflectionClass(\FreePBX\Modules::class))->newInstanceWithoutConstructor();
    $amp_conf = ['FPBXDBUGDISABLE' => true, 'FPBXDBUGFILE' => 'php://stderr', 'PHP_CONSOLE' => false];
    ob_start();
    deprecatedBmoCall($modules);
    deprecatedLegacyCall();
    check(ob_get_clean() === '', 'Deprecated calls must not write to stdout');
    check(FreePBX::$logger->normal === [], 'Deprecated calls reached the normal log');
    check(FreePBX::$logger->debug === [], 'Debug-disabled calls produced messages');

    $amp_conf['FPBXDBUGDISABLE'] = false;
    deprecatedBmoCall($modules);
    deprecatedLegacyCall();
    $debug = implode('', FreePBX::$logger->debug);
    foreach (['deprecatedBmoCall', 'deprecatedLegacyCall'] as $caller) {
        check(str_contains($debug, 'Deprecated Function ' . $caller . ' detected in ' . __FILE__ . ' on line '), 'Debug log lost caller details');
    }
    check(FreePBX::$logger->normal === [], 'Debug messages reached the normal log');

    foreach ([FPBX_LOG_INFO, FPBX_LOG_WARNING, FPBX_LOG_ERROR, FPBX_LOG_CRITICAL, FPBX_LOG_SECURITY] as $level) {
        freepbx_log($level, 'diagnostic');
        check(end(FreePBX::$logger->normal) === [$level, 'diagnostic'], 'Normal diagnostic was lost');
    }
    ob_start();
    out('Reload Complete');
    check(trim(ob_get_clean()) === 'Reload Complete', 'Reload status was lost');
    echo "PASS: quiet deprecations, opt-in debug details, normal diagnostics and reload status\n";
}
