<?php
// SPDX-License-Identifier: GPL-3.0-or-later
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\ResponseInterface as Response;
require_once __DIR__ . '/../lib/agents/Access.php';

// Global AuthMiddleware enforces Wizard credentials and administrator rights.
// All configuration mutations share the admin identity and CSRF guards below.
$app->get('/agents/access', function (Request $request, Response $response) {
    try {
        $user = $request->getAttribute('nethvoice_admin');
        if (!is_string($user) || $user === '') {
            return jsonResponse($response, ['error' => 'forbidden'], 403);
        }
        // NS8 Traefik supplies the request scheme; Apache serves the same-origin UI.
        $scheme = $request->getHeaderLine('X-Forwarded-Proto') ?: $request->getUri()->getScheme();
        \NethVoice\Agents\Access::requireSameOrigin($request->getHeaderLine('Origin'),
            $request->getHeaderLine('Host'), $scheme, $request->getHeaderLine('Sec-Fetch-Site'));
        $envelope = \NethVoice\Agents\Access::envelope($user);
        session_write_close();
        return jsonResponse($response, $envelope)->withHeader('Cache-Control', 'no-store');
    } catch (\Throwable $error) {
        return jsonResponse($response, ['error' => $error->getCode() === 403 ? 'forbidden' : 'access_unavailable'],
            $error->getCode() === 403 ? 403 : 503)
            ->withHeader('Cache-Control', 'no-store');
    }
});

