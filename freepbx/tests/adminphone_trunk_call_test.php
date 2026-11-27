#!/usr/bin/env php
<?php
if ($argc !== 2) {
    fwrite(STDERR, "Usage: php $argv[0] <framework-directory>\n");
    exit(2);
}
require $argv[1] . '/amp_conf/htdocs/admin/libraries/extensions.class.php';
require __DIR__ . '/../var/www/html/freepbx/admin/modules/nethcti3/functions.inc.php';
function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}
function commands($ext, $context, $extension) {
    return array_map(fn($step) => $step['cmd']->output(), $ext->_exts[$context][' '.$extension.' '] ?? []);
}
function pbx() {
    $ext = new extensions();
    foreach (['from-internal-additional', 'outbound-allroutes', 'from-internal-custom'] as $include) {
        $ext->addInclude('from-internal', $include);
        $ext->addInclude('cti-profile-3', $include);
    }
    $ext->addInclude('outbound-allroutes', 'outrt-1');
    $ext->add('outrt-1', '_0.', '', new ext_macro('dialout-trunk', '1,${EXTEN},,off'));
    $ext->add('from-internal-additional', '_X.', '', new ext_noop('internal'));
    return $ext;
}
function includes($ext, $context) {
    return array_column($ext->_includes[$context] ?? [], 'include');
}

$ext = pbx();
nethcti3_configure_adminphone_context($ext, '770000');
$context = 'nethvoice-adminphone';
check(includes($ext, $context) === ['from-internal'], 'the administrator phone context does not keep the internal dialplan');
check(array_keys($ext->_exts[$context]) === [' _***X. '], 'the administrator phone context has unexpected extensions');
check(commands($ext, $context, '_***X.') === [
    'GotoIf($["${CHANNEL(channeltype)}" != "PJSIP"]?reject)',
    'GotoIf($["${CHANNEL(endpoint)}" != "770000"]?reject)',
    'Set(NETHVOICE_TRUNK_CALL=${EXTEN:3})',
    'GotoIf($[${REGEX("^[0-9]+[*][+]?[0-9]+$" ${NETHVOICE_TRUNK_CALL})} = 0]?reject)',
    'Set(NETHVOICE_TRUNK_CALL_TRUNK=${CUT(NETHVOICE_TRUNK_CALL,*,1)})',
    'Set(NETHVOICE_TRUNK_CALL_NUMBER=${CUT(NETHVOICE_TRUNK_CALL,*,2)})',
    'GotoIf($["${OUT_${NETHVOICE_TRUNK_CALL_TRUNK}}" = "" | ${REGEX("^(ENUM|DUNDI)/" ${OUT_${NETHVOICE_TRUNK_CALL_TRUNK}})} = 1 | ${DIALPLAN_EXISTS(macro-dialout-trunk,s,1)} = 0]?reject)',
    'Gosub(macro-user-callerid,s,1(LIMIT,EXTERNAL))',
    'Gosub(sub-record-check,s,1(out,${NETHVOICE_TRUNK_CALL_NUMBER},dontcare))',
    'Set(_CALLERIDNAMEINTERNAL=${CALLERID(name)})',
    'Set(_CALLERIDNUMINTERNAL=${CALLERID(num)})',
    'Set(_NODEST=)',
    'Gosub(macro-dialout-trunk,s,1(${NETHVOICE_TRUNK_CALL_TRUNK},${NETHVOICE_TRUNK_CALL_NUMBER},,off))',
    'Gosub(macro-outisbusy,s,1())',
    'Hangup(21)',
], 'the trunk call does not check the caller before dialing the trunk');
$labels = array_column($ext->_exts[$context][' _***X. '], 'tag');
check($labels[array_key_last($labels)] === 'reject', 'rejected calls do not reach the hangup');
check(array_search('reject', $labels, true) > array_search('Gosub(macro-dialout-trunk,s,1(${NETHVOICE_TRUNK_CALL_TRUNK},${NETHVOICE_TRUNK_CALL_NUMBER},,off))', commands($ext, $context, '_***X.'), true), 'rejected calls reach the trunk');

foreach (array_keys($ext->_includes) as $other) {
    check(!in_array($context, includes($ext, $other), true), "$other reaches the administrator phone context");
}
foreach (array_keys($ext->_exts) as $other) {
    if ($other !== $context) {
        check(!array_key_exists(' _***X. ', $ext->_exts[$other]), "$other answers the trunk call pattern");
    }
}
$conf = $ext->generateConf();
check(preg_match('/^\[nethvoice-adminphone\]\ninclude => nethvoice-adminphone-custom\ninclude => from-internal\nexten => _\*\*\*X\.,1,GotoIf\(\$\["\$\{CHANNEL\(channeltype\)\}" != "PJSIP"\]\?reject\)$/m', $conf) === 1, 'the administrator phone context is not written to the dialplan');
check(substr_count($conf, '_***X.') === count(commands($ext, $context, '_***X.')), 'the trunk call pattern is written outside the administrator phone context');
check(preg_match('/^include => nethvoice-adminphone$/m', $conf) === 0, 'another context includes the administrator phone context');

foreach ([false, null, '', '77a000', '770000"]?x)', "770000\n"] as $invalid) {
    $ext = pbx();
    nethcti3_configure_adminphone_context($ext, $invalid);
    check(!isset($ext->_exts[$context]) && !isset($ext->_includes[$context]), 'trunk calls are generated without a valid administrator phone: ' . json_encode($invalid));
}

$library = file_get_contents(__DIR__ . '/../var/www/html/freepbx/rest/lib/libAdminPhone.php');
check(str_contains($library, "define('ADMINPHONE_CONTEXT', '$context');") && str_contains($library, "'context' => ADMINPHONE_CONTEXT,"), 'the administrator phone does not use the trunk call context');
$functions = file_get_contents(__DIR__ . '/../var/www/html/freepbx/admin/modules/nethcti3/functions.inc.php');
check(str_contains($functions, "nethcti3_configure_adminphone_context(\$ext, FreePBX::Nethcti3()->getConfig('extension', 'adminphone'));"), 'the dialplan is not generated for the stored administrator phone');

echo "PASS: trunk calls reachable only by the administrator phone endpoint\n";
