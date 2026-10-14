<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;

/** Only a bridge to FreePBX-native operations; no HTTP or configuration mirror. */
final class Native
{
    public function defaultLanguage(): string
    {
        try { $language=\FreePBX::Soundlang()->getLanguage(); }
        catch (\Throwable $error) { $language='en'; }
        return is_string($language) && preg_match('/^[a-z]{2}(-[A-Z]{2})?$/D',$language)?$language:'en';
    }
    public function trunkExists(array $binding): bool
    { return \FreePBX::Satellite()->agentTrunkExists($binding); }
    public function trunkReady(array $binding): bool
    { return \FreePBX::Satellite()->agentTrunkReady($binding); }
    public function destination(string $id): string
    {
        if ($id==='hangup') return 'app-blackhole,hangup,1';
        if (preg_match('/^extension:([0-9]{1,20})$/D',$id,$match)) {
            if (!in_array($id,array_column($this->extensions(),'id'),true)) throw new \RuntimeException('destination_unavailable',422);
            return 'from-did-direct,'.$match[1].',1';
        }
        if (!preg_match('/^native:([a-zA-Z0-9_-]{1,80},[a-zA-Z0-9_*#.-]{1,64},1)$/D',$id,$match)) throw new \RuntimeException('invalid_destination',422);
        $info=\FreePBX::Destinations()->getDestination($match[1]);
        if (!$info || empty($info['description'])) throw new \RuntimeException('destination_unavailable',422);
        return $match[1];
    }
    public function extensions(): array { return \FreePBX::Satellite()->agentExtensions(); }
    public function provision(string $operation, array $binding, ?array $previous): int
    { return \FreePBX::Satellite()->agentTrunk($operation, $binding, $previous); }
    public function apply(): bool { return \FreePBX::Satellite()->applyAgentDialplan(); }
    public function inUse(string $id): bool
    { return \FreePBX::Satellite()->agentDestinationInUse($id); }
}
