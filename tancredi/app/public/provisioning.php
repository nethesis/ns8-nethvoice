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

use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\ResponseInterface as Response;
use Slim\Factory\AppFactory;
use DI\ContainerBuilder;
use Slim\Psr7\Stream;

$containerBuilder = new ContainerBuilder();
$containerBuilder->addDefinitions([
    'config' => function() {
        global $config;
        return $config;
    },
    'logger' => function($c) {
        return \Tancredi\LoggerFactory::createLogger('provisioning', $c);
    },
    'storage' => function($c) {
        return new \Tancredi\Entity\FileStorage($c->get('logger'), $c->get('config'));
    }
]);

$container = $containerBuilder->build();
AppFactory::setContainer($container);
$app = AppFactory::create();
$app->setBasePath(rtrim($config['provisioning_url_path'], '/'));
$app->addRoutingMiddleware();

// Register the client IP address for logging
$upstreamProxies = array_map('trim', explode(',', isset($config['upstream_proxies']) ? $config['upstream_proxies'] : ''));
$app->add(new \RKA\Middleware\IpAddress( ! empty($upstreamProxies), $upstreamProxies));

// Add request/response logging middleware
$app->add(new \Tancredi\LoggingMiddleware($container->get('logger')));
// Determine whether to display error details based on configuration or environment
$displayErrorDetails = false;
if (isset($config['debug'])) {
    $displayErrorDetails = (bool)$config['debug'];
} elseif (getenv('APP_DEBUG') !== false) {
    $displayErrorDetails = filter_var(getenv('APP_DEBUG'), FILTER_VALIDATE_BOOLEAN);
}
$app->addErrorMiddleware($displayErrorDetails, true, true);

$app->get('/check/ping', function(Request $request, Response $response, array $args) use ($app) {
    $cfgFile = getenv('tancredi_conf') ?: '/etc/tancredi.conf';
    $response->getBody()->write(json_encode(filemtime($cfgFile)));
    return $response->withHeader('Content-Type', 'application/json')->withStatus(200);
});

$app->get('/{token}/{filetype:backgrounds|firmware|ringtones|screensavers}/{filename}', function(Request $request, Response $response, array $args) use ($app) {
    global $config;
    $container = $app->getContainer();
    $logger = $container->get('logger');

    $filename = $args['filename'];
    $token = $args['token'];
    $id = \Tancredi\Entity\TokenManager::getIdFromToken($token);
    if ($id === FALSE) {
        // Token doesn't exists
        $logger->info('Invalid token request from {address} {ua}: {uri}', ['uri' => (string) $request->getUri(), 'ua' => $_SERVER['HTTP_USER_AGENT'], 'address' => $request->getAttribute('ip_address')]);
        $response = $response->withStatus(404);
        return $response;
    }

    $realfile = resolveStaticAssetPath($args['filetype'], $filename);
    if ($realfile === FALSE) {
        // File not found
        return $response->withStatus(404);
    }

    $response = $response->withHeader('Content-Type', 'application/octet-stream');

    if(isset($config['file_reader']) && $config['file_reader'] == 'apache') {
        return $response->withHeader('X-Sendfile', $realfile);
    } elseif(isset($config['file_reader']) && $config['file_reader'] == 'nginx') {
        return $response->withHeader('X-Accel-Redirect', $realfile);
    } else {
        return $response->withBody(new Stream(fopen($realfile, 'r')));
    }
});

