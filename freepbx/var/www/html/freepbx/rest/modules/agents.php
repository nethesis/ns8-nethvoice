<?php
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\ResponseInterface as Response;

require_once __DIR__ . '/../../admin/modules/satellite/lib/AgentMonitoringClient.php';
require_once __DIR__ . '/../../admin/modules/satellite/lib/AgentMonitoringRepository.php';
require_once __DIR__ . '/../../admin/modules/satellite/lib/AgentConfigurationBuilder.php';
require_once __DIR__ . '/../lib/AgentApplicationClient.php';

/** Administrator scope is assigned by authentication middleware, never a browser claim. */
function agentsAuthorize(Request $request, $scope, $mutation = false)
{
    $user = $request->getAttribute('nethvoice_admin');
    if (!is_string($user) || $user === '' || !in_array($scope, array('metadata', 'transcripts', 'policy', 'connectors', 'api_access'), true)) {
        throw new \RuntimeException('forbidden', 403);
    }
    // Header authentication is required even if an AMP session already exists.
    // Also reject cross-site browser requests; API clients may omit Origin.
    $origin = $request->getHeaderLine('Origin');
    if ($request->getHeaderLine('Sec-Fetch-Site') === 'cross-site') {
        throw new \RuntimeException('forbidden_origin', 403);
    }
    if ($origin !== '') {
        $parts = parse_url($origin);
        $host = getenv('NETHVOICE_HOST');
        if (!$parts || ($parts['scheme'] ?? '') !== 'https' ||
            !hash_equals(strtolower((string) $host), strtolower($parts['host'] ?? '')) ||
            isset($parts['user']) || isset($parts['pass']) || (isset($parts['port']) && $parts['port'] !== 443)) {
            throw new \RuntimeException('forbidden_origin', 403);
        }
    }
    if ($mutation) {
        if (session_status() !== PHP_SESSION_ACTIVE) { session_start(); }
        $valid = isset($_SESSION['agents_csrf'], $_SESSION['agents_user']) &&
            hash_equals($_SESSION['agents_user'], $user) &&
            hash_equals($_SESSION['agents_csrf'], $request->getHeaderLine('X-Agents-CSRF'));
        session_write_close();
        if (!$valid) { throw new \RuntimeException('invalid_csrf', 403); }
    }
    return preg_match('/^[A-Za-z0-9_.@-]{1,128}$/D', $user) ? $user : 'admin-' . hash('sha256', $user);
}

function agentsResponse(Response $response, callable $operation)
{
    $response = $response->withHeader('Cache-Control', 'no-store')->withHeader('X-Content-Type-Options', 'nosniff');
    try { return jsonResponse($response, $operation()); }
    catch (\InvalidArgumentException $error) { return jsonResponse($response, array('error' => 'invalid_request'), 400); }
    catch (\Throwable $error) {
        $code = (int) $error->getCode();
        if (!in_array($code, array(400, 403, 404, 409, 413, 422, 429, 503), true)) { $code = 503; }
        $safe = array(400 => 'invalid_request', 403 => 'forbidden', 404 => 'run_not_found',
            409 => 'configuration_conflict', 413 => 'request_too_large', 422 => 'invalid_query',
            429 => 'capacity_reached', 503 => 'monitoring_unavailable');
        return jsonResponse($response, array('error' => $safe[$code]), $code);
    }
}

$app->get('/agents/access', function (Request $request, Response $response) {
    return agentsResponse($response, function () use ($request) {
        agentsAuthorize($request, 'metadata');
        if (session_status() !== PHP_SESSION_ACTIVE) { session_start(); }
        $user = $request->getAttribute('nethvoice_admin');
        if (!isset($_SESSION['agents_csrf']) || ($_SESSION['agents_user'] ?? '') !== $user) {
            $_SESSION['agents_csrf'] = bin2hex(random_bytes(32));
            $_SESSION['agents_user'] = $user;
        }
        $token = $_SESSION['agents_csrf']; session_write_close();
        return array('csrf' => $token, 'scopes' => array('metadata', 'transcripts', 'policy', 'connectors', 'api_access'));
    });
});

$app->get('/agents/policy', function (Request $request, Response $response) {
    return agentsResponse($response, function () use ($request) {
        agentsAuthorize($request, 'policy'); $db = FreePBX::Database();
        return array('policy' => (new AgentMonitoringRepository($db))->policy(),
            'sync' => (new AgentConfigurationState($db))->status());
    });
});

$app->put('/agents/policy', function (Request $request, Response $response) {
    return agentsResponse($response, function () use ($request) {
        $actor = agentsAuthorize($request, 'policy', true);
        if (($request->getBody()->getSize() ?? 0) > 4096 ||
            stripos($request->getHeaderLine('Content-Type'), 'application/json') !== 0) {
            throw new \InvalidArgumentException('invalid_request');
        }
        $result = (new AgentMonitoringRepository(FreePBX::Database()))->save($request->getParsedBody(), $actor);
        try { (new AgentConfigurationBuilder(FreePBX::create()))->synchronize(); }
        catch (\Throwable $error) { /* Native policy is saved; the sync timer retries. */ }
        $result['sync'] = (new AgentConfigurationState(FreePBX::Database()))->status();
        $result['applied'] = false;
        if ($result['sync']['acknowledged_revision'] === $result['revision']) {
            try {
                $health = (new AgentMonitoringClient())->request('GET', '/health');
                $result['applied'] = !empty($health['available']);
            } catch (\Throwable $error) { /* Writer health remains explicitly pending. */ }
        }
        return $result;
    });
});

