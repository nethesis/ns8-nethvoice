<?php

/**
 * Fanvil In Production Modules Phone File
 *
 * @author Andrea Marchionni
 * @license MPL / GPLv2 / LGPL
 * @package Nethesis
 */
class endpoint_fanvil_xSeries_phone extends endpoint_fanvil_base {

    public $family_line = 'xSeries';
    protected $use_system_dst = FALSE;

    function parse_lines_hook($line_data, $line_total) {
	$this->settings['call_pickup'] = isset($this->settings['call_pickup']) ? $this->settings['call_pickup'] : '*8';
        $line_data['line_active'] = 1;
        $line_data['line_m1'] = $line_data['line'];
	$line_data['pickup_value'] = isset($this->settings['pickup_value']) ? $this->settings['pickup_value'] : $this->settings['call_pickup'];

        return($line_data);
    }

    function prepare_for_generateconfig() {
	$this->settings['call_pickup'] = isset($this->settings['call_pickup']) ? $this->settings['call_pickup'] : '*8';
        $this->mac = strtolower($this->mac);
        $this->config_file_replacements['$username'] = $this->settings['line']['0']['username'];
        parent::prepare_for_generateconfig();

	//Set default ring tone
	if (!isset($this->settings['default_ringtone'])) {
            $this->settings['default_ringtone'] = "Type 1";
        }
	
        //Set line key defaults
        $s = $this->max_lines;
        for ($i = 1; $i <= 3; $i++) {
            if (!isset($this->settings['loops']['linekey'][$i])) {
                $this->settings['loops']['linekey'][$i] = array(
                    "type" => "2",
                    "line" => "SIP1",
                );
            }
        }
	if (!isset($this->settings['loops']['linekey'][4])) {
                $this->settings['loops']['linekey'][4] = array(
                    "type" => "0",
                );
        }
	if (!isset($this->settings['loops']['linekey'][5])) {
                $this->settings['loops']['linekey'][5] = array(
                    "type" => "3",
                    "value" => "F_MWI",
                );
        }
	if (!isset($this->settings['loops']['linekey'][6])) {
                $this->settings['loops']['linekey'][6] = array(
                    "type" => "3",
                    "value" => "F_HEADSET",
                );
        }

	//soft key default
        if (!isset($this->settings['soft_key1'])) {
            $this->settings['soft_key1'] = "dsskey1";
	}
        if (!isset($this->settings['soft_key2'])) {
            $this->settings['soft_key2'] = "dsskey2";
	}
        if (!isset($this->settings['soft_key3'])) {
            $this->settings['soft_key3'] = "dnd";
	}
        if (!isset($this->settings['soft_key4'])) {
            $this->settings['soft_key4'] = "menu";
	}

    }
}
