<?php namespace Tancredi;

/*
 * Copyright (C) 2020 Nethesis S.r.l.
 * http://www.nethesis.it - sviluppo@nethesis.it
 *
 * This script is part of Tancredi.
 *
 * Tancredi is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License,
 * or any later version.
 *
 * Tancredi is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Tancredi.  If not, see COPYING.
 */

use Monolog\Level;
use Psr\Container\ContainerInterface;

/**
 * Instantiate and configure a Monolog\Logger instance
 *
 */
class LoggerFactory 
{
    public static function createLogger($channel, ContainerInterface $dc)
    {
        $logger = new \Monolog\Logger($channel);
        $logger->pushProcessor(new \Monolog\Processor\PsrLogMessageProcessor());

        $config = $dc->get('config');
        if( ! empty($config['logfile'])) {
            $handler = new \Monolog\Handler\StreamHandler($config['logfile']);
            $formatter = new \Monolog\Formatter\LineFormatter("[%datetime%] %channel%.%level_name%: %message%\n");
        } else {
            $handler = new \Monolog\Handler\ErrorLogHandler();
            // We assume the error_log already adds a time stamp to log messages:
            $formatter = new \Monolog\Formatter\LineFormatter("%channel%.%level_name%: %message%");
        }
        $handler->setFormatter($formatter);

        if($config['loglevel'] == 'ERROR') {
            $handler->setLevel(Level::Error);
        } elseif ($config['loglevel'] == 'WARNING') {
            $handler->setLevel(Level::Warning);
        } elseif ($config['loglevel'] == 'INFO') {
            $handler->setLevel(Level::Info);
        } else {
            $handler->setLevel(Level::Debug);
        }

        $logger->pushHandler($handler);
        // \Monolog\ErrorHandler::register($logger); // Removed in Monolog 3
        return $logger;
    }

}
