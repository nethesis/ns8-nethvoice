<?php
// Preserve instance bindings across FreePBX module installers.
require '/etc/freepbx_db.conf';
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$bindings = [
    'udpport-0.0.0.0' => 'ASTERISK_SIP_UDP_PORT',
    'tcpport-0.0.0.0' => 'ASTERISK_SIP_PORT', 'bindport' => 'ASTERISK_SIP_PORT',
    'tlsport-0.0.0.0' => 'ASTERISK_SIPS_PORT', 'tlsbindport' => 'ASTERISK_SIPS_PORT',
    'rtpstart' => 'ASTERISK_RTPSTART', 'rtpend' => 'ASTERISK_RTPEND',
];
foreach (array_unique(array_merge(array_values($bindings), ['ASTERISK_IAX_PORT'])) as $name) {
    $value = getenv($name);
    if (!is_string($value) || !ctype_digit($value) || (int) $value < 1 || (int) $value > 65535) {
        throw new RuntimeException('Invalid or missing ' . $name);
    }
}
if ((int) getenv('ASTERISK_RTPSTART') > (int) getenv('ASTERISK_RTPEND')) {
    throw new RuntimeException('Invalid RTP range');
}
$bindsFile = '/var/run/nethvoice/transport-binds.json';
if (($argv[1] ?? '') === '--save-transports') {
    $row = $db->query("SELECT val FROM kvstore_Sipsettings WHERE `key` = 'binds' LIMIT 1")->fetchColumn();
    if ($row !== false && file_put_contents($bindsFile, $row) === false) {
        throw new RuntimeException('Cannot save transport configuration');
    }
    exit(0);
}
$update = $db->prepare('UPDATE kvstore_Sipsettings SET val = ? WHERE `key` = ?');
foreach ($bindings as $key => $name) {
    $update->execute([getenv($name), $key]);
}
if (is_file($bindsFile)) {
    $binds = file_get_contents($bindsFile);
    json_decode($binds, true, 512, JSON_THROW_ON_ERROR);
    $update->execute([$binds, 'binds']);
}
$update = $db->prepare('UPDATE sipsettings SET data = ? WHERE keyword = ?');
foreach (['rtpstart' => 'ASTERISK_RTPSTART', 'rtpend' => 'ASTERISK_RTPEND', 'bindport' => 'ASTERISK_SIP_UDP_PORT'] as $key => $name) {
    $update->execute([getenv($name), $key]);
}
$db->prepare("UPDATE iaxsettings SET data = ? WHERE keyword = 'bindport'")->execute([getenv('ASTERISK_IAX_PORT')]);
