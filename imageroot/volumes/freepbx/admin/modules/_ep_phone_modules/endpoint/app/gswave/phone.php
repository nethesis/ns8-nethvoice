<?php

/**
 * CTI app Production Modules Phone File
 *
 * @author Andrea Marchionni
 * @license MPL / GPLv2 / LGPL
 * @package Nethesis
 */
class endpoint_app_gswave_phone extends endpoint_app_base {

    public $family_line = 'gswave';
    protected $use_system_dst = FALSE;

    function prepare_for_generateconfig() {
	$this->settings['call_pickup'] = isset($this->settings['call_pickup']) ? $this->settings['call_pickup'] : '*8';
        $this->config_file_replacements['$username'] = $this->settings['line']['0']['username'];
        parent::prepare_for_generateconfig();

    }
}
