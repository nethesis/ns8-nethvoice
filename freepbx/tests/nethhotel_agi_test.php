<?php
// Run with: php freepbx/tests/nethhotel_agi_test.php
set_error_handler(function ($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});
function check($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
}
$directory = __DIR__.'/../var/www/html/freepbx/admin/modules/nethhotel/agi-bin';
$source = file_get_contents($directory.'/configAlarm.php');
$start = strpos($source, 'function isValidHour(');
eval(substr($source, $start, strpos($source, 'function exitError(', $start) - $start));
foreach (['0000' => '00:00', '0059' => '00:59', '1205' => '12:05', '2359' => '23:59'] as $input => $expected) {
    check(isValidHour((string)$input) === $expected, 'Valid alarm time rejected');
}
foreach (['2400', '2360', '2460', '', '123', '12345', 'ab12', '12:30', "1230\n", '#123'] as $input) {
    check(isValidHour($input) === false, 'Malformed or out-of-range alarm time accepted');
}

define('MAX_TRIES', 3);
$inputs = [];
$enabled = [];
$agi = new class {
    public array $prompts = [];
    public function stream_file($file) { $this->prompts[] = $file; }
};
function requestHour($tries) {
    global $inputs;
    check(count($inputs) > 0, 'Alarm requested an extra unchecked input');
    return array_shift($inputs);
}
function requestStart($tries) { return '2'; }
function neth_debug($message) {}
function enable($extension, $hour, $start) {
    global $enabled;
    $enabled[] = [$extension, $hour, $start];
}
function exitError() { throw new RuntimeException('alarm-input-rejected'); }
foreach ([['2359'], ['2460', '2359'], ['2400', '2360', '2359']] as $attempts) {
    $inputs = $attempts;
    $enabled = [];
    edit('88991');
    check($enabled === [['88991', '23:59', '2']] && $inputs === [], 'Alarm correction was not validated before saving');
}
$inputs = ['2460', '2400', '2360'];
$enabled = [];
try {
    edit('88991');
    throw new RuntimeException('Alarm accepted three invalid attempts');
} catch (RuntimeException $e) {
    check($e->getMessage() === 'alarm-input-rejected', $e->getMessage());
}
check($enabled === [] && $inputs === [], 'Rejected alarm changed the saved configuration');

$source = file_get_contents($directory.'/checkin.php');
$start = strpos($source, '$num =');
$splitAmount = substr($source, $start, strpos($source, ';', $start) - $start + 1);
foreach ([[2, ['2', '00']], [2.50, ['2', '50']], [0.05, ['0', '05']],
    [12.99, ['12', '99']], [1.995, ['2', '00']], [1234.50, ['1234', '50']]] as [$tot, $expected]) {
    eval($splitAmount);
    check($num === $expected, 'Checkout must announce the correct euros and cents');
}
echo "NethHotel AGI regressions passed\n";
