<?php

/*
 * Copyright (C) 2020 Nethesis S.r.l.
 * http://www.nethesis.it - nethserver@nethesis.it
 *
 * This script is part of NethServer.
 *
 * NethServer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License,
 * or any later version.
 *
 * NethServer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with NethServer.  If not, see COPYING.
 */

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../src/init.php';

define("JSON_FLAGS",JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);

use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\ResponseInterface as Response;
use Slim\Factory\AppFactory;
use DI\ContainerBuilder;

$containerBuilder = new ContainerBuilder();
$containerBuilder->addDefinitions([
    'config' => function() {
        global $config;
        return $config;
    },
    'logger' => function($c) {
        return \Tancredi\LoggerFactory::createLogger('api-v1', $c);
    },
    'storage' => function($c) {
        return new \Tancredi\Entity\FileStorage($c->get('logger'), $c->get('config'));
    }
]);

$container = $containerBuilder->build();
AppFactory::setContainer($container);
$app = AppFactory::create();
$basePath = rtrim($config['api_url_path'], '/');
$app->setBasePath($basePath);
$app->addBodyParsingMiddleware();
$app->addRoutingMiddleware();

// Register the client IP address for logging
$upstreamProxies = array_map('trim', explode(',', isset($config['upstream_proxies']) ? $config['upstream_proxies'] : ''));
$app->add(new \RKA\Middleware\IpAddress( ! empty($upstreamProxies), $upstreamProxies));

// load auth middleware if it exists
if (array_key_exists('auth_class',$config) and !empty($config['auth_class'])) {
    $auth_class = "\\Tancredi\\Entity\\" . $config['auth_class'];
    $app->add(new $auth_class($config));
}

// Add request/response logging middleware
$app->add(new \Tancredi\LoggingMiddleware($container->get('logger')));
// Use config-driven flag for error details; default to false for production safety
$displayErrorDetails = isset($config['displayErrorDetails']) ? (bool)$config['displayErrorDetails'] : false;
$app->addErrorMiddleware($displayErrorDetails, true, true);

/*********************************
* GET /phones
**********************************/
$app->get('/phones', function(Request $request, Response $response) use ($app) {
    global $config;
    $container = $app->getContainer();
    $storage = $container->get('storage');
    $logger = $container->get('logger');
    
    $scopes = $storage->listScopes('phone');
    $results = array();
    foreach ($scopes as $scopeId) {
        $scope = new \Tancredi\Entity\Scope($scopeId, $storage, $logger);
        $scope_data = $scope->getVariables();
        $results[] = array(
            'mac' => $scopeId,
            'model' => $scope->metadata['inheritFrom'],
            'display_name' => $scope->metadata['displayName'],
            'model_url' => $config['api_url_path'] . "models/" . $scope->metadata['inheritFrom'],
            'phone_url' => $config['api_url_path'] . "phones/" . $scopeId
        );
    }

    $response = withJson($response, $results, 200, JSON_FLAGS);
    return $response;
});

/*********************************
* GET /phones/{mac}
**********************************/
$app->get('/phones/{mac}', function(Request $request, Response $response, array $args) use ($app) {
    $mac = $args['mac'];
    $container = $app->getContainer();
    $storage = $container->get('storage');
    $logger = $container->get('logger');

    $query = $request->getQueryParams();
    // get all scopes of type "phone"
    if (!$storage->scopeExists($mac)) {
        $results = array(
            'type' => 'https://nethesis.github.io/tancredi/problems/#not-found',
            'title' => 'Resource not found'
        );
        $response = withJson($response, $results, 404, JSON_FLAGS);
        $response = $response->withHeader('Content-Type', 'application/problem+json');
        $response = $response->withHeader('Content-Language', 'en');
        return $response;
    }
    $inherit = isset($query['inherit']) && $query['inherit'] == 1;
    $results = \Tancredi\Entity\Scope::getPhoneScope($mac, $storage, $logger, $inherit);
    $response = withJson($response, $results, 200, JSON_FLAGS);
    return $response;
});