$app->get('/{token}/{filename}', function(Request $request, Response $response, array $args) use ($app) {
    global $config;
    $container = $app->getContainer();
    $logger = $container->get('logger');
    $storage = $container->get('storage');

    $filename = $args['filename'];
    $token = $args['token'];
    $id = \Tancredi\Entity\TokenManager::getIdFromToken($token);
    if ($id === FALSE) {
        // Token doesn't exists
        $logger->info('Invalid token request from {address} {ua}: {uri}', ['uri' => (string) $request->getUri(), 'ua' => $_SERVER['HTTP_USER_AGENT'], 'address' => $request->getAttribute('ip_address')]);
        $response = $response->withStatus(404);
        return $response;
    }

    $scope = \Tancredi\Entity\Scope::getPhoneScope($id, $storage, $logger, TRUE);
    // Get template variable name from file
    $data = getDataFromFilename($filename, $logger);
    $scope_data = array_merge($scope, $scope['variables']);
    unset($scope_data['variables']);

    if (empty($data['template'])) {
        $logger->debug('Template not found for "{filename}". It does not match our patterns.d/ rules', $data);
        return $response->withStatus(404);
    } elseif(empty($scope_data[$data['template']])) {
        $logger->error('Template not found for "{filename}". The variable "{template}" from pattern "{pattern_name}" is not set properly', $data);
        return $response->withStatus(500);
    }

    // Load filters
    if (array_key_exists('runtime_filters',$config) and !empty($config['runtime_filters'])) {
        foreach (explode(',',$config['runtime_filters']) as $filter) {
            $filter = "\\Tancredi\\Entity\\" . $filter;
            $filterObj = new $filter($config, $logger);
            $scope_data = $filterObj($scope_data);
        }
    }

    // Add provisioning_complete variable
    if ($token === $scope_data['tok2']) {
        $scope_data['provisioning_complete'] = '1';
    } else {
        $scope_data['provisioning_complete'] = '';
    }

    // Add user agent
    $scope_data['provisioning_user_agent'] = $_SERVER['HTTP_USER_AGENT'];

    try {
        $response = $response->withHeader('Cache-Control', 'private');
        $response = $response->withHeader('Content-Type', $data['content_type']);
        $response->getBody()->write(renderTwigTemplate($scope_data[$data['template']], $scope_data));
        $logger->debug('Rendered template "{template}" with data: {data}', ['data' => json_encode($scope_data), 'template' => $scope_data[$data['template']]]);
        $logger->info('Serving request from {address} {ua}: {uri} ({mac})', ['mac' => $scope_data['mac'], 'uri' => (string) $request->getUri(), 'ua' => $_SERVER['HTTP_USER_AGENT'], 'address' => $request->getAttribute('ip_address')]);
        return $response;
    } catch (Exception $e) {
        $logger->error($e);
        $response = $response
            ->withHeader('Content-type', 'text/plain')
            ->withStatus(500)
        ;
        $response->getBody()->write("Internal server error\n\nSee the application log for details.\n");
        return $response;
    }
});

$app->get('/{filename}', function(Request $request, Response $response, array $args) use ($app) {
    global $config;
    $container = $app->getContainer();
    $logger = $container->get('logger');
    $storage = $container->get('storage');

    $filename = $args['filename'];

    $data = getDataFromFilename($filename, $logger);

    if (empty($data['scopeid'])) {
        $logger->debug(sprintf('Scope not found for "%s"', $filename));
        return $response->withStatus(404);
    }

    $id = $data['scopeid'];
    // Convert mac address to uppercase if id is a mac address
    if (preg_match('/[a-f0-9]{2}-[a-f0-9]{2}-[a-f0-9]{2}-[a-f0-9]{2}-[a-f0-9]{2}-[a-f0-9]{2}/',$id) != FALSE) {
        $id = strtoupper($id);
    }

    // Instantiate scope
    $scope = \Tancredi\Entity\Scope::getPhoneScope($id, $storage, $logger, TRUE);
    // Get template variable name from file
    $scope_data = array_merge($scope, $scope['variables']);
    unset($scope_data['variables']);

    if (empty($data['template'])) {
        $logger->debug('Template not found for "{filename}". It does not match our patterns.d/ rules', $data);
        return $response->withStatus(404);
    } elseif(empty($scope_data[$data['template']])) {
        $logger->error('Template not found for "{filename}". The variable "{template}" from pattern "{pattern_name}" is not set properly', $data);
        return $response->withStatus(500);
    }

    // Load filters
    if (array_key_exists('runtime_filters',$config) and !empty($config['runtime_filters'])) {
        foreach (explode(',',$config['runtime_filters']) as $filter) {
            $filter = "\\Tancredi\\Entity\\" . $filter;
            $filterObj = new $filter($config, $logger);
            $scope_data = $filterObj($scope_data);
        }
    }

    // Remove secrets from scope data
    foreach ($scope_data as $key => $value) {
        if (strpos($key, 'account_') !== FALSE ||
            strpos($key, 'adminpw') !== FALSE ||
            strpos($key, 'userpw') !== FALSE) {
            $scope_data[$key] = '';
        }
    }
    // Use token 1 instead of token 2
    $scope_data['tok2'] = $scope_data['tok1'];

    // Add provisioning_complete variable
    $scope_data['provisioning_complete'] = '';

    // Add user agent
    $scope_data['provisioning_user_agent'] = $_SERVER['HTTP_USER_AGENT'];

    try {
        $response = $response->withHeader('Cache-Control', 'private');
        $response = $response->withHeader('Content-Type', $data['content_type']);
        $response->getBody()->write(renderTwigTemplate($scope_data[$data['template']], $scope_data));
        $logger->debug('Rendered template "{template}" with data: {data}', ['data' => json_encode($scope_data), 'template' => $scope_data[$data['template']]]);
        $logger->info('Serving request from {address} {ua}: {uri} ({mac})', ['mac' => $scope_data['mac'], 'uri' => (string) $request->getUri(), 'ua' => $_SERVER['HTTP_USER_AGENT'], 'address' => $request->getAttribute('ip_address')]);
        return $response;
    } catch (Exception $e) {
        $logger->error($e);
        $response = $response
            ->withHeader('Content-type', 'text/plain')
            ->withStatus(500)
        ;
        $response->getBody()->write("Internal server error\n\nSee the application log for details.\n");
        return $response;
    }
});

