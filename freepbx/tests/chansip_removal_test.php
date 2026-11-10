<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Usage: php chansip_removal_test.php <patched-sipsettings-directory>
if ($argc !== 2) { exit(2); }
define('FREEPBX_IS_AUTH', true);
require $argv[1] . '/functions.inc.php';
if (function_exists('sipsettings_hookGet_config')) {
    throw new RuntimeException('The legacy chan_sip configuration hook is still registered');
}
if (!function_exists('sipsettings_get') || !function_exists('sipsettings_edit')) {
    throw new RuntimeException('Sipsettings helpers were removed with the legacy hook');
}
echo "PASS: no chan_sip configuration hook; Sipsettings helpers retained\n";
