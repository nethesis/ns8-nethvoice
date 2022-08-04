<?php
// vim: set ai ts=4 sw=4 ft=php:
// namespace FreePBX\modules;

/*
 * Class stub for BMO Module class
 * In getActionbar change "modulename" to the display value for the page
 * In getActionbar change extdisplay to align with whatever variable you use to decide if the page is in edit mode.
 *
 */

class Queuereport implements \BMO
{
    // Note that the default Constructor comes from BMO/Self_Helper.
    // You may override it here if you wish. By default every BMO
    // object, when created, is handed the FreePBX Singleton object.

    // Do not use these functions to reference a function that may not
    // exist yet - for example, if you add 'testFunction', it may not
    // be visibile in here, as the PREVIOUS Class may already be loaded.

    // Use install.php or uninstall.php instead, which guarantee a new
    // instance of this object.
    public function install()
    {
        out(_('Install Queue Report, this could take a while...'));
        $this->generateLink();
        out('Done!');
    }
    public function uninstall()
    {
    }

    // The following two stubs are planned for implementation in FreePBX 15.
    public function backup()
    {
    }
    public function restore($backup)
    {
    }

    /**
     * Generate UCP assets if needed.
     *
     * @param {bool} $regenassets = false If set to true regenerate assets even if not needed
     */
    public function generateLink()
    {
        $modulef = &module_functions::create();
        $modules = $modulef->getinfo(false);
        $path = \FreePBX::Config()->get_conf_setting('AMPWEBROOT');
        $location = $path . '/queue-report';
        if (!file_exists($location)) {
            symlink(dirname(__FILE__) . '/htdocs', $location);
        }
        foreach ($modules as $module) {
            if (isset($module['rawname'])) {
                $rawname = trim($module['rawname']);
                if (file_exists($path . '/admin/modules/' . $rawname . '/queue-report') && file_exists($path . '/admin/modules/' . $rawname . '/queue-report/' . $rawname . '.class.php')) {
                    if ($module['status'] == MODULE_STATUS_ENABLED) {
                        if (!file_exists($location . '/modules/' . $rawname)) {
                            symlink($path . '/admin/modules/' . $rawname . '/queue-report', $location . '/modules/' . $rawname);
                        }
                    } elseif ($module['status'] != MODULE_STATUS_DISABLED && $module['status'] != MODULE_STATUS_ENABLED) {
                        if (file_exists($location . '/modules/' . $rawname) && is_link($location . '/modules/' . $rawname)) {
                            unlink($location . '/modules/' . $rawname);
                        }
                    }
                }
            }
        }
    }

    // http://wiki.freepbx.org/display/FOP/BMO+Hooks#BMOHooks-HTTPHooks(ConfigPageInits)

    // This handles any data passed to this module before the page is rendered.
    public function doConfigPageInit($page)
    {
    }

    // http://wiki.freepbx.org/pages/viewpage.action?pageId=29753755
    public function getActionBar($request)
    {
    }

    // http://wiki.freepbx.org/display/FOP/BMO+Ajax+Calls
    public function ajaxRequest($req, &$setting)
    {
        switch ($req) {
            case 'getJSON':
                return true;
                break;
            default:
                return false;
                break;
        }
    }

    // This is also documented at http://wiki.freepbx.org/display/FOP/BMO+Ajax+Calls
    public function ajaxHandler()
    {
        switch ($_REQUEST['command']) {
            case 'getJSON':
                switch ($_REQUEST['jdata']) {
                    case 'grid':
                        $ret = array();
                        /*code here to generate array*/
                        return $ret;
                        break;

                    default:
                        return false;
                        break;
                }
                break;

            default:
                return false;
                break;
        }
    }

    // http://wiki.freepbx.org/display/FOP/Adding+Floating+Right+Nav+to+Your+Module
    public function getRightNav($request)
    {
        $html = '<p>Custom HTML</p>';

        return $html;
    }

    // http://wiki.freepbx.org/display/FOP/HTML+Output+from+BMO
    public function showPage()
    {
       header("Location: /freepbx/queue-report");
    }

    /**
     * Below are examples of how to use FreePBX's kvstore.
     *
     * DB_Helper is available when you 'implements \BMO' in the Class Definition.
     * For more documentation, see http://wiki.freepbx.org/display/FOP/BMO+DB_Helper
     */
    public function getOne($id)
    {
    }
    /**
     * getList gets a list od subjects and their respective id.
     */
    public function getList()
    {
    }
    /**
     * addItem Add an Item.
     */
    public function addItem($data)
    {
    }
    /**
     * updateItem Updates the given ID.
     */
    public function updateItem($id, $data)
    {
    }
    /**
     * deleteItem Deletes the given ID.
     */
    public function deleteItem($id)
    {
    }
}
