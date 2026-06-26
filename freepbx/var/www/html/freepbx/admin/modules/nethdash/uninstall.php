<?php

$dbh = \FreePBX::Database();
out(_('Restoring FreePBX settings'));
$table = 'nethdash';
try {
    $sql = "UPDATE freepbx_settings set value = 'nethdash' where keyword = 'DASHBOARD_OVERRIDE'";
    $sth = $dbh->prepare($sql);
    $result = $sth->execute();
} catch (PDOException $e) {
    $result = $e->getMessage();
}
if ($result === true) {
    out(_('FreePBX settings restored'));
} else {
    out(_('Something went wrong'));
    out($result);
}
