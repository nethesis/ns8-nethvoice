<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;
/** Same category policy as Satellite; the published binding owns all grants. */
final class RoutingPolicy
{
    public static function permitsRecent(array $draft,string $id): bool
    {
        if (!preg_match('/^extension:[0-9]{1,20}$/D',$id)) return false;
        $transfer=$lookup=null;
        foreach ($draft['tool_bindings']??[] as $binding) {
            if ($binding['tool_id']==='pbx.transfer') $transfer=$binding;
            if ($binding['tool_id']==='pbx.find_recent_callers') $lookup=$binding;
        }
        return $transfer && $transfer['enabled'] && $transfer['tool_version']>=2 &&
            $lookup && $lookup['enabled'] && ($transfer['config']['recent_callers_enabled']??false) &&
            !in_array($id,$transfer['config']['recent_caller_denylist'],true);
    }
    public static function permits(array $draft,string $id): bool
    {
        if (!preg_match('/^(extension|queue):[0-9]{1,20}$/D',$id,$m)) return false;
        $transfer=null;
        foreach ($draft['tool_bindings']??[] as $binding) if ($binding['tool_id']==='pbx.transfer') $transfer=$binding;
        if (!$transfer || !$transfer['enabled']) return false;
        $config=$transfer['config'];
        if ($m[1]==='extension') return $config['extensions_enabled'] && in_array($id,$config['extension_allowlist'],true);
        return $config[$m[1].'s_enabled'] && !in_array($id,$config[$m[1].'_denylist'],true);
    }
}
