<?php

#
#    Copyright (C) 2018 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of GoogleTTS FreePBX module.
#
#    GoogleTTS module is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any 
#    later version.
#
#    GoogleTTS module is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with GoogleTTS module.  If not, see <http://www.gnu.org/licenses/>.
#

out(_('Creating the database table'));
//Database
$dbh = \FreePBX::Database();
try {
    $sql = "CREATE TABLE IF NOT EXISTS googletts(
    `id` INT(11) AUTO_INCREMENT PRIMARY KEY,
    `keyword` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' UNIQUE,
    `value` VARCHAR(256) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''
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