/*********************************
* POST /phones
**********************************/
$app->post('/phones', function (Request $request, Response $response, $args) use ($app) {
    $container = $app->getContainer();
    $storage = $container->get('storage');
    $logger = $container->get('logger');

    $post_data = $request->getParsedBody();
    $mac = $post_data['mac'];
    $model = $post_data['model'];
    $display_name = ($post_data['display_name'] ? $post_data['display_name'] : "" );
    $variables = array_key_exists('variables',$post_data) ? $post_data['variables'] : array();
    if (empty($mac)) {
        $results = array(
            'type' => 'https://nethesis.github.io/tancredi/problems/#malformed-data',
            'title' => 'Missing MAC address'
        );
        $response = withJson($response, $results, 400, JSON_FLAGS);
        $response = $response->withHeader('Content-Type', 'application/problem+json');
        $response = $response->withHeader('Content-Language', 'en');
        return $response;
    }
    if ($storage->scopeExists($mac)) {
        // Error: scope is already configured
        $results = array(
            'type' => 'https://nethesis.github.io/tancredi/problems/#phone-exists',
            'title' => 'The phone mac address is already registered'
        );
        $response = withJson($response, $results, 409, JSON_FLAGS);
        $response = $response->withHeader('Content-Type', 'application/problem+json');
        $response = $response->withHeader('Content-Language', 'en');
        return $response;
    }
    $scope = new \Tancredi\Entity\Scope($mac, $storage, $logger);
    $scope->metadata['displayName'] = $display_name;
    $scope->metadata['inheritFrom'] = $model;
    $scope->metadata['scopeType'] = "phone";
    $scope->setVariables($variables);
    \Tancredi\Entity\TokenManager::createToken(str_replace(".", "", uniqid($prefix = rand(), $more_entropy = TRUE)), $mac , TRUE); // create first time access token
    \Tancredi\Entity\TokenManager::createToken(str_replace(".", "", uniqid($prefix = rand(), $more_entropy = TRUE)), $mac , FALSE); // create token
    $response = withJson($response, \Tancredi\Entity\Scope::getPhoneScope($mac, $storage, $logger), 201, JSON_FLAGS);
    $response = $response->withHeader('Location', '/tancredi/api/v1/phones/' . $mac);
    return $response;
});

/*********************************
* PATCH /phones[/]
**********************************/
$app->patch('/phones[/]', function (Request $request, Response $response) {
    $results = array(
        'type' => 'https://nethesis.github.io/tancredi/problems/#malformed-data',
        'title' => 'Missing MAC address'
    );
    $response = withJson($response, $results, 400, JSON_FLAGS);
    $response = $response->withHeader('Content-Type', 'application/problem+json');
    $response = $response->withHeader('Content-Language', 'en');
    return $response;
});

/*********************************
* PATCH /phones/{mac}
**********************************/
$app->patch('/phones/{mac}', function (Request $request, Response $response, $args) use ($app) {
    $mac = $args['mac'];
    $container = $app->getContainer();
    $storage = $container->get('storage');
    $logger = $container->get('logger');

    $patch_data = $request->getParsedBody();

    if (!$storage->scopeExists($mac)) {
        $results = array(
            'type' => 'https://nethesis.github.io/tancredi/problems/#not-found',
            'title' => 'Resource not found'
        );
        $response = withJson($response, $results, 404, JSON_FLAGS);
        $response = $response->withHeader('Content-Type', 'application/problem+json');
        $response = $response->withHeader('Content-Language', 'en');
        return $response;
    }

    $readonly_params = ['mac', 'short_mac', 'model_url', 'tok1', 'tok2', 'provisioning_url1', 'provisioning_url2'];
    if (array_intersect($readonly_params, array_keys($patch_data))) {
        $results = array(
            'type' => 'https://nethesis.github.io/tancredi/problems/#read-only-attribute',
            'title' => 'Cannot change a read-only attribute'
        );
        $response = withJson($response, $results, 403, JSON_FLAGS);
        $response = $response->withHeader('Content-Type', 'application/problem+json');
        $response = $response->withHeader('Content-Language', 'en');
        return $response;
    }

    if (array_key_exists('model',$patch_data)) {
        $scope = new \Tancredi\Entity\Scope($mac, $storage, $logger);
        $scope->metadata['inheritFrom'] = $patch_data['model'];
        $scope->setVariables();
        $response = withJson($response, \Tancredi\Entity\Scope::getPhoneScope($mac, $storage, $logger), 200, JSON_FLAGS);
        return $response;
    }
    if (array_key_exists('variables',$patch_data)) {
        $scope = new \Tancredi\Entity\Scope($mac, $storage, $logger);
        $scope->setVariables($patch_data['variables']);
        $response = withJson($response, \Tancredi\Entity\Scope::getPhoneScope($mac, $storage, $logger), 200, JSON_FLAGS);
        return $response;
    }
    $response = $response->withStatus(400);
    return $response;
});

