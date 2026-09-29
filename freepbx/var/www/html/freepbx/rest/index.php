<?php

#
# Copyright (C) 2017 Nethesis S.r.l.
# http://www.nethesis.it - nethserver@nethesis.it
#
# This script is part of NethServer.
#
# NethServer is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License,
# or any later version.
#
# NethServer is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with NethServer.  If not, see COPYING.
#

use \Psr\Http\Message\ServerRequestInterface as Request;
use \Psr\Http\Message\ResponseInterface as Response;
use \Psr\Http\Server\RequestHandlerInterface;
use \Slim\Factory\AppFactory;
use \Slim\Routing\RouteContext;

function nethvoice_handler($exception) {
  header('Content-type: application/json');
  echo json_encode(['error' => $exception->getMessage()]);
  exit(0);
}

set_exception_handler('nethvoice_handler');

/** @var \Composer\Autoload\ClassLoader $restAutoloader */
$restAutoloader = require 'vendor/autoload.php';

# Initialize FreePBX environment
$bootstrap_settings['freepbx_error_handler'] = false;
define('FREEPBX_IS_AUTH',1);
require_once '/etc/freepbx.conf';

// FreePBX registers its own Composer loader while bootstrapping. Re-prepend the
// REST loader so the REST app's Slim 4 stack resolves from this vendor tree
// instead of mixing with FreePBX's global Composer dependencies.
$restAutoloader->unregister();
$restAutoloader->register(true);

# Load response helpers and middleware classes
require('lib/JsonResponse.php');

# Load middleware classess
require('lib/AuthMiddleware.php');

# Load configuration
require_once('config.inc.php');

$app = AppFactory::create();
$app->setBasePath('/freepbx/rest');
$app->addBodyParsingMiddleware();

# Add authentication
$app->add(new AuthMiddleware($config['settings']['secretkey'], $app->getResponseFactory()));

$app->add(function (Request $request, RequestHandlerInterface $handler): Response {
  $route = $request->getAttribute(RouteContext::ROUTE);
  if ($route !== null && $request->getAttribute('route') === null) {
    $request = $request->withAttribute('route', $route);
  }

  return $handler->handle($request);
});

$app->addRoutingMiddleware();

$errorMiddleware = $app->addErrorMiddleware(true, true, true);
$errorMiddleware->setDefaultErrorHandler(
  function (
    Request $request,
    Throwable $exception,
    bool $displayErrorDetails,
    bool $logErrors,
    bool $logErrorDetails
  ) use ($app): Response {
    $status = 500;
    if (method_exists($exception, 'getStatusCode')) {
      $status = $exception->getStatusCode();
    } elseif ($exception->getCode() >= 400 && $exception->getCode() < 600) {
      $status = $exception->getCode();
    }

    /** @var Response $response */
    $response = $app->getResponseFactory()->createResponse();

    return jsonResponse($response, ['error' => $exception->getMessage()], $status);
  }
);

foreach (glob("modules/*.php") as $filename)
{
    require($filename);
}

$app->run();
