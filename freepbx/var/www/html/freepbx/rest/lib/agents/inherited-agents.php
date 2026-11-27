<?php
// SPDX-License-Identifier: GPL-3.0-or-later
if (PHP_SAPI!=='cli') { http_response_code(404); exit; }
require_once __DIR__.'/Service.php';
if (!\NethVoice\Agents\Preview::enabled()) { echo "[]\n"; exit; }
require_once '/etc/freepbx_db.conf';
try {
    $service=new \NethVoice\Agents\Service($db);
    $result=$service->inheritedAgents();
    if (($argv[1]??null)==='--include-preview-impact') {
        $result=['inherited_agents'=>$result,'voice_agent_preview_impact'=>null];
        ob_start();
        try {
            require_once '/etc/freepbx.conf';
            $result['voice_agent_preview_impact']=$service->previewImpact();
        } catch (Throwable $error) {
            // Key warnings remain available when native route inventory is unavailable.
        } finally {
            ob_end_clean();
        }
    }
    echo json_encode($result,JSON_THROW_ON_ERROR)."\n";
}
catch (Throwable $error) { fwrite(STDERR,"agent_inventory_unavailable\n"); exit(1); }