// Register concrete, allowlisted read routes. No arbitrary backend path forwarding.
foreach (array('overview', 'health', 'agents', 'runs') as $operation) {
    $app->get('/agents/' . $operation, function (Request $request, Response $response) use ($operation) {
        return agentsResponse($response, function () use ($request, $operation) {
            agentsAuthorize($request, 'metadata');
            $allowed = $operation === 'runs' ? array('limit', 'cursor', 'agent', 'provider', 'outcome', 'correlation', 'after', 'before', 'tool_error', 'execution_kind') :
                ($operation === 'overview' ? array('hours') : array());
            $query = $request->getQueryParams();
            foreach ($query as $key => $value) {
                if (!in_array($key, $allowed, true) || !is_scalar($value) || strlen((string) $value) > 512) {
                    throw new \InvalidArgumentException('invalid_query');
                }
            }
            $result = (new AgentMonitoringClient())->request('GET', '/' . $operation, $query);
            if ($operation === 'overview') { $result['configuration_sync'] = (new AgentConfigurationState(FreePBX::Database()))->status(); }
            return $result;
        });
    });
}
foreach (array('' => 'metadata', '/events' => 'metadata', '/transcript' => 'transcripts') as $suffix => $scope) {
    $app->get('/agents/runs/{id:[A-Za-z0-9_.:-]{1,128}}' . $suffix,
        function (Request $request, Response $response, array $args) use ($suffix, $scope) {
            return agentsResponse($response, function () use ($request, $args, $suffix, $scope) {
                agentsAuthorize($request, $scope); $query = $request->getQueryParams();
                foreach ($query as $key => $value) {
                    if ($suffix !== '/events' || !in_array($key, array('cursor', 'limit'), true) ||
                        !is_scalar($value) || strlen((string) $value) > 512) {
                        throw new \InvalidArgumentException('invalid_query');
                    }
                }
                return (new AgentMonitoringClient())->request('GET', '/runs/' . $args['id'] . $suffix, $query);
            });
        });
}
$app->delete('/agents/runs/{id:[A-Za-z0-9_.:-]{1,128}}/transcript',
    function (Request $request, Response $response, array $args) {
        return agentsResponse($response, function () use ($request, $args) {
            $actor = agentsAuthorize($request, 'transcripts', true);
            return (new AgentMonitoringClient())->request('DELETE', '/runs/' . $args['id'] . '/transcript', array(), $actor);
        });
    });

// Application-owned resources: all routes are concrete and administrator-only.
$app->get('/agents/application/inventory', function (Request $request, Response $response) {
    return agentsResponse($response, function () use ($request) {
        $actor = agentsAuthorize($request, 'connectors');
        if ($request->getQueryParams()) { throw new \InvalidArgumentException('invalid_query'); }
        return (new AgentApplicationClient())->request('GET', '/inventory', $actor);
    });
});
$applicationRoutes = array(
    array('PUT', '/settings', 'connectors'),
    array('PUT', '/resources/{kind:connector|preset}/{resourceId:[a-z][a-z0-9_-]{0,47}}', 'connectors'),
    array('POST', '/resources/{kind:connector|preset}/{resourceId:[a-z][a-z0-9_-]{0,47}}/publish', 'connectors'),
    array('DELETE', '/versions/{kind:connector|preset}/{resourceId:[a-z][a-z0-9_-]{0,47}}/{version:[1-9][0-9]{0,5}}', 'connectors'),
    array('POST', '/secrets', 'connectors'),
    array('DELETE', '/secrets/{secretId:[a-z][a-z0-9_-]{0,47}}', 'connectors'),
    array('PUT', '/grants/{agentId:internal|external|support-request}', 'connectors'),
    array('POST', '/clients', 'api_access'),
    array('DELETE', '/clients/{clientId:[a-z][a-z0-9_-]{0,47}}', 'api_access'),
    array('POST', '/test-runs', 'api_access'),
    array('POST', '/runs/{runId:[a-f0-9]{32}}/cancel', 'api_access'),
    array('POST', '/effects/{operationId:[a-f0-9]{32}}/reconcile', 'connectors')
);
foreach ($applicationRoutes as $route) {
    list($method, $path, $scope) = $route;
    $app->map(array($method), '/agents/application' . $path,
        function (Request $request, Response $response, array $args) use ($method, $path, $scope) {
            return agentsResponse($response, function () use ($request, $args, $method, $path, $scope) {
                $actor = agentsAuthorize($request, $scope, true);
                if ($request->getQueryParams()) { throw new \InvalidArgumentException('invalid_query'); }
                $target = AgentApplicationClient::path($path, $args);
                $input = null;
                if ($method !== 'DELETE') {
                    if (($request->getBody()->getSize() ?? 0) > 65536 ||
                        stripos($request->getHeaderLine('Content-Type'), 'application/json') !== 0) {
                        throw new \InvalidArgumentException('invalid_request');
                    }
                    $input = $request->getParsedBody();
                    if (!is_array($input)) { throw new \InvalidArgumentException('invalid_request'); }
                }
                return (new AgentApplicationClient())->request($method, $target, $actor, $input);
            });
        });
}
$app->get('/agents/application/runs/{runId:[a-f0-9]{32}}/result',
    function (Request $request, Response $response, array $args) {
        return agentsResponse($response, function () use ($request, $args) {
            $actor = agentsAuthorize($request, 'api_access');
            if ($request->getQueryParams()) { throw new \InvalidArgumentException('invalid_query'); }
            return (new AgentApplicationClient())->request('GET', '/runs/' . $args['runId'] . '/result', $actor);
        });
    });
