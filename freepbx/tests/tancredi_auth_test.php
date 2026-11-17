<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Check which administrator sections may use the Tancredi API.

require __DIR__ . '/../var/www/html/freepbx/rest/vendor/autoload.php';
require __DIR__ . '/../../tancredi/usr/share/tancredi/src/Entity/NethVoiceAuth.php';

use Tancredi\Entity\NethVoiceAuth;

function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}

foreach (['*', 'cdr;*', 'nethvoice:superadmin', 'nethvoice:phones', 'nethvoice:users', 'cdr; nethvoice:users ;nethvoice:bogus', 'nethvoice:dashboard;nethvoice:phones'] as $sections) {
    check(NethVoiceAuth::isPhonesAdministrator($sections), "$sections must reach Tancredi");
}
foreach (['', null, 'cdr*', 'nethvoice:*', 'nethvoice:dashboard', 'nethvoice:trunks;nethvoice:settings', 'cdr;queues', 'nethvoice:phonesx', 'xnethvoice:phones', 'NETHVOICE:PHONES'] as $sections) {
    check(!NethVoiceAuth::isPhonesAdministrator($sections), json_encode($sections) . ' must not reach Tancredi');
}

echo "PASS: Tancredi access for superadmin and the phones and users sections\n";
