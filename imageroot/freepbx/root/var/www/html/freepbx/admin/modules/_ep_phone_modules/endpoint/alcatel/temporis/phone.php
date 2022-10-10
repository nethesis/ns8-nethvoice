<?php

/**
 * Alcatel Modules Phone File
 *
 * @author Andrew Nagy
 * @license MPL / GPLv2 / LGPL
 * @package Provisioner
 */
class endpoint_alcatel_temporis_phone extends endpoint_alcatel_base {

    public $family_line = 'temporis';

    function prepare_for_generateconfig() {
        //Alcatel likes lower case letters in its mac address
        $this->mac = strtoupper($this->mac);
        parent::prepare_for_generateconfig();

	//Set default ring tone
        if (!isset($this->settings['default_ringtone'])) {
            $this->settings['default_ringtone'] = "1";
        }


    }

}
