<?PHP

/**
 * Sangoma Base File
 *
 * @author Andrea Marchionni
 * @license MPL / GPLv2 / LGPL
 * @package Nethesis
 */
abstract class endpoint_sangoma_base extends endpoint_base {

    public $brand_name = 'sangoma';
    protected $use_system_dst = FALSE;

    function reboot($ip=false) {
	exec($this->engine_location . " -rx 'pjsip send notify reboot-sangoma endpoint " . $this->settings['line'][0]['username'] . "'");    
        if ($ip) {
            exec('/usr/bin/curl http://admin:admin@'. $ip. '/Phone_ActionURL\&key=Reboot');
        }
    }

    function prepare_for_generateconfig() {
        parent::prepare_for_generateconfig();
        preg_match('/.*(-|\+)(\d*):(\d*)/i', $this->timezone['timezone'], $matches);
        switch ($matches[3]) {
            case '30':
                $point = '.5';
                break;
            default:
                $point = '';
                break;
        }
        $this->timezone['timezone'] = $matches[1] . $matches[2] . $point;
    }

}
