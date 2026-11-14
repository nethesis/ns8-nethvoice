<?php
// SPDX-License-Identifier: GPL-3.0-or-later
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once '/etc/freepbx_db.conf';
require_once __DIR__.'/Schema.php';
require_once __DIR__.'/RuntimeAccounts.php';
try {
    \NethVoice\Agents\Schema::install($db);
    if (!\NethVoice\Agents\RuntimeAccounts::install()) throw new RuntimeException('runtime_accounts_unavailable');
} catch (Throwable $error) {
    fwrite(STDERR,($error->getMessage()==='unsupported_development_database'?'unsupported_development_database':'runtime_initialization_failed')."\n");
    exit(1);
}
