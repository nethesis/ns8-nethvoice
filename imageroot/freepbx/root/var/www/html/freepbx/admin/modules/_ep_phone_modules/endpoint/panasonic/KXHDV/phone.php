<?php

/**
 * Panasonic In Production Modules Phone File
 *
 * @author Andrea Marchionni
 * @license MPL / GPLv2 / LGPL
 * @package Provisioner
 */
class endpoint_panasonic_KXHDV_phone extends endpoint_panasonic_base {

    public $family_line = 'KXHDV';

    function prepare_for_generateconfig() {
        #$this->mac = strtolower($this->mac);
        parent::prepare_for_generateconfig();


	//Set default ring tone
        if (!isset($this->settings['default_ringtone'])) {
            $this->settings['default_ringtone'] = "1";
        }

        //Set line key defaults
        $s = $this->max_lines;
        for ($i = 1; $i <= 3; $i++) {
            if (!isset($this->settings['loops']['linekey'][$i])) {
                $this->settings['loops']['linekey'][$i] = array(
                    "act" => "X_PANASONIC_IPTEL_LINE",
                    "arg" => "1",
                    "label" => $this->settings["line"][0]["displayname"]
                );
	    }
	}
        for ($y = 4; $y <= $s; $y++) {
            if (!isset($this->settings['loops']['linekey'][$y])) {
                $this->settings['loops']['linekey'][$y] = array(
                    "act" => ""
                );
            }
        }
    }
}
