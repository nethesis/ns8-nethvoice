<?php

// TANCREDI_ROOT=/path/to/tancredi php tests/unit/test_tancredi_templates.php
$tancredi_root = getenv('TANCREDI_ROOT');
if (!$tancredi_root || !is_file($tancredi_root . '/vendor/autoload.php')) {
    throw new RuntimeException('Set TANCREDI_ROOT to a Tancredi checkout with Composer dependencies');
}
putenv('tancredi_conf=' . $tancredi_root . '/tancredi.conf.sample');
require_once $tancredi_root . '/vendor/autoload.php';

use Tancredi\Entity\CustomTemplates;

$checks = 0;
function check($condition, $message) {
    global $checks;
    if (!$condition) {
        throw new RuntimeException($message);
    }
    ++$checks;
}

$rw_dir = sys_get_temp_dir() . '/tancredi-templates-' . bin2hex(random_bytes(6)) . '/';
mkdir($rw_dir . 'templates-custom', 0777, true);
mkdir($rw_dir . 'scopes', 0777, true);
$config = ['ro_dir' => $tancredi_root . '/data/', 'rw_dir' => $rw_dir];
$storage = new \Tancredi\Entity\FileStorage(new \Psr\Log\NullLogger(), $config);
$templates = new CustomTemplates($config, $storage);

function problem($result) {
    return is_array($result) && isset($result['type']) ? $result['type'] : null;
}

foreach (['custom.tmpl', 'Yealink_T46-reception.v2.tmpl', 'a.tmpl', str_repeat('a', 95) . '.tmpl'] as $name) {
    check(CustomTemplates::isValidName($name), "$name must be a valid template name");
}
foreach (['', '.tmpl', '.hidden.tmpl', '../custom.tmpl', 'dir/custom.tmpl', 'dir\\custom.tmpl', 'custom.macros', 'custom.tmpl.php', 'custom', 'cust om.tmpl', "custom.tmpl\n", "custom\0.tmpl", 'cüstom.tmpl', str_repeat('a', 96) . '.tmpl', null, ['custom.tmpl'], 12] as $name) {
    check(!CustomTemplates::isValidName($name), json_encode($name) . ' must not be a valid template name');
}

$valid = "{% import 'yealink.macros' as macros %}\n#!version:1.0.0.1\naccount.1.user_name = {{ account_username_1 }}\n{{ hostname|preg_replace('/x/', 'y') }}\n";
check($templates->validate('custom.tmpl', $valid, false) === null, 'a valid template must pass');
check($templates->list() === [], 'no template is stored before saving');

check(problem($templates->validate('../custom.tmpl', $valid, false)) === 'invalid-file-name', 'a path must be refused');
check(problem($templates->validate('custom.tmpl', '', false)) === 'malformed-data', 'an empty template must be refused');
check(problem($templates->validate('custom.tmpl', ['x'], false)) === 'malformed-data', 'a template that is not text must be refused');
check(problem($templates->validate('custom.tmpl', str_repeat('a', CustomTemplates::MAX_SIZE + 1), false)) === 'file-too-large', 'a template over the size limit must be refused');
check($templates->validate('custom.tmpl', str_repeat('a', CustomTemplates::MAX_SIZE), false) === null, 'a template at the size limit must pass');
check(problem($templates->validate('custom.tmpl', "abc\xff", false)) === 'invalid-encoding', 'a template that is not UTF-8 must be refused');
check(problem($templates->validate('custom.tmpl', "abc\0def", false)) === 'invalid-encoding', 'a binary template must be refused');
check(problem($templates->validate('yealink.tmpl', $valid, false)) === 'shipped-template', 'a shipped template must not be overridden');
check(problem($templates->validate('yealink.tmpl', $valid, true)) === 'shipped-template', 'a shipped template must not be overridden even when replacing');