/*********************************
* DELETE /phones/{mac}
**********************************/
$app->delete('/phones/{mac}', function (Request $request, Response $response, $args) use ($app) {
    $mac = $args['mac'];
    $container = $app->getContainer();
    $storage = $container->get('storage');

    if (!$storage->scopeExists($mac)) {
        $results = array(
            'type' => 'https://nethesis.github.io/tancredi/problems/#not-found',
            'title' => 'Resource not found'
        );
        $response = withJson($response, $results, 404, JSON_FLAGS);
        $response = $response->withHeader('Content-Type', 'application/problem+json');
        $response = $response->withHeader('Content-Language', 'en');
        return $response;
    }
    \Tancredi\Entity\TokenManager::deleteToken(\Tancredi\Entity\TokenManager::getToken1($mac));
    \Tancredi\Entity\TokenManager::deleteToken(\Tancredi\Entity\TokenManager::getToken2($mac));
    $storage->deleteScope($mac);
    $response = $response->withStatus(204);
    return $response;
});

/*********************************
* GET /models
**********************************/
$app->get('/models', function(Request $request, Response $response) use ($app) {
    global $config;
    global $macvendors;
    $container = $app->getContainer();
    $storage = $container->get('storage');
    $logger = $container->get('logger');

    $query_params = $request->getQueryParams();
    $scopes = $storage->listScopes('model');
    $results = array();

    $filter_used = FALSE;
    if (array_key_exists('filter', $query_params) && array_key_exists('used', $query_params['filter'])) {
        $filter_used = TRUE;
        // get all scopes that are inherited by other scopes
        $inherited_scopes = array();
        foreach ($storage->listScopes() as $scopeId) {
            $scope = new \Tancredi\Entity\Scope($scopeId, $storage, $logger);
            if ( ! empty($scope->metadata['inheritFrom']) && array_search($scope->metadata['inheritFrom'],$inherited_scopes) === FALSE) {
                $inherited_scopes[] = $scope->metadata['inheritFrom'];
            }
        }
    }

    foreach ($scopes as $scopeId) {
        if ($filter_used && array_search($scopeId,$inherited_scopes) === FALSE) {
            continue;
        }
        if (isset($macvendors) && array_search(preg_replace('/^([^\-]*)-.*/','$1',$scopeId),$macvendors) === FALSE) {
            continue;
        }
        $scope = new \Tancredi\Entity\Scope($scopeId, $storage, $logger);
        $scope_data = $scope->getVariables();
        $results[] = array(
            'name' => $scopeId,
            'display_name' => $scope->metadata['displayName'],
            'model_url' => $config['api_url_path'] . "models/" . $scopeId
        );
    }
    $response = withJson($response, $results, 200, JSON_FLAGS);
    return $response;
});

/*********************************
* GET /models/{id}
**********************************/
$app->get('/models/{id}[/version/{version:original}]', function(Request $request, Response $response, array $args) use ($app) {
    $id = $args['id'];
    $container = $app->getContainer();
    $storage = $container->get('storage');
    $logger = $container->get('logger');

    if (array_key_exists('version',$args) && $args['version'] == 'original') {
        $original = true;
    } else {
        $original = false;
    }
    $query = $request->getQueryParams();
    // get all scopes of type "model"
    if (!$storage->scopeExists($id) or $storage->getScopeMeta($id,'scopeType') !== 'model') {
        $results = array(
            'type' => 'https://nethesis.github.io/tancredi/problems/#not-found',
            'title' => 'Resource not found'
        );
        $response = withJson($response, $results, 404, JSON_FLAGS);
        $response = $response->withHeader('Content-Type', 'application/problem+json');
        $response = $response->withHeader('Content-Language', 'en');
        return $response;
    }
    if (array_key_exists('inherit',$query) and $query['inherit'] == 1) {
        $results = getModelScope($id, $storage, $logger, true, $original);
    } else {
        $results = getModelScope($id, $storage, $logger, false, $original);
    }
    $response = withJson($response, $results, 200, JSON_FLAGS);
    return $response;
});

