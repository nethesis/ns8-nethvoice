#!/usr/bin/env php
<?php
function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}
class FreePBX {
    public static function create() {
        return (object) ['Userman' => new class {
            public function getAllUsers() { return []; }
        }];
    }
    public static function Queues() {
        return new class { public function listQueues() { return []; } };
    }
    public static function Database() {
        return new class {
            public function prepare($sql) {
                return new class {
                    public function execute() { return true; }
                    public function fetchAll($mode) { return []; }
                };
            }
        };
    }
}
function getCTIGroups() { return []; }
function getCTIPermissionProfiles() { return []; }

$root = sys_get_temp_dir().'/reports-notification-'.bin2hex(random_bytes(8));
mkdir($root, 0700);
register_shutdown_function(function () use ($root) {
    exec('rm -rf -- '.escapeshellarg($root));
});
mkdir($root.'/api');
mkdir($root.'/notify');
file_put_contents($root.'/libCTI.php', '<?php');
ini_set('error_log', $root.'/errors');
$source = file_get_contents(__DIR__.'/../var/www/html/freepbx/admin/modules/nethcti3/functions.inc.php');
$function = substr($source, strpos($source, 'function nethvoice_report_config()'));
eval(str_replace(['/var/www/html/freepbx/rest/lib/libCTI.php', '/opt/nethvoice-report/api/', '/notify/'],
                 [$root.'/libCTI.php', $root.'/api/', $root.'/notify/'], $function));
$config = $root.'/api/user_authorizations.json';
$flag = $root.'/notify/restart_reports-api';
nethvoice_report_config();
check(array_column(json_decode(file_get_contents($config), true), 'username') === ['X', 'admin'], 'report configuration not generated');
check(is_file($flag) && filesize($flag) === 0, 'empty notification missing when export returns');

unlink($flag);
unlink($config);
mkdir($config);
nethvoice_report_config();
check(!file_exists($flag), 'failed export requested a restart');
check(str_contains(file_get_contents($root.'/errors'), "Can't write 'user_authorizations.json' file"), 'export failure not logged');

rmdir($config);
rmdir($root.'/notify');
nethvoice_report_config();
check(is_file($config), 'notification failure prevented configuration export');
check(str_contains(file_get_contents($root.'/errors'), "Can't request nethvoice report restart"), 'notification failure not logged');
echo "PASS: reports notifies synchronously after export; write and notification failures are logged\n";