$broken = "line one\n{% if account_username_1 %}\n{{ account_username_1 }\n";
$result = $templates->validate('custom.tmpl', $broken, false);
check(problem($result) === 'template-syntax-error', 'a syntax error must be refused');
check($result['line'] === 3 && is_string($result['detail']) && $result['detail'] !== '', 'a syntax error must report its line and message: ' . json_encode($result));
check(!str_contains($result['detail'], $rw_dir) && !str_contains($result['detail'], $tancredi_root), 'a syntax error must not reveal server paths');
$result = $templates->validate('custom.tmpl', "{{ account_username_1|no_such_filter }}\n", false);
check(problem($result) === 'template-syntax-error' && $result['line'] === 1, 'an unknown filter must be refused: ' . json_encode($result));
$result = $templates->validate('custom.tmpl', "ok\n{% endif %}\n", false);
check(problem($result) === 'template-syntax-error' && $result['line'] === 2, 'an unexpected tag must be refused: ' . json_encode($result));
check($templates->list() === [], 'a refused template must not be stored');

$saved = $templates->save('custom.tmpl', $valid);
check($saved['name'] === 'custom.tmpl' && $saved['size'] === strlen($valid) && is_int($saved['mtime']), 'save must return the stored template: ' . json_encode($saved));
check(file_get_contents($rw_dir . 'templates-custom/custom.tmpl') === $valid, 'the template must be stored where Tancredi loads custom templates');
check(count(glob($rw_dir . 'templates-custom/{,.}*', GLOB_BRACE)) === 3, 'save must not leave temporary files');
check($templates->exists('custom.tmpl') && !$templates->exists('other.tmpl') && !$templates->exists('../scopes/x.tmpl'), 'exists must only see stored custom templates');
check(problem($templates->validate('custom.tmpl', $valid, false)) === 'template-exists', 'an existing template must not be overwritten by default');
check($templates->validate('custom.tmpl', $valid, true) === null, 'an existing template may be replaced on request');

file_put_contents($rw_dir . 'templates-custom/notes.txt', 'x');
file_put_contents($rw_dir . 'templates-custom/.gitignore', '*');
mkdir($rw_dir . 'templates-custom/dir.tmpl');
$templates->save('alpha.tmpl', "a\n");
check(array_column($templates->list(), 'name') === ['alpha.tmpl', 'custom.tmpl'], 'list must return only the custom template files: ' . json_encode($templates->list()));

$twig = CustomTemplates::createEnvironment($config);
check($twig->render('custom.tmpl', ['account_username_1' => '201', 'hostname' => 'pbx.example.org']) === "#!version:1.0.0.1\naccount.1.user_name = 201\npby.eyample.org\n", 'a stored template must render with the provisioning environment');
check(str_contains($twig->render('yealink.tmpl', parse_ini_file($tancredi_root . '/data/scopes/defaults.ini', true)['data'] + ['mac' => '00-15-65-00-00-01']), '#!version:1.0.0.1'), 'shipped templates must still render');

$storage->storageWrite('yealink-T46-reception', ['metadata' => ['scopeType' => 'model', 'displayName' => 'Reception'], 'data' => ['tmpl_phone' => 'custom.tmpl']]);
$storage->storageWrite('00-15-65-00-00-01', ['metadata' => ['scopeType' => 'phone', 'inheritFrom' => 'yealink-T46'], 'data' => ['tmpl_firmware' => 'alpha.tmpl']]);
check($templates->usedBy('custom.tmpl') === ['yealink-T46-reception'], 'a model using the template must be found');
check($templates->usedBy('alpha.tmpl') === ['00-15-65-00-00-01'], 'a phone using the template must be found');
check($templates->usedBy('nobody.tmpl') === [], 'an unused template must not be in use');

check($templates->delete('alpha.tmpl') && !is_file($rw_dir . 'templates-custom/alpha.tmpl'), 'delete must remove the template');
check(!$templates->delete('../scopes/yealink-T46-reception.ini') && is_file($rw_dir . 'scopes/yealink-T46-reception.ini'), 'delete must not leave the custom templates directory');
check(!$templates->delete('dir.tmpl') && is_dir($rw_dir . 'templates-custom/dir.tmpl'), 'delete must only remove files');

exec('rm -rf ' . escapeshellarg($rw_dir));
echo "Passed $checks custom template assertions\n";
