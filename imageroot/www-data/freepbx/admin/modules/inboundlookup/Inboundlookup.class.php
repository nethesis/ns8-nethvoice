<?php
namespace FreePBX\modules;
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }

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

class Inboundlookup implements \BMO {
    public function __construct($freepbx = null) {
        if ($freepbx == null) {
            throw new Exception("Not given a FreePBX Object");
        }
        $this->FreePBX = $freepbx;
        $this->database = $freepbx->Database;
        //Get Future Module information (This is only used for a few things right now)
        $this->inbound_modules = array();
        foreach (glob(__DIR__."/modules/*",GLOB_ONLYDIR) as $filename) {
              $this->inbound_modules[] = basename($filename);
        }
    }

    public function install() {}

    public function uninstall() {}

    public function backup() {}

    public function restore($backup) {}

    public function doConfigPageInit($page) {
        $request = $_REQUEST;
        isset($request['action']) ? ($action = $request['action']) : $action='';
        isset($request['view']) ? ($view = $request['view']) : $view = 'form';
        isset($request['itemid']) ? ($itemid = $request['itemid']) : $itemid='';
        if(isset($request['action'])) {
            switch ($action) {
                case "add":
                    inboundlookup_add($request);
                    needreload();
                    redirect_standard();
                break;
                case "delete":
                    inboundlookup_del();
                    needreload();
                    redirect_standard();
                break;
            }
        }
    }

    public function getActionBar($request){
        switch($request['display']){
            case 'inboundlookup':
                $buttons = array(
                    'submit' => array(
                        'name' => 'submit',
                        'id' => 'submit',
                        'value' => _('Submit')
                    ),
                    'delete' => array(
                        'name' => 'delete',
                        'id' => 'delete',
                        'value' => _('Delete')
                    )
                );
            break;
        }
        return $buttons;
    }

    public function getRightNav($request){
    }
}
