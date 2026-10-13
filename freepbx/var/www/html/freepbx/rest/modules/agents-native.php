<?php
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\ResponseInterface as Response;
/** Native PBX configuration stays in FreePBX; the Vue document holds no secrets. */
require_once __DIR__ . '/../../admin/modules/satellite/lib/AgentContextSource.php';
require_once __DIR__ . '/../../admin/modules/satellite/lib/AgentSatelliteClient.php';

function agentsNativeInventory()
{
    $pbx = FreePBX::create(); $satellite = FreePBX::Satellite();
    $source = new AgentContextSource($pbx); $directory = $source->directory();
    $fallbacks = array();
    foreach ($directory as $item) {
        $target = $item['target'];
        $fallbacks[] = array('id' => $target['context'] . ',' . $target['exten'] . ',' . $target['priority'], 'label' => $item['name']);
    }
    foreach ($satellite->getAgentDestinations() as $item) {
        $fallbacks[] = array('id' => 'satellite-agent-destination-' . $item['id'] . ',s,1', 'label' => $item['freepbx_name']);
    }
    $profiles = $satellite->getAgentProfiles();
    foreach ($profiles as &$profile) {
        foreach (array('permissions', 'tools', 'company', 'calendar_services', 'knowledge', 'transfer_policy') as $field) {
            $profile[$field] = (object) $profile[$field];
        }
    }
    unset($profile);
    $tools = array();
    try { $tools = (new AgentSatelliteClient())->request('GET', '/catalog/tools')['tools']; }
    catch (\Throwable $error) { /* Native settings remain available while the runtime restarts. */ }
    return array('profiles' => $profiles, 'trunks' => $satellite->getAgentTrunks(), 'directory' => $directory,
        'tools' => $tools, 'permissions' => AgentProfileRepository::permissionsCatalog(),
        'fallback_destinations' => $fallbacks, 'time_conditions' => $source->timeConditions(),
        'webhook_url' => '/freepbx/satellite/index.php');
}

function agentsEnrichInventory(array $inventory)
{
    $native = agentsNativeInventory();
    $inventory['fallback_destinations'] = $native['fallback_destinations'];
    foreach ($inventory['agents'] as &$agent) {
        // Only live inbound references count as routes; draft graphs do not change routing.
        $agent = (array) $agent; $agent['routing_usage'] = array();
        foreach (FreePBX::Satellite()->getAgentDestinations() as $destination) {
            $matches = ($destination['workflow_agent_id'] ?? null) === $agent['agent_id'] ||
                (($agent['kind'] ?? '') === 'builtin' && ($destination['agent_type'] ?? '') === 'builtin_' . $agent['agent_id']);
            if (!$matches) { continue; }
            $target = 'satellite-agent-destination-' . $destination['id'] . ',s,1';
            foreach (FreePBX::Core()->getAllDIDs('extension') as $route) {
                if ($route['destination'] === $target) {
                    $agent['routing_usage'][] = array('name' => $route['description'] ?: $route['extension'], 'destination_id' => $destination['id']);
                }
            }
        }
    }
    unset($agent);
    return $inventory;
}

$app->get('/agents/native/inventory', function (Request $request, Response $response) {
    return agentsResponse($response, function () use ($request) {
        agentsAuthorize($request, 'policy');
        if ($request->getQueryParams()) { throw new \InvalidArgumentException('invalid_query'); }
        return agentsNativeInventory();
    });
});

function agentsNativeBody(Request $request)
{
    if ($request->getQueryParams() || ($request->getBody()->getSize() ?? 0) > 65536 ||
        stripos($request->getHeaderLine('Content-Type'), 'application/json') !== 0) {
        throw new \InvalidArgumentException('invalid_request');
    }
    return AgentWorkflowClient::decodeObject((string) $request->getBody());
}

$app->put('/agents/native/profiles/{profileId:internal|external}', function (Request $request, Response $response, array $args) {
    return agentsResponse($response, function () use ($request, $args) {
        agentsAuthorize($request, 'policy', true); $value = agentsNativeBody($request);
        if (array_diff(array_keys($value), array('profile', 'expected_revision', 'directory')) ||
            !($value['profile'] ?? null) instanceof \stdClass || !is_int($value['expected_revision'] ?? null)) {
            throw new \InvalidArgumentException('invalid_request');
        }
        $profile = (array) $value['profile'];
        foreach (array('permissions', 'tools', 'company', 'calendar_services', 'knowledge', 'transfer_policy') as $field) {
            if (isset($profile[$field])) {
                if (!$profile[$field] instanceof \stdClass) { throw new \InvalidArgumentException('invalid_request'); }
                $profile[$field] = json_decode(json_encode($profile[$field], JSON_THROW_ON_ERROR), true, 48, JSON_THROW_ON_ERROR);
            }
        }
        if (isset($value['directory']) && !$value['directory'] instanceof \stdClass) { throw new \InvalidArgumentException('invalid_request'); }
        $directory = isset($value['directory']) ? json_decode(json_encode($value['directory'], JSON_THROW_ON_ERROR), true, 48, JSON_THROW_ON_ERROR) : array();
        $saved = FreePBX::Satellite()->saveAgentProfile($args['profileId'], $profile, $value['expected_revision'], $directory);
        foreach (array('permissions', 'tools', 'company', 'calendar_services', 'knowledge', 'transfer_policy') as $field) {
            $saved[$field] = (object) $saved[$field];
        }
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
        return array('profile' => $saved, 'sync' => (new AgentConfigurationState(FreePBX::Database()))->status());
    });
});

foreach (array(array('POST', '/agents/native/bindings'), array('PUT', '/agents/native/bindings/{bindingId:[1-9][0-9]{0,8}}')) as $route) {
    $app->map(array($route[0]), $route[1], function (Request $request, Response $response, array $args) {
        return agentsResponse($response, function () use ($request, $args) {
            agentsAuthorize($request, 'policy', true); $value = agentsNativeBody($request);
            if (array_keys($value) !== array('binding') || !$value['binding'] instanceof \stdClass) {
                throw new \InvalidArgumentException('invalid_request');
            }
            $binding = (array) $value['binding'];
            $fields = array('name', 'provider', 'runtime_owner', 'openai_project_id', 'grok_phone_number',
                'sip_auth_mode', 'sip_auth_username', 'api_key', 'sip_auth_password', 'webhook_signing_secret');
            if (array_diff(array_keys($binding), $fields)) { throw new \InvalidArgumentException('invalid_request'); }
            $id = FreePBX::Satellite()->saveAgentTrunk($binding, isset($args['bindingId']) ? (int) $args['bindingId'] : null);
            system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
            return array('binding' => FreePBX::Satellite()->getAgentTrunk($id), 'sync' => (new AgentConfigurationState(FreePBX::Database()))->status());
        });
    });
}
