<?PHP

/**
 * Endpoint Manager Master Page File
 *
 * @author Andrew Nagy
 * @license MPL / GPLv2 / LGPL
 * @package Endpoint Manager
 */

require_once dirname(__FILE__).'/config.php';

switch ($page) {
    case 'advanced':
        include LOCAL_PATH . 'includes/advanced.inc';
        break;

    case 'template_manager':
        include LOCAL_PATH . 'includes/template_manager.inc';
        break;

    case 'devices_manager';
        include LOCAL_PATH . 'includes/devices_manager.inc';
        break;

    case 'brand_model_manager':
        include LOCAL_PATH . 'includes/brand_model_manager.inc';
        break;

    case 'installer':
        include LOCAL_PATH . 'install.inc';
        break;

    default:
        include LOCAL_PATH . 'includes/devices_manager.inc';
}