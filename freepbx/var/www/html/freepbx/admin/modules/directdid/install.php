<?php

#
#    Copyright (C) 2018 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of DirectDID FreePBX module.
#
#    DirectDID module is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any 
#    later version.
#
#    DirectDID module is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with DirectDID module.  If not, see <http://www.gnu.org/licenses/>.
#

out(_('Creating the database table'));
//Database
$dbh = \FreePBX::Database();
try {
    $sql = "CREATE TABLE IF NOT EXISTS directdid(
    `id` INT(11) AUTO_INCREMENT PRIMARY KEY,
    `timeout` INT(11) NOT NULL DEFAULT 15,
    `timeout_destination` VARCHAR(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'app-blackhole,hangup,1',
    `busy_destination` VARCHAR(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'app-blackhole,hangup,1',
    `unavailable_destination` VARCHAR(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'app-blackhole,hangup,1',
    `root` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
    `prefix` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
    `varlength` INT(2) NOT NULL DEFAULT 2
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
