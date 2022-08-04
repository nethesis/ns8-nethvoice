<?php
#
#    Copyright (C) 2018 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of RapidCode FreePBX module.
#
#    RapidCode module is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any
#    later version.
#
#    RapidCode module is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with RapidCode module.  If not, see <http://www.gnu.org/licenses/>.
#
out(_('Creating the database table'));
$dbh = \FreePBX::Database();
try {
    $sql = "CREATE TABLE IF NOT EXISTS rapidcode(
    `id` INT(11) AUTO_INCREMENT PRIMARY KEY,
    `number` VARCHAR(20) NOT NULL,
    `code` VARCHAR(10) NOT NULL,
    `label` VARCHAR(100) DEFAULT NULL);";
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

// Register FeatureCode
$fcc = new featurecode('rapidcode', 'rapidcode');
$fcc->setDescription('Call Rapidcode');
$fcc->setDefault('*99');
$fcc->update();
unset($fcc);
