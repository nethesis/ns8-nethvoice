<?PHP

/**
 * Panasonic Base File
 *
 * @author Andrea Marchionni
 * @license MPL / GPLv2 / LGPL
 * @package Provisioner
 */
abstract class endpoint_panasonic_base extends endpoint_base {

    public $brand_name = 'panasonic';
    protected $use_system_dst = FALSE;

    function reboot($ip=false) {
        exec($this->engine_location . " -rx 'pjsip send notify reboot-panasonic endpoint " . $this->settings['line'][0]['username'] . "'");
        if ($ip) {
	    exec('/usr/bin/curl http://admin:admin@'. $ip. '/servlet?key=Reboot');
        }
    }

    function prepare_for_generateconfig() {
        parent::prepare_for_generateconfig();
    }

}
