#!/usr/bin/env php
<?php

#
#    Copyright (C) 2021 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of FreePBX
#
#    This is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any
#    later version.
#
#    ReturnOnTransfer module is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with ReturnOnTransfer module.  If not, see <http://www.gnu.org/licenses/>.
#
$restrict_mods = true; //dont load any functions.inc.phps
include "/etc/freepbx.conf";
require_once "phpagi.php";

$db = FreePBX::create()->Database;
$agi = new AGI();
$extension = $argv[1];

//get ext context
$sql2 = "SELECT data FROM sip where `keyword`='context' and `id` = :extension";
$sth = $db->prepare($sql2);
$sth->execute(array(':extension' => $extension));
$extension_context = $sth->fetch(\PDO::FETCH_COLUMN);

@$agi->exec("Set", "ext_context=$extension_context");