/*********************************
* POST /models
**********************************/
$app->post('/models', function (Request $request, Response $response, $args) use ($app) {
    $container = $app->getContainer();
    $storage = $container->get('storage');
    $logger = $container->get('logger');

    $post_data = $request->getParsedBody();
    $id = $post_data['name'];
    $display_name = ($post_data['display_name'] ? $post_data['display_name'] : "" );
    $variables = $post_data['variables'];
    if (empty($id)) {
        $results = array(
            'type' => 'https://nethesis.github.io/tancredi/problems/#malformed-data',
            'title' => 'Missing model name'
        );
        $response = withJson($response, $results, 400, JSON_FLAGS);
        $response = $response->withHeader('Content-Type', 'application/problem+json');
        $response = $response->withHeader('Content-Language', 'en');
        return $response;
    }
    if (preg_match('/^[a-zA-Z0-9_\-\.]+$/',$id) == 0) {
        $results = array(
            'type' => 'https://nethesis.github.io/tancredi/problems/#malformed-data',
            'title' => 'Illegal character(s) in model name'
        );
        $response = withJson($response, $results, 400, JSON_FLAGS);
        $response = $response->withHeader('Content-Type', 'application/problem+json');
        $response = $response->withHeader('Content-Language', 'en');
        return $response;
    }
    if ($storage->scopeExists($id)) {
        // Error: scope is already configured
        $results = array(
            'type' => 'https://nethesis.github.io/tancredi/problems/#phone-exists',
            'title' => 'The model name is already registered'
        );
        $response = withJson($response, $results, 409, JSON_FLAGS);
        $response = $response->withHeader('Content-Type', 'application/problem+json');
        $response = $response->withHeader('Content-Language', 'en');
        return $response;
    }
    $scope = new \Tancredi\Entity\Scope($id, $storage, $logger);
    $scope->metadata['displayName'] = $display_name;
    $scope->metadata['scopeType'] = "model";
    $scope->setVariables($variables);
    $response = withJson($response, getModelScope($id, $storage, $logger), 201, JSON_FLAGS);
    $response = $response->withHeader('Location', '/tancredi/api/v1/models/' . $id);
    return $response;
});

/*********************************
* PATCH /models/{id}
**********************************/
$app->patch('/models/{id}', function (Request $request, Response $response, $args) use ($app) {
    $id = $args['id'];
    $container = $app->getContainer();
    $storage = $container->get('storage');
    $logger = $container->get('logger');

    $patch_data = $request->getParsedBody();

    if (!$storage->scopeExists($id)) {
        $results = array(
            'type' => 'https://nethesis.github.io/tancredi/problems/#not-found',
            'title' => 'Resource not found'
        );
        $response = withJson($response, $results, 404, JSON_FLAGS);
        $response = $response->withHeader('Content-Type', 'application/problem+json');
        $response = $response->withHeader('Content-Language', 'en');
    	return $response;
    }

    if (array_key_exists('name',$patch_data)) {
        $results = array(
            'type' => 'https://nethesis.github.io/tancredi/problems/#read-only-attribute',
            'title' => 'Cannot change a read-only attribute'
        );
        $response = withJson($response, $results, 403, JSON_FLAGS);
        $response = $response->withHeader('Content-Type', 'application/problem+json');
        $response = $response->withHeader('Content-Language', 'en');
        return $response;
    }

    if (array_key_exists('variables',$patch_data) or array_key_exists('display_name',$patch_data)) {
        $scope = new \Tancredi\Entity\Scope($id, $storage, $logger);
        if (array_key_exists('display_name',$patch_data)) {
            $scope->metadata['displayName'] = $patch_data['display_name'];
        }
        if (array_key_exists('variables',$patch_data)) {
             $scope->setVariables($patch_data['variables']);
        } else {
             $scope->setVariables();
        }
        $response = withJson($response, getModelScope($id, $storage, $logger, false, false), 200, JSON_FLAGS);
        return $response;
    }
    $response = $response->withStatus(400);
    return $response;
});

