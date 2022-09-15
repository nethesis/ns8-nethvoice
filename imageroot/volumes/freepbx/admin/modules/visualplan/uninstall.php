<?php

if (!defined('FREEPBX_IS_AUTH')) {
    die('No direct script access allowed');
}

global $db;
out(_('Removing the database table'));

$table = 'visualplan';
$res = $db->query("DROP TABLE IF EXISTS $table;");

if (DB::IsError($res)) {
    die_freepbx("Cannot delete $table table");
} else {
    out(_('OK'));
}