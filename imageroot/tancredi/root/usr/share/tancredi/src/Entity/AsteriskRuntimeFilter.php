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

/*
* AsteriskRuntimeFilter class add astdb variables to scope data
*
* call_waiting: call waiting status (1|0)
* dnd_enable: do not disturb status (1|0)
* timeout_fwd_enable: call forward on timeout status (1|0)
* timeout_fwd_target: call forward on timeout target (phone number)
* busy_fwd_enable: call forward on busy status (1|0)
* busy_fwd_target: call forward on busy target (phone number)
* always_fwd_enable: call forward always on status (1|0)
* always_fwd_target: call forward always on  target (phone number)
* cftimeout: call forward timeout
*/
class AsteriskRuntimeFilter
{
    private $logger;
    private $config;

    public function __construct($config,$logger)
    {
        $this->config = $config;
        $this->logger = $logger;
    }

    public function __invoke($variables)
    {
        $db = new \SQLite3($this->config['astdb'],SQLITE3_OPEN_READONLY);
        $db->busyTimeout(1000);
        foreach (array_keys($variables) as $variable) {
            if(substr($variable, 0, 18) != 'account_extension_') {
                // Ignore all variables except those starting with "account_extension_"
                continue;
            }

            $index = (integer) substr($variable, 18);
            if($index <= 0) {
                // index must be a positive integer
                continue;
            }

            // Initialize default values
            $variables['account_call_waiting_' . $index] = '';
            $variables['account_timeout_fwd_target_' . $index] = '';
            $variables['account_busy_fwd_target_' . $index] = '';
            $variables['account_always_fwd_target_' . $index] = '';
            $variables['account_cftimeout_' . $index] = '';
            $variables['account_dnd_enable_' . $index] = '';

            $mainextension_match = array();
            $extension = $variables[$variable];
            if(preg_match("/^9\d(\d{2,4})$/", $extension, $mainextension_match)) {
                $extension = $mainextension_match[1];
            }

            $statement = $db->prepare('SELECT key,value FROM astdb WHERE key LIKE :key');
            $statement->bindValue(':key', "%/$extension%");
            $results = $statement->execute();

            while ($row = $results->fetchArray(SQLITE3_ASSOC)) {
                if ($row['key'] == "/CW/$extension" && $row['value'] == 'ENABLED') {
                    $variables['account_call_waiting_' . $index] = '1';
                } 

                if ($row['key'] == "/CFU/$extension") {
                    $variables['account_timeout_fwd_target_' . $index] = $row['value'];
                }

                if ($row['key'] == "/CFB/$extension") {
                    $variables['account_busy_fwd_target_' . $index] = $row['value'];
                }

                if ($row['key'] == "/CF/$extension") {
                    $variables['account_always_fwd_target_' . $index] = $row['value'];
                }

                if ($row['key'] == "/AMPUSER/$extension/followme/prering") {
                    $variables['account_cftimeout_' . $index] = $row['value'];
                }

                if ($row['key'] == "/DND/$extension" && $row['value'] == 'YES') {
                    $variables['account_dnd_enable_' . $index] = '1';
                }
            }
        }
        $db->close();
        unset($db);
        return $variables;
    }
}
