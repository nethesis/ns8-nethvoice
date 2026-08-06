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

$f = fopen('php://memory', 'w');
foreach (\FreePBX::Rapidcode()->getList() as $row) {
    $out = array($row['label'],$row['number'],$row['code']);
    fputcsv($f, $out);
}
fseek($f, 0);
header('Content-Type: application/csv');
header('Content-Disposition: attachment; filename="rapidcode.csv";');
fpassthru($f);
