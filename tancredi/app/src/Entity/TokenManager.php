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

class TokenManager {
    public static function getIdFromToken($token){
        global $config;
        if (file_exists($config['rw_dir'] . 'first_access_tokens/'.$token)) {
            return trim(file_get_contents($config['rw_dir'] . 'first_access_tokens/'.$token));
        } elseif (file_exists($config['rw_dir'] . 'tokens/'.$token)) {
            $id = trim(file_get_contents($config['rw_dir'] . 'tokens/'.$token));
            TokenManager::deleteTokenForId($id,$config['rw_dir'] . 'first_access_tokens/');
            return $id;
        } else {
            // Token not found
            return false;
        }
    }

    public static function deleteTokenForId($id,$dir) {
        foreach (scandir($dir) as $token) {
            if ($token === '.' or $token === '..') continue;
            if (file_get_contents($dir.$token) === $id) {
                return unlink($dir.$token);
            }
        }
    }

    public static function deleteToken($token) {
        global $config;
        if (file_exists($config['rw_dir'] . 'first_access_tokens/' . $token)) {
            return unlink($config['rw_dir'] . 'first_access_tokens/' . $token);
        } elseif ($config['rw_dir'] . 'tokens/' . $token) {
            return unlink($config['rw_dir'] . 'tokens/' . $token);
        }
        return false;
    }

    public static function createToken($token,$id,$first_time_access = FALSE) {
        global $config;
        if ($first_time_access) {
            $dir = $config['rw_dir'] . 'first_access_tokens/';
        } else {
            $dir = $config['rw_dir'] . 'tokens/';
        }
        TokenManager::deleteTokenForId($id,$dir);
        return file_put_contents($dir.$token,$id);
    }

    private static function getTokenFromId($id,$dir) {
        foreach (scandir($dir) as $token) {
            if ($token === '.' or $token === '..') continue;
            if (trim(file_get_contents($dir.$token)) === $id) {
                return $token;
            }
        }
        return null;
    }

    public static function getToken1($id) {
        global $config;
        return TokenManager::getTokenFromId($id,$config['rw_dir'] . 'first_access_tokens/');
    }

    public static function getToken2($id) {
        global $config;
        return TokenManager::getTokenFromId($id,$config['rw_dir'] . 'tokens/');
    }
}