require_once __DIR__ . '/../lib/agents/Service.php';
// Shared HTTP boundary; the service and FreePBX hooks do not depend on Slim.
$agentsRoute = function (string $method, string $path, callable $operation) use ($app) {
    $app->map([$method], '/agents' . $path, function (Request $request, Response $response, array $args) use ($operation, $method) {
        try {
            $user = $request->getAttribute('nethvoice_admin');
            if (!is_string($user) || $user === '') throw new RuntimeException('forbidden',403);
            \NethVoice\Agents\Access::requireSameOrigin($request->getHeaderLine('Origin'), $request->getHeaderLine('Host'),
                $request->getHeaderLine('X-Forwarded-Proto') ?: $request->getUri()->getScheme(), $request->getHeaderLine('Sec-Fetch-Site'));
            $input = [];
            if ($method !== 'GET') {
                \NethVoice\Agents\Access::requireCsrf($user,$request->getHeaderLine('X-Agents-CSRF'));
                if (strlen((string)$request->getBody()) > 65536) throw new RuntimeException('request_too_large',413);
                if (strtolower(explode(';',$request->getHeaderLine('Content-Type'))[0]) !== 'application/json') throw new RuntimeException('invalid_envelope',422);
                $input=$request->getParsedBody();
                if (!is_array($input) || array_is_list($input)) throw new RuntimeException('invalid_envelope',422);
                $modelDiscovery=$request->getUri()->getPath()==='/freepbx/rest/agents/trunks/models';
                if (!str_ends_with($request->getUri()->getPath(),'/synchronize') && !$modelDiscovery) {
                    if (!isset($input['expected_revision']) || !is_int($input['expected_revision']) || $input['expected_revision'] < 0) throw new RuntimeException('invalid_revision',422);
                }
                $path=$request->getUri()->getPath();
                $allowed=['expected_revision'];
                if ($modelDiscovery) $allowed=['provider','binding_id','api_key'];
                elseif (str_ends_with($path,'/synchronize')) $allowed=['retry'];
                elseif (str_ends_with($path,'/enabled')) $allowed[]='enabled';
                elseif ($method==='PUT' || ($method==='POST' && !str_ends_with($path,'/publish'))) {
                    $field=str_contains($path,'/trunks')?'trunk':'profile';
                    $allowed[]=$field;
                    if (!is_array($input[$field]??null) || array_is_list($input[$field])) throw new RuntimeException('invalid_envelope',422);
                }
                if (array_diff(array_keys($input),$allowed)) throw new RuntimeException('invalid_envelope',422);
            }
            if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
            $service=new \NethVoice\Agents\Service(FreePBX::Database());
            $result=$operation($service,$args,$input,$request->getQueryParams(),$user);
            return jsonResponse($response,$result)->withHeader('Cache-Control','no-store');
        } catch (Throwable $error) {
            $known=$error instanceof RuntimeException && preg_match('/^[a-z_]{1,64}$/D',$error->getMessage());
            if (!$known && !($error instanceof InvalidArgumentException && $error->getMessage()==='csrf_invalid')) {
                // Structural diagnostics only: never log request bodies, keys or exception messages.
                try { error_log('agents_request_failure '.get_class($error).' at '.basename($error->getFile()).':'.$error->getLine()); } catch (Throwable $loggingError) {}
            }
            $status=$known && in_array($error->getCode(),[403,404,409,413,422,503],true) ? $error->getCode() : 503;
            $code=$error instanceof InvalidArgumentException && $error->getMessage()==='csrf_invalid' ? 'csrf_invalid' : ($known ? $error->getMessage() : 'request_unavailable');
            if ($code==='csrf_invalid') $status=403;
            return jsonResponse($response,['error'=>$code],$status)->withHeader('Cache-Control','no-store');
        }
    });
};
$agentsRoute('GET','/catalog',fn($s)=>$s->catalog());
$agentsRoute('GET','/destinations',fn($s,$a,$i,$q)=>$s->destinations($q));
$agentsRoute('GET','/profiles',fn($s)=>['items'=>$s->all()]);
$agentsRoute('GET','/profiles/{id}',fn($s,$a)=>$s->get($a['id']));
$agentsRoute('POST','/profiles',fn($s,$a,$i,$q,$u)=>$s->save(null,$i['profile']??[],$i['expected_revision'],$u));
$agentsRoute('PUT','/profiles/{id}',fn($s,$a,$i,$q,$u)=>$s->save($a['id'],$i['profile']??[],$i['expected_revision'],$u));
$agentsRoute('POST','/profiles/{id}/publish',fn($s,$a,$i,$q,$u)=>$s->publish($a['id'],$i['expected_revision'],$u));
$agentsRoute('POST','/profiles/{id}/enabled',function($s,$a,$i,$q,$u) {
    if (!is_bool($i['enabled']??null)) throw new RuntimeException('invalid_envelope',422);
    return $s->enable($a['id'],$i['enabled'],$i['expected_revision'],$u);
});
$agentsRoute('DELETE','/profiles/{id}',fn($s,$a,$i,$q,$u)=>$s->remove($a['id'],$i['expected_revision'],$u));
$agentsRoute('GET','/trunks',fn($s)=>['items'=>$s->trunks()]);
$agentsRoute('POST','/trunks/models',fn($s,$a,$i)=>$s->models($i));
$agentsRoute('GET','/trunks/{id}/voices',fn($s,$a)=>$s->voices($a['id']));
$agentsRoute('POST','/trunks',fn($s,$a,$i,$q,$u)=>$s->saveTrunk(null,$i['trunk']??[],$i['expected_revision'],$u));
$agentsRoute('PUT','/trunks/{id}',fn($s,$a,$i,$q,$u)=>$s->saveTrunk($a['id'],$i['trunk']??[],$i['expected_revision'],$u));
$agentsRoute('DELETE','/trunks/{id}',fn($s,$a,$i,$q,$u)=>$s->removeTrunk($a['id'],$i['expected_revision'],$u));
$agentsRoute('POST','/synchronize',fn($s,$a,$i,$q,$u)=>$s->synchronize($u));
$agentsRoute('GET','/runs',function($s,$a,$i,$q) {
    $page=$q['page']??'1';
    if (!is_scalar($page) || !preg_match('/^[1-9][0-9]{0,4}$/D',(string)$page)) throw new RuntimeException('invalid_page',422);
    if (isset($q['agent_id']) && !is_string($q['agent_id'])) throw new RuntimeException('invalid_identifier',422);
    return $s->runs($q['agent_id']??null,(int)$page,$q);
});
$agentsRoute('GET','/monitoring/summary',fn($s,$a,$i,$q)=>$s->monitoringSummary($q));
$agentsRoute('GET','/monitoring/health',fn($s)=>$s->monitoringHealth());
$agentsRoute('GET','/runs/{id}/trace',fn($s,$a,$i,$q)=>$s->trace($a['id'],$q));
$agentsRoute('GET','/runs/{id}',fn($s,$a)=>$s->run($a['id']));
