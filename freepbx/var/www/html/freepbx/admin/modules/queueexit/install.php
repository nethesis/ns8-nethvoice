<?php

#
#    Copyright (C) 2018 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of QueueExit FreePBX module.
#
#    QueueExit module is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any 
#    later version.
#
#    QueueExit module is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with QueueExit module.  If not, see <http://www.gnu.org/licenses/>.
#

out(_('Creating the database table'));
//Database
$dbh = \FreePBX::Database();
try {
    $sql = "CREATE TABLE IF NOT EXISTS queueexit(
    `id` INT(11) AUTO_INCREMENT PRIMARY KEY,
    `displayname` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
    `timeout_destination` VARCHAR(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'app-blackhole,hangup,1',
    `full_destination` VARCHAR(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'app-blackhole,hangup,1',
    `joinempty_destination` VARCHAR(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'app-blackhole,hangup,1',
    `leaveempty_destination` VARCHAR(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'app-blackhole,hangup,1',
    `joinunavail_destination` VARCHAR(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'app-blackhole,hangup,1',
    `leaveunavail_destination` VARCHAR(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'app-blackhole,hangup,1',
    `continue_destination` VARCHAR(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'app-blackhole,hangup,1'
    );";
    $sth = $dbh->prepare($sql);
    $result = $sth->execute();

} catch (PDOException $e) {
    $result = $e->getMessage();
}
if ($result === true) {
    out(_('Table Created'));
} else {
    out(_('Something went wrong'));
    out($result);
}
