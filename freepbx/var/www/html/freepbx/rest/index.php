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

function nethvoice_handler($exception) {
  header('Content-type: application/json');
  echo json_encode(['error' => $exception->getMessage()]);
  exit(0);
}

set_exception_handler('nethvoice_handler');

/** @var \Composer\Autoload\ClassLoader $restAutoloader */
$restAutoloader = require 'vendor/autoload.php';

// FreePBX later registers a global Composer autoloader that ships Slim 4.
// Preload the REST app's own Slim 3 App class so this entrypoint keeps using
// the constructor and middleware model expected by the legacy REST modules.
class_exists(\Slim\App::class);

# Initialize FreePBX environment
$bootstrap_settings['freepbx_error_handler'] = false;
define('FREEPBX_IS_AUTH',1);
require_once '/etc/freepbx.conf';

// FreePBX registers its own Composer loader while bootstrapping. Re-prepend the
// REST loader so the entire Slim 3 namespace resolves from this app's vendor
// tree instead of mixing in FreePBX's Slim 4 classes.
$restAutoloader->unregister();
$restAutoloader->register(true);

# Load middleware classess
require('lib/AuthMiddleware.php');

# Load configuration
require_once('config.inc.php');

$app = new \Slim\App($config);

# Add authentication
$app->add(new AuthMiddleware($config['settings']['secretkey']));

foreach (glob("modules/*.php") as $filename)
{
    require($filename);
}

$app->run();
