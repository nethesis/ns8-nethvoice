<?php

/**
 * Alcatel Modules Phone File
 *
 * @author Andrea Marchionni
 * @license MPL / GPLv2 / LGPL
 * @package Provisioner
 */
class endpoint_gigaset_maxwell_phone extends endpoint_gigaset_base {

    public $family_line = 'maxwell';
#    public $dynamic_mapping = array(
#        '$mac.cfg' => array('Maxwell_$model_$mac.cfg')
#    );

    function prepare_for_generateconfig() {
        //Alcatel likes lower case letters in its mac address
        $this->mac = strtoupper($this->mac);
        parent::prepare_for_generateconfig();

//Set default ring tone
        if (!isset($this->settings['default_ringtone'])) {
            $this->settings['default_ringtone'] = "06_Gigaset.wav";
        }

//Set softkeys or defaults
        if (!isset($this->settings['loops']['softkey'])) {
            $this->settings['loops']['softkey'][0]['type'] = 17;
            $this->settings['loops']['softkey'][1]['type'] = 10;
            $this->settings['loops']['softkey'][1]['connection'] = 0;
            $this->settings['loops']['softkey'][1]['enablecode'] = '*8';
            $this->settings['loops']['softkey'][1]['disablecode'] = '*8';
            $this->settings['loops']['softkey'][1]['enablename'] = "Pickup";
            $this->settings['loops']['softkey'][1]['disablename'] = "Pickup";
        }

//Set Function key defaults
        for ($i = 0; $i <= 3; $i++) {
            if (!isset($this->settings['loops']['functionkey'][$i])) {
                $this->settings['loops']['functionkey'][$i] = array(
                    "type" => 0,
                    "connection" => 0,
                    "color" => 3
                );
            }
        }
    }

}