/*********************************
* DELETE /models/{id}
**********************************/
$app->delete('/models/{id}', function (Request $request, Response $response, $args) use ($app) {
    $id = $args['id'];
    $container = $app->getContainer();
    $storage = $container->get('storage');

    if (!$storage->scopeExists($id)) {
        $results = array(
            'type' => 'https://nethesis.github.io/tancredi/problems/#not-found',
            'title' => 'Resource not found'
        );
        $response = withJson($response, $results, 404, JSON_FLAGS);
        $response = $response->withHeader('Content-Type', 'application/problem+json');
        $response = $response->withHeader('Content-Language', 'en');
        return $response;
    }

    if ($storage->scopeInUse($id)) {
         $results = array(
            'type' => 'https://nethesis.github.io/tancredi/problems/#resource-in-use',
            'title' => 'The resource is in use by other resources and cannot be deleted'
        );
        $response = withJson($response, $results, 409, JSON_FLAGS);
        $response = $response->withHeader('Content-Type', 'application/problem+json');
        $response = $response->withHeader('Content-Language', 'en');
        return $response;
    }

    $storage->deleteScope($id);
    $response = $response->withStatus(204);
    return $response;
});

/*********************************
* GET /defaults
**********************************/
$app->get('/defaults', function(Request $request, Response $response) use ($app) {
    $container = $app->getContainer();
    $storage = $container->get('storage');
    $logger = $container->get('logger');

    $scope = new \Tancredi\Entity\Scope('defaults', $storage, $logger);
    $scope_data = $scope->getVariables();
    $response = withJson($response, $scope_data, 200, JSON_FLAGS);
    return $response;
});

/*********************************
* PATCH /defaults
**********************************/
$app->patch('/defaults', function (Request $request, Response $response, $args) use ($app) {
    $container = $app->getContainer();
    $storage = $container->get('storage');
    $logger = $container->get('logger');

    $patch_data = $request->getParsedBody();

    $scope = new \Tancredi\Entity\Scope('defaults', $storage, $logger);
    foreach ($patch_data as $patch_key => $patch_value) {
        if (is_null($patch_value)) {
            unset($scope->data[$patch_key]);
            unset($patch_data[$patch_key]);
        }
    }

    $scope->setVariables($patch_data);
    $response = $response->withStatus(204);
    return $response;
});

/*********************************
* POST /backgrounds, /firmware, /ringtones, /screensavers
**********************************/
$app->post('/{filetype:backgrounds|firmware|ringtones|screensavers}', function(Request $request, Response $response, $args) use ($app) {
    $container = $app->getContainer();
    $config = $container->get('config');
    
    $uploadedFile = array_pop($request->getUploadedFiles());
    $files_directory = $args['filetype'];
    if ($uploadedFile->getError() === UPLOAD_ERR_OK) {
        if (! preg_match('/^[a-zA-Z0-9\-_\.()]+$/', $uploadedFile->getClientFilename())) {
            $results = array(
                'type' => 'https://nethesis.github.io/tancredi/problems/#invalid-file-name',
                'title' => 'Invalid file name'
            );
            $response = withJson($response, $results, 400, JSON_FLAGS);
            $response = $response->withHeader('Content-Type', 'application/problem+json');
            $response = $response->withHeader('Content-Language', 'en');
            return $response;
        }
        $uploadedFile->moveTo($config['rw_dir'] . $files_directory . '/' . $uploadedFile->getClientFilename());
        $realfile = realpath($config['rw_dir'] . $files_directory . '/' . $uploadedFile->getClientFilename());
        if( ! $realfile || dirname($realfile) != ($config['rw_dir'] . $files_directory)) {
            $results = array(
                'type' => 'https://nethesis.github.io/tancredi/problems/#not-found',
                'title' => 'Resource not found'
            );
            $response = withJson($response, $results, 404, JSON_FLAGS);
            $response = $response->withHeader('Content-Type', 'application/problem+json');
            $response = $response->withHeader('Content-Language', 'en');
            return $response;
        }
        return $response->withStatus(204);
    }
    return $response->withStatus(500);
});

