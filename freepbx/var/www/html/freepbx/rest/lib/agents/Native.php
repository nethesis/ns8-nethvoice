<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;

/** Only a bridge to FreePBX-native operations; no HTTP or configuration mirror. */
final class Native
{
    public function extensions(): array { return \FreePBX::Satellite()->agentExtensions(); }
    public function provision(string $operation, array $binding, ?array $previous): int
    { return \FreePBX::Satellite()->agentTrunk($operation, $binding, $previous); }
    public function apply(): bool { return \FreePBX::Satellite()->applyAgentDialplan(); }
    public function inUse(string $id): bool
    { return \FreePBX::Satellite()->agentDestinationInUse($id); }
}
