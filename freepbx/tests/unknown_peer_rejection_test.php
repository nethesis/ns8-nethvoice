#!/usr/bin/env php
<?php
// Usage: php unknown_peer_rejection_test.php <patched-core-directory>
if ($argc !== 2) { exit(2); }
$source = file_get_contents($argv[1] . '/etc/extensions.conf');
$start = strpos($source, '[from-sip-external]');
$end = strpos($source, ';-------------------------------------------------------------------------------', $start);
$context = substr($source, $start, $end-$start);
$rejected = substr($context, strpos($context, 'exten => s,n(noanonymous)'));
foreach (['Answer', 'Playback', 'Playtones', 'Congestion', 'Wait('] as $application) {
    if (str_contains($rejected, $application)) { throw new RuntimeException('rejection still opens audio: '.$application); }
}
if (!str_contains($rejected, 'Log(WARNING') || !str_contains($rejected, "exten => s,n,Hangup\n")) {
    throw new RuntimeException('rejection must log and hang up');
}
if (!str_contains($context, '${ALLOW_SIP_ANON}') || !str_contains($context, 'Goto(from-trunk,${DID},1)')) {
    throw new RuntimeException('permitted anonymous call routing changed');
}
echo "PASS: rejection has no audio applications; permitted routing retained\n";