/*********************************
* GET /backgrounds, /firmware, /ringtones, /screensavers
**********************************/
$app->get('/{filetype:backgrounds|firmware|ringtones|screensavers}', function(Request $request, Response $response, $args) use ($app) {
    $container = $app->getContainer();
    $config = $container->get('config');

    $files = glob($config['rw_dir'] . $args['filetype'] . '/*');
    $res = array();
    foreach ($files as $file) {
        $stats = stat($file);
        $res[] = array(
            'name' => basename($file),
            'size' => $stats['size'],
            'mtime' => $stats['mtime']
        );
    }
    $response = withJson($response, $res, 200, JSON_FLAGS);
    return $response;
});

/*********************************
* DELETE /backgrounds, /firmware, /ringtones, /screensavers
**********************************/
$app->delete('/{filetype:backgrounds|firmware|ringtones|screensavers}/{file}', function(Request $request, Response $response, $args) use ($app) {
    $container = $app->getContainer();
    $config = $container->get('config');

    $file = $args['file'];
    $files_directory = $args['filetype'];
    $realfile = realpath($config['rw_dir'] . $files_directory . '/' . $file);
    if( ! $realfile  || dirname($realfile) != ($config['rw_dir'] . $files_directory)) {
        $results = array(
            'type' => 'https://nethesis.github.io/tancredi/problems/#not-found',
            'title' => 'Resource not found'
        );
        $response = withJson($response, $results, 404, JSON_FLAGS);
        $response = $response->withHeader('Content-Type', 'application/problem+json');
        $response = $response->withHeader('Content-Language', 'en');
        return $response;
    } elseif (unlink($config['rw_dir'] . $files_directory . '/' . $file)) {
        $response = $response->withStatus(204);
        return $response;
    }
    $response = $response->withStatus(500);
    return $response;
});

/*********************************
* GET /macvendors
**********************************/
$app->get('/macvendors', function(Request $request, Response $response, $args) use ($app) {
    global $macvendors;
    $response = withJson($response, $macvendors, 200, JSON_FLAGS);
    return $response;
});

/*********************************
* POST /phones/{mac}/tok1
**********************************/
$app->post('/phones/{mac}/tok1', function(Request $request, Response $response, array $args) use ($app) {
    $mac = $args['mac'];
    $container = $app->getContainer();
    $storage = $container->get('storage');

    if (!$storage->scopeExists($mac)) {
        $results = array(
            'type' => 'https://nethesis.github.io/tancredi/problems/#not-found',
            'title' => 'Resource not found'
        );
        $response = withJson($response, $results, 404, JSON_FLAGS);
        $response = $response->withHeader('Content-Type', 'application/problem+json');
        $response = $response->withHeader('Content-Language', 'en');
        return $response;
    }
    \Tancredi\Entity\TokenManager::createToken(str_replace(".", "", uniqid($prefix = rand(), $more_entropy = TRUE)), $mac, TRUE); // create first time access token
    $response = $response->withStatus(204);
    return $response;
});

function getModelScope($id,$storage,$logger,$inherit = false, $original = false) {
    global $config;
    $scope = new \Tancredi\Entity\Scope($id, $storage, $logger, null, $original);
    if ($inherit) {
        $scope_data = $scope->getVariables();
    } else {
        $scope_data = $scope->data;
    }
    $results = array(
        'name' => $id,
        'display_name' => $scope->metadata['displayName'],
        'variables' => $scope_data,
        'model_url' => $config['api_url_path'] . "models/" . $id,
    );
    return $results;
}

function withJson(Response $response, $data, $status = 200, $flags = 0) {
    $response->getBody()->write(json_encode($data, $flags));
    return $response
        ->withHeader('Content-Type', 'application/json')
        ->withStatus($status);
}

// Run app
$app->run();
