<?PHP

/**
 * Alcatel Base File
 *
 * @author Andrew Nagy
 * @license MPL / GPLv2 / LGPL
 * @package Provisioner
 */
abstract class endpoint_alcatel_base extends endpoint_base {

    public $brand_name = 'alcatel';
    protected $use_system_dst = FALSE;

    function reboot($ip=false) {
	    exec($this->engine_location . " -rx 'pjsip send notify reboot-alcatel endpoint " . $this->settings['line'][0]['username'] . "'");
        if ($ip) {
	    exec('/usr/bin/curl -v http://user:nethvoice@'. $ip. '/activeuri.kl1?command=Reboot');
	    sleep(1);
	    exec('/usr/bin/curl -v http://user:nethvoice@'. $ip. '/activeuri.kl1?command=Reboot');
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
