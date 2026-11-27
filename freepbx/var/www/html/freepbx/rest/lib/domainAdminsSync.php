<?php

#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

$restAutoloader = require __DIR__ . '/../vendor/autoload.php';
interface_exists('Psr\\Http\\Message\\ResponseFactoryInterface');
interface_exists('Psr\\Http\\Message\\ResponseInterface');
interface_exists('Psr\\Http\\Message\\ServerRequestInterface');
interface_exists('Psr\\Http\\Server\\MiddlewareInterface');
interface_exists('Psr\\Http\\Server\\RequestHandlerInterface');

$bootstrap_settings['freepbx_error_handler'] = false;
define('FREEPBX_IS_AUTH', 1);
require_once '/etc/freepbx.conf';
$restAutoloader->unregister();
$restAutoloader->register(true);

require_once __DIR__ . '/libUsers.php';
require_once __DIR__ . '/libDomainAdmins.php';

exit(domainAdminsDefault()->sync() ? 0 : 1);
