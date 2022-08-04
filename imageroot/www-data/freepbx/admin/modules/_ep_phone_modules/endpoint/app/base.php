<?PHP

/**
 * App Base File
 *
 * @author Andrea Marchionni
 * @license MPL / GPLv2 / LGPL
 * @package Nethesis
 */
abstract class endpoint_app_base extends endpoint_base {

    public $brand_name = 'app';
    protected $use_system_dst = FALSE;

    function prepare_for_generateconfig() {
        parent::prepare_for_generateconfig();
    }

}
