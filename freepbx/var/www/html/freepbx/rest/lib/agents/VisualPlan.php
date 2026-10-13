<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;

/** Projection only: VisualPlan never owns or creates agent configuration. */
final class VisualPlan
{
    public static function widget(array $agent, array $labels = [], int $x = 0, int $y = 0): array
    {
        $id=$agent['agent_id'];
        if (!preg_match('/^[a-z][a-z0-9_-]{0,47}$/D',$id)) throw new \RuntimeException('invalid_agent_reference',422);
        $fallback=$agent['published']['fallback_destination_id']??null;
        return ['type'=>'Base','id'=>'satellite-agent-destination%'.$id,'name'=>$labels['base_agent_string']??'Agent',
            'x'=>$x,'y'=>$y,'radius'=>20,'bgColor'=>'#7c3aed',
            'userData'=>['agent_id'=>$id,'system_managed'=>true,'routable'=>(bool)$agent['routable'],'kind'=>$agent['kind']],
            'entities'=>[
                ['text'=>$agent['name'],'id'=>'satellite-agent-destination%'.$id,'type'=>'input'],
                ['text'=>($labels['base_agent_fallback_string']??'Fallback').': '.($fallback??'—'),'id'=>'agent_fallback%'.$id,'type'=>'text'],
                ['text'=>$labels['base_details_string']??'Configure','id'=>$id,'type'=>'text','destination'=>'','cssClass'=>'link'],
            ]];
    }
    public static function resolve(array $widget, callable $get): string
    {
        if (!preg_match('/^satellite-agent-destination%([a-z][a-z0-9_-]{0,47})$/D',$widget['id']??'',$match) ||
            ($widget['userData']['agent_id']??null)!==$match[1]) throw new \RuntimeException('invalid_agent_reference',422);
        $agent=$get($match[1]);
        if (!$agent['routable']) throw new \RuntimeException('agent_not_ready',409);
        return 'voice-agent-'.$agent['agent_id'].',s,1';
    }
    public static function validateGraph(array $widgets, array $connections, callable $get): void
    {
        $agents=[];
        foreach ($widgets as $widget) {
            if (!str_starts_with($widget['id']??'', 'satellite-agent-destination%')) continue;
            if (isset($agents[$widget['id']])) throw new \RuntimeException('invalid_agent_reference',422);
            self::resolve($widget,$get);
            $agents[$widget['id']]=true;
        }
        foreach ($connections as $connection) {
            $source=$connection['source']['node']??'';
            $target=$connection['target']['node']??'';
            if (str_starts_with($source,'satellite-agent-destination%') ||
                (str_starts_with($target,'satellite-agent-destination%') &&
                 (!isset($agents[$target]) || ($connection['target']['port']??'')!=='input_'.$target))) {
                throw new \RuntimeException('invalid_agent_reference',422);
            }
        }
    }
}
