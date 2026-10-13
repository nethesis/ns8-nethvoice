<?php
require __DIR__ . '/../../var/www/html/freepbx/rest/lib/agents/Access.php';
use NethVoice\Agents\Access;
$a = Access::envelope('admin-one');
assert(in_array('tools', $a['capabilities'], true) && $a['milestone'] === 'v0.1-configuration');
assert($a === Access::envelope('admin-one'));
Access::requireCsrf('admin-one', $a['csrf']);
$b = Access::envelope('admin-two');
assert($b['csrf'] !== $a['csrf']);
foreach (['', $a['csrf']] as $token) {
    try { Access::requireCsrf('admin-two', $token); throw new RuntimeException('expected_denial'); }
    catch (InvalidArgumentException $e) { assert($e->getMessage() === 'csrf_invalid'); }
}
Access::requireSameOrigin('https://pbx.example', 'pbx.example', 'https', 'same-origin');
Access::requireSameOrigin('', 'pbx.example', 'https', '');
foreach ([['https://other.example', ''], ['http://pbx.example', ''],
          ['https://pbx.example:444', ''], ['https://pbx.example', 'cross-site']] as [$origin, $site]) {
    try { Access::requireSameOrigin($origin, 'pbx.example', 'https', $site); throw new RuntimeException('expected_denial'); }
    catch (RuntimeException $e) { assert($e->getCode() === 403); }
}
echo "PASS: access envelope and identity-bound CSRF\n";
