<?php
/**
 * This class calls write calls for phones reboot script into crontab
 * PHP version 5.6
 *
 * Copyright (C) 2019 Nethesis S.r.l.
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
 *
 * @category  VoIP
 * @package   NethVoice
 * @author    Stefano Fancello <stefano.fancello@nethesis.it>
 * @copyright 2019 Nethesis S.r.l.
 * @license   https://github.com/nethesis/nethvoice-wizard-restapi/blob/master/LICENSE GPLv2
 * @link      https://github.com/nethesis/dev/issues
 */

define('REBOOT_HELPER_SCRIPT', '/var/www/html/freepbx/rest/lib/phonesRebootHelper.php');

class CronHelper
{
    public function write($macs)
    {
        $ret = array();
        $cron_add = array();
        $cron_remove = array();
        foreach ($macs as $mac => $time) {
            if (!preg_match('/^[0-9A-F]{2}\-[0-9A-F]{2}\-[0-9A-F]{2}\-[0-9A-F]{2}\-[0-9A-F]{2}\-[0-9A-F]{2}$/', $mac)) {
                // Malformed MAC address
                $ret[$mac]['title'] = 'Malformed MAC address';
                $ret[$mac]['detail'] = 'Malformed MAC address: '.$mac;
                $ret[$mac]['code'] = 400;
                continue;
            }
            if (empty($time)) {
                //no time provided, launch reboot now
                try {
                    exec(REBOOT_HELPER_SCRIPT.' '.$mac, $out ,$return);
                    if ($return != 0) {
                        throw new Exception(implode("\n",$out));
                    }
                    $ret[$mac]['code'] = 204;
                } catch (Exception $e) {
                    error_log(__CLASS__ . '->' . __FUNCTION__ . '->' . $e->getMessage());
                    $ret[$mac]['title'] = 'Unknown error';
                    $ret[$mac]['code'] = 500;
                    $ret[$mac]['detail'] = $e->getMessage();
                }
                continue;
            }
            if (!preg_match('/[0-9]{1,2}/', $time['hours'])
                || !preg_match('/[0-9]{2}/', $time['minutes'])
            ) {
                $ret[$mac]['title'] = 'Malformed time';
                $ret[$mac]['detail'] = 'Malformed time: ' . $time['hours'] . ':' . $time['minutes'];
                $ret[$mac]['code'] = 400;
                continue;
            }
            
            $cron_add[] = $time['minutes'] . ' ' . $time['hours'] . " * * * ".REBOOT_HELPER_SCRIPT." $mac";
            $cron_remove[] = " ".REBOOT_HELPER_SCRIPT." $mac";
        }

        // Write crontab
        try {
            // Read crontab content
            exec('/usr/bin/crontab -l 2>/dev/null', $content, $return);
            if ($return != 0) {
                throw new Exception("Error reading crontab");
            }

            // Open crontab in a pipe
            if (!file_exists('/var/log/pbx/www-error.log')) {
                touch('/var/log/pbx/www-error.log');
            }
            $descriptorspec = array(
                0 => array("pipe", "r"),  // stdin
                1 => array("pipe", "w"),  // stdout
                2 => array("file", "/var/log/pbx/www-error.log", "a") // stderr
            );

            $process = proc_open('/usr/bin/crontab -', $descriptorspec, $pipes);
            if (!is_resource($process)) {
                throw new Exception("Error opening crontab pipe");
            }

            if (!empty($cron_remove)) {
                foreach ($content as $key => $row) {
                    foreach ($cron_remove as $row_to_remove) {
                        if (strpos($row, $row_to_remove) !== false) {
                            unset($content[$key]);
                        }
                    }
                }
            }
            $output = array_merge($content, $cron_add);
            fwrite($pipes[0], join("\n", $output)."\n");
            foreach ($pipes as $key => $value) {
                fclose($pipes[$key]);
            }
            proc_close($process);
        } catch (Exception $e) {
            error_log(__CLASS__ . '->' . __FUNCTION__ . '->' . $e->getMessage());
            foreach ($macs as $mac) {
                if (!array_key_exists($mac, $ret)) {
                    $ret[$mac]['title'] = 'Unknown error while writing cron';
                    $ret[$mac]['code'] = 500;
                    $ret[$mac]['detail'] = $e->getMessage();
                }
            }
        }
        foreach ($this->read() as $mac => $time) {
            if (!array_key_exists($mac, $ret) && array_key_exists($mac, $macs)) {
                $ret[$mac]['code'] = 204;
            }
        }
        return $ret;
    }

