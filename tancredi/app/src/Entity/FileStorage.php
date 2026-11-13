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

class FileStorage {

    private $config;
    private $logger;

    public function __construct($logger,$config) {
        $this->config = $config;
        $this->logger = $logger;
    }

    public function storageRead($id,$original = false) {
        if (file_exists($this->config['rw_dir'] . 'scopes/' . $id . '.ini') && !$original) {
            $inifile = $this->config['rw_dir'] . 'scopes/' . $id . '.ini';
        } else {
            $inifile = $this->config['ro_dir'] . 'scopes/' . $id . '.ini';
        }
        return $this->readIniFile($inifile);
    }

    public function storageWrite($id,$data) {
        $inifile = $this->config['rw_dir'] . 'scopes/' . $id . '.ini';
        return $this->writeIniFile($inifile,$data);
    }

    private function readIniFile($inifile) {
        // Read vars from file
        if (file_exists($inifile)){
            return parse_ini_file($inifile, $process_sections = TRUE);
        } else {
            return array();
        }
    }

    /**
     * Write an ini configuration file
     * 
     * @param string $file
     * @param array  $array
     * @return bool
     */
    private function writeIniFile($file, $array = []) {
        // check first argument is string
        if (!is_string($file)) {
            throw new \InvalidArgumentException('Function argument 1 must be a string.');
        }

        // check second argument is array
        if (!is_array($array)) {
            throw new \InvalidArgumentException('Function argument 2 must be an array.');
        }

        // process array
        $data = array();
        foreach ($array as $key => $val) {
            if (is_array($val)) {
                $data[] = "[$key]";
                foreach ($val as $skey => $sval) {
                    if (is_array($sval)) {
                        foreach ($sval as $_skey => $_sval) {
                            if (is_numeric($_skey)) {
                                $data[] = $skey.'[] = '.(is_numeric($_sval) ? $_sval : (ctype_upper($_sval) ? $_sval : '"'.str_replace('"','\"',$_sval).'"'));
                            } else {
                                $data[] = $skey.'['.$_skey.'] = '.(is_numeric($_sval) ? $_sval : (ctype_upper($_sval) ? $_sval : '"'.str_replace('"','\"',$_sval).'"'));
                            }
                        }
                    } else {
                        $data[] = $skey.' = '.(is_numeric($sval) ? $sval : (ctype_upper($sval) ? $sval : '"'.str_replace('"','\"',$sval).'"'));
                    }
                }
            } else {
                $data[] = $key.' = '.(is_numeric($val) ? $val : (ctype_upper($val) ? $val : '"'.str_replace('"','\"',$val).'"'));
            }
            // empty line
            $data[] = null;
        }

        // open file pointer, init flock options
        $fp = fopen($file, 'w');
        $retries = 0;
        $max_retries = 100;

        if (!$fp) {
            return false;
        }

        // loop until get lock, or reach max retries
        do {
            if ($retries > 0) {
                usleep(rand(1, 5000));
            }
            $retries += 1;
        } while (!flock($fp, LOCK_EX) && $retries <= $max_retries);

        // couldn't get the lock
        if ($retries == $max_retries) {
            return false;
        }

        // got lock, write data
        fwrite($fp, implode(PHP_EOL, $data).PHP_EOL);

        // release lock
        flock($fp, LOCK_UN);
        fclose($fp);

        return true;
    } 

    public function getScopeMeta($scope, $varname) {
        if (file_exists($this->config['rw_dir'] . 'scopes/' . $scope . '.ini')) {
            $vars = $this->readIniFile($this->config['rw_dir'] . 'scopes/' . $scope . '.ini');
        } else {
            $vars = $this->readIniFile($this->config['ro_dir'] . 'scopes/' . $scope . '.ini');
        }
        if (array_key_exists('metadata', $vars) and is_array($vars['metadata']) and array_key_exists($varname,$vars['metadata'])) {
            return $vars['metadata'][$varname];
        }
        return null;
    }

    public function listScopes($typeFilter = null){
        $scopes = array();
        $scopeFiles = array_unique(
            array_merge(
                scandir($this->config['ro_dir'] . 'scopes/'),
                scandir($this->config['rw_dir'] . 'scopes/')
            )
        );

        foreach ($scopeFiles as $filename) {
            if ($filename === '.' or $filename === '..' or preg_match('/\.ini$/',$filename) === FALSE) continue;
            $scope = preg_replace('/\.ini$/','',$filename);
            if (is_null($typeFilter) or $this->getScopeMeta($scope,'scopeType') === $typeFilter) {
                $scopes[] = $scope;
            }
        }
        return $scopes;
    }

    public function scopeExists($id) {
        return file_exists($this->config['rw_dir'] . 'scopes/' . $id . '.ini') || file_exists($this->config['ro_dir'] . 'scopes/' . $id . '.ini');
    }

    public function scopeInUse($id) {
        foreach ($this->listScopes() as $scope) {
            if ($this->getScopeMeta($scope, 'inheritFrom') === $id) {
                return TRUE;
            }
        }
        return FALSE;
    }

    public function deleteScope($scope) {
        return unlink($this->config['rw_dir'] . 'scopes/' . $scope . '.ini');
    }
}

