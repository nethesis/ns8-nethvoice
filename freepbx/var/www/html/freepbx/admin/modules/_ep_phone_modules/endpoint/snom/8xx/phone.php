<?php
/**
 * Snom 8xx Provisioning System
 *
 * @author Andrew Nagy & Jort
 * @license MPL / GPLv2 / LGPL
 * @package Provisioner
 */
class endpoint_snom_8xx_phone extends endpoint_snom_base {

	public $family_line = '8xx';
	
    function prepare_for_generateconfig() {
        parent::prepare_for_generateconfig();
        //Set default ring tone
        if (!isset($this->settings['default_ringtone'])) {
            $this->settings['default_ringtone'] = "Ringer1";
        }
    }
}
