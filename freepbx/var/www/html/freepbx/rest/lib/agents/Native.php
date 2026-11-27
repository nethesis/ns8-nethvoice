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
    public function directory(): array { return \FreePBX::Satellite()->agentDirectory(); }
    public function extensions(): array { return \FreePBX::Satellite()->agentExtensions(); }
    public function provision(string $operation, array $binding, ?array $previous): int
    { return \FreePBX::Satellite()->agentTrunk($operation, $binding, $previous); }
    public function apply(): bool { return \FreePBX::Satellite()->applyAgentDialplan(); }
    public function inUse(string $id): bool
    { return \FreePBX::Satellite()->agentDestinationInUse($id); }
    public function referencedAgentIds(): array
    { return \FreePBX::Satellite()->referencedAgentIds(); }

    public function inboundRouteAgentIds(): array
    {
        // Wizard and VisualPlan both save inbound routes in Core's DID inventory.
        $routes = \FreePBX::Core()->getAllDIDs('extension');
        if (!is_array($routes)) throw new \RuntimeException('inbound_routes_unavailable');
        $pending = [];
        foreach ($routes as $route) {
            if (!is_string($route['destination'] ?? null)) throw new \RuntimeException('inbound_routes_unavailable');
            $pending[] = $route['destination'];
        }
        $agents = $seen = [];
        while ($pending) {
            $destination = array_pop($pending);
            if (!$destination || isset($seen[$destination])) continue;
            $seen[$destination] = true;
            if (preg_match('/^voice-agent-([a-z][a-z0-9_-]{0,47}),s,1$/D', $destination, $match)) {
                $agents[$match[1]] = true;
                continue;
            }
            foreach ($this->visualPlanExits($destination) as $exit) {
                if (is_string($exit) && $exit !== '') $pending[] = $exit;
            }
        }
        return $agents;
    }

    /** Follow the saved exits of routing blocks that VisualPlan can connect. */
    private function visualPlanExits(string $destination): array
    {
        if (preg_match('/^(ivr|app-announcement)-([0-9]+),s,1$/D', $destination, $match) ||
            preg_match('/^(timeconditions|app-daynight|nethcqr|ext-queues|ext-group),([0-9]+),1$/D', $destination, $match)) {
            [, $type, $id] = $match;
        } else {
            return [];
        }
        // FreePBX's editor helpers may also read current AMI state. Only the
        // saved exits are relevant, including when a dialplan reload is pending.
        $queries = match ($type) {
            'ivr' => [
                'SELECT invalid_destination, timeout_destination FROM ivr_details WHERE id=?',
                'SELECT dest FROM ivr_entries WHERE ivr_id=?',
            ],
            'app-announcement' => ['SELECT post_dest FROM announcement WHERE announcement_id=?'],
            'timeconditions' => ['SELECT truegoto, falsegoto FROM timeconditions WHERE timeconditions_id=?'],
            'app-daynight' => ["SELECT dest FROM daynight WHERE ext=? AND dmode IN ('day','night')"],
            'nethcqr' => [
                'SELECT default_destination FROM nethcqr_details WHERE id_cqr=?',
                'SELECT destination FROM nethcqr_entries WHERE id_cqr=?',
            ],
            'ext-queues' => ['SELECT dest FROM queues_config WHERE extension=?'],
            'ext-group' => ['SELECT postdest FROM ringgroups WHERE grpnum=?'],
        };
        $exits = [];
        $db = \FreePBX::Database();
        foreach ($queries as $sql) {
            $statement = $db->prepare($sql);
            if (!$statement || !$statement->execute([$id])) throw new \RuntimeException('inbound_routes_unavailable');
            foreach ($statement->fetchAll(\PDO::FETCH_NUM) as $row) array_push($exits, ...$row);
        }
        return $exits;
    }
}
