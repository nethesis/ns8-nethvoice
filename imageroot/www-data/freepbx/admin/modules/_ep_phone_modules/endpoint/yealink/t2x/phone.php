<?php

/**
 * Yealink Modules Phone File
 *
 * @author Andrew Nagy
 * @license MPL / GPLv2 / LGPL
 * @package Provisioner
 */
class endpoint_yealink_t2x_phone extends endpoint_yealink_base {

    public $family_line = 't2x';
    public $dynamic_mapping = array(
        '$mac.cfg' => array('$mac.cfg', 'y0000000000$suffix.cfg'),
        'y0000000000$suffix.cfg' => '#This File is intentionally left blank'
    );

    function parse_lines_hook($line_data, $line_total) {
        $line_data['line_active'] = 1;
        $line_data['line_m1'] = $line_data['line'] - 1;
        $line_data['enable_outbound_proxy_server'] = (isset($line_data['use_outbound_proxy']) && $line_data['use_outbound_proxy']) ? 1 : 0;
        $line_data['enable_stun'] = 0;
        $line_data['voicemail_number'] = '*97';

        if (isset($line_data['transport'])) {
            switch ($line_data['transport']) {
                case "UDP":
                    $line_data['transport'] = 0;
                    break;
                case "TCP":
                    $line_data['transport'] = 1;
                    break;
                case "TLS":
                    $line_data['transport'] = 2;
                    break;
                case "DNSSRV":
                    $line_data['transport'] = 3;
                    break;
                default:
                    $line_data['transport'] = 0;
                    break;
            }
        } else {
            $line_data['transport'] = 0;
        }

        return($line_data);
    }

    function prepare_for_generateconfig() {
        # This contains the last 2 digits of y0000000000xx.cfg, for each model.
        $model_suffixes = array(
            'T28P' => '00',
            'T26P' => '04',
            'T22P' => '05',
            'T21P' => '34',
            'T20P' => '07');
        //Yealink likes lower case letters in its mac address
        $this->mac = strtolower($this->mac);
        $this->config_file_replacements['$suffix'] = $model_suffixes[$this->model];
        parent::prepare_for_generateconfig();

	//Set default ring tone
        if (!isset($this->settings['default_ringtone'])) {
            $this->settings['default_ringtone'] = "Ring1.wav";
        }

        //Set softkeys or defaults
        if (isset($this->settings['loops']['softkey'])) {
            foreach ($this->settings['loops']['softkey'] as $key => $data) {
                //HIstory, Dir, DND, and Menu
                if ($this->settings['loops']['softkey'][$key]['type'] == '0') {
                    unset($this->settings['loops']['softkey'][$key]);
                }
            }
        } else {
            $this->settings['loops']['softkey'][1]['type'] = 28;
            $this->settings['loops']['softkey'][1]['label'] = "History";
            $this->settings['loops']['softkey'][2]['type'] = 38;
            $this->settings['loops']['softkey'][2]['label'] = "LDAP";
            $this->settings['loops']['softkey'][3]['type'] = 23;
            $this->settings['loops']['softkey'][3]['label'] = "Pickup";
            $this->settings['loops']['softkey'][4]['type'] = 30;
            $this->settings['loops']['softkey'][4]['label'] = "Menu";
        }

        if (isset($this->settings['loops']['remotephonebook'])) {
            foreach ($this->settings['loops']['remotephonebook'] as $key => $data) {
                if ($this->settings['loops']['remotephonebook'][$key]['url'] == '') {
                    unset($this->settings['loops']['remotephonebook'][$key]);
                }
            }
        }

        //Set line key defaults
        $s = $this->max_lines;
        for ($i = 1; $i <= 3; $i++) {
            if (!isset($this->settings['loops']['linekey'][$i])) {
                $this->settings['loops']['linekey'][$i] = array(
                    "mode" => "line",
                    "type" => 15,
                    "line" => 1
                );
 	    }
	}
        for ($y = 4; $y <= $s; $y++) {
            if (!isset($this->settings['loops']['linekey'][$y])) {
                $this->settings['loops']['linekey'][$y] = array(
                    "mode" => "N\/A",
                    "type" => 0,
                    "line" => 1
                );
            }
        }

        if (isset($this->settings['loops']['sdexp'])) {
            foreach ($this->settings['loops']['sdexp'] as $key => $data) {
                if ($this->settings['loops']['sdexp'][$key]['type'] == '16') {
                    $this->settings['loops']['sdexp'][$key]['pickup_value'] = $this->settings['call_pickup'];
                } elseif ($this->settings['loops']['sdexp'][$key]['type'] == '0') {
                    unset($this->settings['loops']['sdexp'][$key]);
                } else {
                    $this->settings['loops']['sdexp'][$key]['pickup_value'] = '*8';
                }
            }
        }

        if (isset($this->settings['loops']['memkey'])) {
            foreach ($this->settings['loops']['memkey'] as $key => $data) {
                if ($this->settings['loops']['memkey'][$key]['type'] == '16') {
                    $this->settings['loops']['memkey'][$key]['pickup_value'] = $this->settings['call_pickup'];
                } elseif ($this->settings['loops']['memkey'][$key]['type'] == '0') {
                    unset($this->settings['loops']['memkey'][$key]);
                } else {
                    $this->settings['loops']['memkey'][$key]['pickup_value'] = '*8';
                }
            }
        }

        if (isset($this->settings['loops']['memkey2'])) {
            foreach ($this->settings['loops']['memkey2'] as $key => $data) {
                if ($this->settings['loops']['memkey2'][$key]['type'] == '16') {
                    $this->settings['loops']['memkey2'][$key]['pickup_value'] = $this->settings['call_pickup'];
                } elseif ($this->settings['loops']['memkey2'][$key]['type'] == '0') {
                    unset($this->settings['loops']['memkey2'][$key]);
                } else {
                    $this->settings['loops']['memkey2'][$key]['pickup_value'] = '*8';
                }
            }
        }
    }

}
