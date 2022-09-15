<?php

if (!defined('FREEPBX_IS_AUTH')) {
    die('No direct script access allowed');
}
global $db;

$table = 'visualplan';

$sql = "CREATE TABLE IF NOT EXISTS $table (
    `id` INT(11) AUTO_INCREMENT PRIMARY KEY,
    `subject` VARCHAR(60),
    `body` TEXT);";

$result = $db->query($sql);

if (DB::IsError($result)) {
    die_freepbx("Cannot create $table table");
} else {
    out(_('OK'));
}
