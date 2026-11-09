<?php namespace Tancredi\Entity;

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

/***************************************************************
* When invoked, this class add current date to scope variables *
****************************************************************/
class SampleFilter
{
    private $logger;
    private $date_format;

    public function __construct($config,$logger)
    {
        $this->logger = $logger;
        // Filter class can access configurations
        $this->date_format = ($config['samplefilter_format'] ? $config['samplefilter_format'] : 'D, d M Y H:i:s');
    }

    // The __invoke function is called after the filter class is istantiated with the scope variables as argument
    public function __invoke($variables)
    {
        $variables['date'] = date($this->date_format);
        // The __invoke function must return the variables array
        return $variables;
    }
}

