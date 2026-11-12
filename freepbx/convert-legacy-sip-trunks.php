<?php
// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: GPL-3.0-or-later
require '/etc/freepbx.conf';
require __DIR__ . '/initdb.d/legacy-sip-trunks.php';

try {
    $freepbx = FreePBX::Create();
    convertLegacySipTrunks($freepbx->Database, $freepbx->Core);
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