function renderTwigTemplate($template, $scope_data) {
    global $config;
    $loader = new \Twig\Loader\ChainLoader([
        new \Twig\Loader\FilesystemLoader($config['rw_dir'] . 'templates-custom/'),
        new \Twig\Loader\FilesystemLoader($config['ro_dir'] . 'templates/'),
    ]);
    $preg_replace_filter = new \Twig\TwigFilter('preg_replace', function($subject, $pattern, $replacement) {
        return preg_replace($pattern, $replacement, $subject);
    });
    $twig = new \Twig\Environment($loader,['autoescape' => false]);
    $twig->addFilter($preg_replace_filter);
    $payload = $twig->render($template, $scope_data);
    return $payload;
}

function resolveStaticAssetPath($filetype, $filename) {
    global $config;

    foreach ([$config['rw_dir'], $config['ro_dir']] as $base_dir) {
        $directory = rtrim($base_dir, '/') . '/' . $filetype;
        $realdirectory = realpath($directory);
        if ($realdirectory === FALSE) {
            continue;
        }
        $realfile = realpath($directory . '/' . $filename);
        if ($realfile !== FALSE && dirname($realfile) === $realdirectory) {
            return $realfile;
        }
    }

    return FALSE;
}

function getPatternFiles($logger) {
    global $config;

    $pattern_files = array();
    $rw_pattern_files = glob(rtrim($config['rw_dir'], '/') . '/patterns.d/*.ini');
    $ro_pattern_files = glob(rtrim($config['ro_dir'], '/') . '/patterns.d/*.ini');
    $rw_pattern_files = $rw_pattern_files === FALSE ? array() : $rw_pattern_files;
    $ro_pattern_files = $ro_pattern_files === FALSE ? array() : $ro_pattern_files;
    $overridden_pattern_files = array();
    $ro_pattern_files_by_name = array();

    foreach ($ro_pattern_files as $pattern_file) {
        $ro_pattern_files_by_name[basename($pattern_file)] = $pattern_file;
    }

    foreach ($rw_pattern_files as $pattern_file) {
        $pattern_basename = basename($pattern_file);
        if (isset($ro_pattern_files_by_name[$pattern_basename])) {
            $logger->debug(
                'Writable pattern file "{rw_pattern_file}" overrides shipped pattern file "{ro_pattern_file}"',
                array(
                    'rw_pattern_file' => $pattern_file,
                    'ro_pattern_file' => $ro_pattern_files_by_name[$pattern_basename],
                )
            );
        } else {
            $logger->debug('Using writable pattern file "{rw_pattern_file}"', array(
                'rw_pattern_file' => $pattern_file,
            ));
        }

        $pattern_files[] = $pattern_file;
        $overridden_pattern_files[$pattern_basename] = TRUE;
    }

    foreach ($ro_pattern_files as $pattern_file) {
        if (!isset($overridden_pattern_files[basename($pattern_file)])) {
            $logger->debug('Using shipped pattern file "{ro_pattern_file}"', array(
                'ro_pattern_file' => $pattern_file,
            ));
            $pattern_files[] = $pattern_file;
        }
    }

    return $pattern_files;
}

function getDataFromFilename($filename,$logger) {
    $result = array(
        'filename' => $filename,
    );

    foreach (getPatternFiles($logger) as $pattern_file) {
        $patterns = parse_ini_file($pattern_file, true);
        if ($patterns === FALSE) {
            continue;
        }

        foreach ($patterns as $pattern_name => $pattern) {
            if (preg_match('/^'.$pattern['pattern'].'$/', $filename, $tmp)) {
                $result['pattern_name'] = $pattern_name;
                $result['template'] = $pattern['template'];
                $result['scopeid'] = preg_replace('/'.$pattern['pattern'].'/', $pattern['scopeid'] , $filename );
                $result['content_type'] = empty($pattern['content_type']) ? 'text/plain; charset=utf-8' : $pattern['content_type'];
                return $result;
            }
        }
    }

    return $result;
}

// Run app
$app->run();
