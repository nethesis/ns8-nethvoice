<?php
// SPDX-License-Identifier: GPL-3.0-or-later
if (PHP_SAPI!=='cli') { http_response_code(404); exit; }
require_once '/etc/freepbx_db.conf';
require_once __DIR__.'/Retention.php';
try { \NethVoice\Agents\Retention::clean($db); }
catch (Throwable $error) { fwrite(STDERR,"voice_agent_retention_failed\n"); exit(1); }
