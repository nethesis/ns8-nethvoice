<?php
out(_('Updating FreePBX settings'));
$dbh = \FreePBX::Database();
try {
    $sql = "UPDATE freepbx_settings set value = 'nethdash' where keyword = 'DASHBOARD_OVERRIDE'";
    $sth = $dbh->prepare($sql);
    $result = $sth->execute();
} catch (PDOException $e) {
    $result = $e->getMessage();
}
if ($result === true) {
    out(_('Dashboard override updated'));
} else {
    out(_('Something went wrong'));
    out($result);
}

