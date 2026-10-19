<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;
/** Same category policy as Satellite; the published binding owns all grants. */
final class RoutingPolicy
{
    public static function permits(array $draft,string $id): bool
    {
        if (!preg_match('/^(extension|queue|ivr):[0-9]{1,20}$/D',$id,$m)) return false;
        $transfer=null;
        foreach ($draft['tool_bindings']??[] as $binding) if ($binding['tool_id']==='pbx.transfer') $transfer=$binding;
        if (!$transfer || !$transfer['enabled']) return false;
        $config=$transfer['config'];
        if ($m[1]==='extension') return $config['extensions_enabled'] && in_array($id,$config['extension_allowlist'],true);
        return $config[$m[1].'s_enabled'] && !in_array($id,$config[$m[1].'_denylist'],true);
    }
}
