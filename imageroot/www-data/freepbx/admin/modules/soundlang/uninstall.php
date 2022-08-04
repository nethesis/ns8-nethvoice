<?php
$sql = array();
$sql[] = "DROP TABLE soundlang_settings";
$sql[] = "DROP TABLE soundlang_packages";
$sql[] = "DROP TABLE soundlang_customlangs";

global $db;
foreach($sql as $s) {
	$db->query($s);
}
