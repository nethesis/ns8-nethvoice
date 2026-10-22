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

$dbh = \FreePBX::Database();
out(_('Removing the database table'));
$table = 'queueexit';
try {
    $sql = "DROP TABLE IF EXISTS $table;";
    $sth = $dbh->prepare($sql);
    $result = $sth->execute();
} catch (PDOException $e) {
    $result = $e->getMessage();
}
if ($result === true) {
    out(_('Table Deleted'));
} else {
    out(_('Something went wrong'));
    out($result);
}
