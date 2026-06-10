#!/usr/bin/env php
<?php

/*
 * Regression: party resolution for a trunk/external channel.
 *
 * On an attended transfer to an external party (e.g. 202 calls the cell
 * 3401234567, then transfers to 201), the post-transfer segment is anchored on
 * the external trunk channel (PJSIP/<trunk>). Its CEL facts carry BOTH the
 * originating extension as `accountcode` (202) and the real external number as
 * `cid_num` (3401234567). The caller of that segment must be the external
 * number, not the originating extension, otherwise the external party's speech
 * is mislabelled as the transferor and the segment is wrongly coalesced with
 * the consultation segment.
 */

require_once __DIR__ . '/bootstrap.php';

satellite_test_bootstrap();

$usersByExtension = array(
    '201' => 'Andrea Marchionni',
    '202' => 'Antonio Colapietro',
);

// Trunk channel: accountcode is the originating extension, cid_num is the real
// external party. The party must resolve to the external number.
$trunkFacts = array(
    'PJSIP/Opensolution-0000000a' => array(
        'accountcode' => '202',
        'cid_num' => '3401234567',
        'cid_name' => '3401234567',
    ),
);
$trunkParty = resolve_party('PJSIP/Opensolution-0000000a', $trunkFacts, $usersByExtension, null, 'caller');
assert_same('3401234567', $trunkParty['num'], 'Trunk channel caller must resolve to the external cid_num, not the originating accountcode');

// Internal channel must still resolve to its own extension (regression guard).
$internalFacts = array(
    'PJSIP/202-00000009' => array(
        'accountcode' => '202',
        'cid_num' => '202',
        'cid_name' => 'Antonio Colapietro',
    ),
);
$internalParty = resolve_party('PJSIP/202-00000009', $internalFacts, $usersByExtension, null, 'caller');
assert_same('202', $internalParty['num'], 'Internal channel must still resolve to its extension');
assert_same('Antonio Colapietro', $internalParty['name'], 'Internal channel must resolve the user display name');

fwrite(STDOUT, "ok - trunk party resolution regression\n");
