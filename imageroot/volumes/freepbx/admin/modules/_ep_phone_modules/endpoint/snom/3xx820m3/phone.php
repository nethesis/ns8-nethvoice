<?php
/**
 * Snom 300, 320, 360, 370 Provisioning System
 *
 * @author Andrew Nagy
 * @license MPL / GPLv2 / LGPL
 * @package Provisioner
 */
class endpoint_snom_3xx820m3_phone extends endpoint_snom_base {

	public $family_line = '3xx820m3';
	
    function prepare_for_generateconfig() {
        parent::prepare_for_generateconfig();
        //Set default ring tone
        if (!isset($this->settings['default_ringtone'])) {
            $this->settings['default_ringtone'] = "Ringer1";
        }
    }
}
