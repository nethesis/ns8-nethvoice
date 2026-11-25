<?php
// SPDX-License-Identifier: GPL-3.0-or-later
if (PHP_SAPI!=='cli') { http_response_code(404); exit; }
require_once __DIR__.'/Service.php';
if (!\NethVoice\Agents\Preview::enabled()) { echo "[]\n"; exit; }
require_once '/etc/freepbx_db.conf';
try { echo json_encode((new \NethVoice\Agents\Service($db))->inheritedAgents(), JSON_THROW_ON_ERROR)."\n"; }
catch (Throwable $error) { fwrite(STDERR,"agent_inventory_unavailable\n"); exit(1); }
