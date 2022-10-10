<?php
/**
 * Snom D120 Provisioning System
 *
 * @author Andrea Marchionni
 * @license MPL / GPLv2 / LGPL
 * @package Provisioner
 */
class endpoint_snom_1xx_phone extends endpoint_snom_base {

	public $family_line = '1xx';
	
    function prepare_for_generateconfig() {
        parent::prepare_for_generateconfig();
        //Set default ring tone
        if (!isset($this->settings['default_ringtone'])) {
            $this->settings['default_ringtone'] = "Ringer1";
        }
    }
}