    public function delete($macs)
    {
        $ret = array();
        $cron_remove = array();
        foreach ($macs as $mac) {
            if (!preg_match('/^[0-9A-F]{2}\-[0-9A-F]{2}\-[0-9A-F]{2}\-[0-9A-F]{2}\-[0-9A-F]{2}\-[0-9A-F]{2}$/', $mac)) {
                // Malformed MAC address
                $ret[$mac]['title'] = 'Malformed MAC address';
                $ret[$mac]['detail'] = 'Malformed MAC address: '.$mac;
                $ret[$mac]['code'] = 400;
                continue;
            }
            $cron_remove[] = " ".REBOOT_HELPER_SCRIPT." $mac";
        }

        // Write crontab
        try {
            // Read crontab content
            exec('/usr/bin/crontab -l 2>/dev/null', $content, $return);
            if ($return != 0) {
                throw new Exception("Error reading crontab");
            }

            // Open crontab in a pipe
            if (!file_exists('/var/log/pbx/www-error.log')) {
                touch('/var/log/pbx/www-error.log');
            }
            $descriptorspec = array(
                0 => array("pipe", "r"),  // stdin
                1 => array("pipe", "w"),  // stdout
                2 => array("file", "/var/log/pbx/www-error.log", "a") // stderr
            );

            $process = proc_open('/usr/bin/crontab -', $descriptorspec, $pipes);
            if (!is_resource($process)) {
                throw new Exception("Error opening crontab pipe");
            }

            if (!empty($cron_remove)) {
                foreach ($content as $key => $row) {
                    foreach ($cron_remove as $row_to_remove) {
                        if (strpos($row, $row_to_remove) !== false) {
                            unset($content[$key]);
                        }
                    }
                }
            }
            fwrite($pipes[0], join("\n", $content)."\n");
            foreach ($pipes as $key => $value) {
                fclose($pipes[$key]);
            }
            proc_close($process);
        } catch (Exception $e) {
            error_log(__CLASS__ . '->' . __FUNCTION__ . '->' . $e->getMessage());
            foreach ($macs as $mac) {
                if (!array_key_exists($mac, $ret)) {
                    $ret[$mac]['title'] = 'Unknown error while writing cron';
                    $ret[$mac]['code'] = 500;
                    $ret[$mac]['detail'] = $e->getMessage();
                }
            }
        }
        $cron_lines = $this->read();
        foreach ($macs as $mac) {
            if (!array_key_exists($mac, $cron_lines)) {
                //line not present, successfully removed
                $ret[$mac]['code'] = 202;
            } elseif (!array_key_exists($mac, $ret) || !array_key_exists('code', $ret[$mac])) {
                $ret[$mac]['title'] = 'Unknown error';
                $ret[$mac]['detail'] = $mac . ' line still exists in crontab';
                $ret[$mac]['code'] = 500;
            }
        }
        return $ret;
    }

    public function read($mac = null)
    {
        // Read crontab content
        exec('/usr/bin/crontab -l 2>/dev/null', $output, $ret);
        if ($ret != 0) {
            throw new Exception("Error reading crontab");
        }

        $ret = array();
        foreach ($output as $row) {
            if (preg_match('/^([0-9]+) ([0-9]+) \* \* \* '.str_replace('/', '\/', REBOOT_HELPER_SCRIPT).' ([0-9A-F]{2}\-[0-9A-F]{2}\-[0-9A-F]{2}\-[0-9A-F]{2}\-[0-9A-F]{2}\-[0-9A-F]{2})$/', $row, $matches)) {
                if (!is_null($mac) && $mac != $matches[3]) {
                    continue;
                }
                $ret[$matches[3]] = array("hours" => $matches[2], "minutes" => $matches[1]);
            }
        }
        return $ret;
    }

    public static function deleteSameTime($mac)
    {
        try {
            // Read crontab content
            exec('/usr/bin/crontab -l 2>/dev/null', $content, $return);
            if ($return != 0) {
                throw new Exception("Error reading crontab");
            }

            // Open crontab in a pipe
            if (!file_exists('/var/log/pbx/www-error.log')) {
                touch('/var/log/pbx/www-error.log');
            }
            $descriptorspec = array(
                0 => array("pipe", "r"),  // stdin
                1 => array("pipe", "w"),  // stdout
                2 => array("file", "/var/log/pbx/www-error.log", "a") // stderr
            );

            $process = proc_open('/usr/bin/crontab -', $descriptorspec, $pipes);
            if (!is_resource($process)) {
                throw new Exception("Error opening crontab pipe");
            }

            foreach ($content as $key => $row) {
                if (preg_match("/([0-9]{2}) ([0-9]{2}) \* \* \* ".str_replace('/', '\/', REBOOT_HELPER_SCRIPT)." $mac$/", $row, $matches)) {
                    $hours = $matches[2];
                    $minutes = $matches[1];
                    continue;
                }
            }
            if (!empty($hours) && !empty($minutes)) {
                foreach ($content as $key => $row) {
                    if (preg_match("/^$minutes $hours \* \* \* ".str_replace('/', '\/', REBOOT_HELPER_SCRIPT)."/", $row)) {
                        unset($content[$key]);
                    }
                }
            }

            fwrite($pipes[0], join("\n", $content)."\n");
            foreach ($pipes as $key => $value) {
                fclose($pipes[$key]);
            }
            proc_close($process);
        } catch (Exception $e) {
            error_log(__CLASS__ . '->' . __FUNCTION__ . '->' . $e->getMessage());
            exit(1);
        }
    }
}
