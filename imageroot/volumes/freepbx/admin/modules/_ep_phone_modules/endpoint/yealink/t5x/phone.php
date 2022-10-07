<?php

/**
 * Yealink In Production Modules Phone File
 *
 * @author Andrew Nagy
 * @license MPL / GPLv2 / LGPL
 * @package Provisioner
 */
class endpoint_yealink_t5x_phone extends endpoint_yealink_base {

    public $family_line = 't5x';
    protected $use_system_dst = FALSE;

    function parse_lines_hook($line_data, $line_total) {
		$this->settings['call_pickup'] = isset($this->settings['call_pickup']) ? $this->settings['call_pickup'] : '*8';
        $line_data['line_active'] = 1;
        $line_data['line_m1'] = $line_data['line'];
        $line_data['voicemail_number'] = '*97';
        $line_data['missed_call_log'] = isset($this->settings['missed_call_log']) ? $this->settings['missed_call_log'] : 0;
	$line_data['custom_ringtone'] = isset($this->settings['custom_ringtone']) ? $this->settings['custom_ringtone'] : 'Ring1.wav';
	$line_data['sip_server_override'] = isset($this->settings['sip_server_override']) ? $this->settings['sip_server_override'] : '{$server_host}';
	$line_data['manual_use_outbound_proxy'] = isset($this->settings['manual_use_outbound_proxy']) ? $this->settings['manual_use_outbound_proxy'] : 0;
	$line_data['manual_outbound_proxy_server'] = isset($this->settings['manual_outbound_proxy_server']) ? $this->settings['manual_outbound_proxy_server'] : '{$server_host}';
	$line_data['pickup_value'] = isset($this->settings['pickup_value']) ? $this->settings['pickup_value'] : $this->settings['call_pickup'];

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
		$this->settings['call_pickup'] = isset($this->settings['call_pickup']) ? $this->settings['call_pickup'] : '*8';
        # This contains the last 2 digits of y0000000000xx.cfg, for each model.
        $model_suffixes = array(
            'T52S' => '74',
            'T53'  => '95',
            'T53W' => '95',
            'T54S' => '70',
            'T54W' => '96',
            'T57W' => '97',
            );
        //Yealink likes lower case letters in its mac address
        $this->mac = strtolower($this->mac);
        $this->config_file_replacements['$suffix'] = $model_suffixes[$this->model];
        parent::prepare_for_generateconfig();


	//Set default ring tone
        if (!isset($this->settings['default_ringtone'])) {
            $this->settings['default_ringtone'] = "Ring1.wav";
        }

        if (!isset($this->settings['pound'])) {
            $this->settings['pound'] = "1";
        }

        //Set line key defaults
        $s = $this->max_lines;
        for ($i = 1; $i <= 3; $i++) {
            if (!isset($this->settings['loops']['linekey'][$i])) {
                $this->settings['loops']['linekey'][$i] = array(
                    "mode" => "line",
                    "line" => "1",
                    "type" => 15
                );
	    }
	}
        for ($y = 4; $y <= $s; $y++) {
            if (!isset($this->settings['loops']['linekey'][$y])) {
                $this->settings['loops']['linekey'][$y] = array(
                    "mode" => "N\/A",
                    "type" => 0
                );
            }
        }

        if (isset($this->settings['loops']['softkey'])) {
            foreach ($this->settings['loops']['softkey'] as $key => $data) {
                if ($this->settings['loops']['softkey'][$key]['type'] == '0') {
                    unset($this->settings['loops']['softkey'][$key]);
                }
            }
        } else {
            $this->settings['loops']['softkey'][1]['label'] = "History";
            $this->settings['loops']['softkey'][2]['type'] = 38;
            $this->settings['loops']['softkey'][2]['label'] = "LDAP";
            $this->settings['loops']['softkey'][3]['type'] = 23;
            $this->settings['loops']['softkey'][3]['label'] = "Pickup";
            $this->settings['loops']['softkey'][4]['type'] = 30;
            $this->settings['loops']['softkey'][4]['label'] = "Menu";
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

	if (isset($this->settings['loops']['sdexp2'])) {
            foreach ($this->settings['loops']['sdexp2'] as $key => $data) {
                if ($this->settings['loops']['sdexp2'][$key]['type'] == '16') {
                    $this->settings['loops']['sdexp2'][$key]['pickup_value'] = $this->settings['call_pickup'];
                } elseif ($this->settings['loops']['sdexp2'][$key]['type'] == '0') {
                    unset($this->settings['loops']['sdexp2'][$key]);
                } else {
                    $this->settings['loops']['sdexp2'][$key]['pickup_value'] = '*8';
                }
            }
        }
    }
}
