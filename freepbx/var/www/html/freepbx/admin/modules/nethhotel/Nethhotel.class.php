<?php
// vim: set ai ts=4 sw=4 ft=php:
// namespace FreePBX\modules;

/*
 * Class stub for BMO Module class
 * In getActionbar change "modulename" to the display value for the page
 * In getActionbar change extdisplay to align with whatever variable you use to decide if the page is in edit mode.
 *
 */

class Nethhotel implements \BMO
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
        global $db;
        out(_('Install Neth Hotel, this could take a while...'));
        $this->generateLink();
        // Hotel contexts
        $contexts_admin = customcontexts_getcontextslist();
        #print_r($contexts_admin);
        $old_context_admin_exists = False;
        $new_context_admin_exists = False;
        foreach ($contexts_admin as $context) {
            if ($context['0'] === 'hotel') {
                $old_context_admin_exists = True;
            } elseif ($context['0'] === 'hotel-admin') {
                $new_context_admin_exists = True;
            }
        }

        if ($new_context_admin_exists) {
            exit(0);
        } elseif ($old_context_admin_exists) {
            // Old context admin exists, cleanup contexts
            customcontexts_customcontextsadmin_del('hotel');
            customcontexts_customcontextsadmin_add('hotel-admin','Hotel Admin Rooms Context');
            customcontexts_customcontextsadmin_editincludes('hotel-admin',['camere'=> 'Hotel Rooms Context']);
            // TODO Get hotel context permissions
            foreach (customcontexts_getincludes('hotel') as $val) {
                $context_permissions[$val[2]] = array("allow" => $val[4], "sort" => $val[5]);
            }
            $context_permissions['camere'] = ['allow'=>'yes','sort'=>'-1'];
            customcontexts_customcontexts_editincludes('hotel',$context_permissions,'hotel');
        } else {
            customcontexts_customcontextsadmin_add('hotel-admin','Hotel Admin Rooms Context');
            customcontexts_customcontextsadmin_editincludes('hotel-admin',['camere'=> 'Hotel Rooms Context']);
            // set hotel context default permissions
            $context_default_permissions = array(
                "parkedcalls" => ["allow" => "yes", "sort" => 1],
                "from-internal-custom" => ["allow" => "yes", "sort" => 2],
                "from-internal-additional" => ["allow" => "no", "sort" => 3],
                "ext-bosssecretary" => ["allow" => "yes", "sort" => 4],
                "app-cf-toggle" => ["allow" => "yes", "sort" => 5],
                "app-cf-busy-prompting-on" => ["allow" => "yes", "sort" => 6],
                "app-cf-busy-on" => ["allow" => "yes", "sort" => 7],
                "app-cf-busy-off-any" => ["allow" => "yes", "sort" => 8],
                "app-cf-busy-off" => ["allow" => "yes", "sort" => 9],
                "app-cf-off" => ["allow" => "yes", "sort" => 10],
                "app-cf-off-any" => ["allow" => "yes", "sort" => 11],
                "app-cf-unavailable-prompt-on" => ["allow" => "yes", "sort" => 12],
                "app-cf-unavailable-on" => ["allow" => "yes", "sort" => 13],
                "app-cf-unavailable-off" => ["allow" => "yes", "sort" => 14],
                "app-cf-on" => ["allow" => "yes", "sort" => 15],
                "app-cf-prompting-on" => ["allow" => "yes", "sort" => 16],
                "ext-cf-hints" => ["allow" => "yes", "sort" => 17],
                "app-callwaiting-cwoff" => ["allow" => "yes", "sort" => 18],
                "app-callwaiting-cwon" => ["allow" => "yes", "sort" => 19],
                "ext-meetme" => ["allow" => "yes", "sort" => 20],
                "app-daynight-toggle" => ["allow" => "yes", "sort" => 21],
                "app-dnd-off" => ["allow" => "yes", "sort" => 22],
                "app-dnd-on" => ["allow" => "yes", "sort" => 23],
                "app-dnd-toggle" => ["allow" => "yes", "sort" => 24],
                "ext-dnd-hints" => ["allow" => "yes", "sort" => 25],
                "app-fax" => ["allow" => "yes", "sort" => 26],
                "app-fmf-toggle" => ["allow" => "yes", "sort" => 27],
                "ext-findmefollow" => ["allow" => "yes", "sort" => 28],
                "fmgrps" => ["allow" => "yes", "sort" => 29],
                "app-calltrace" => ["allow" => "yes", "sort" => 30],
                "app-echo-test" => ["allow" => "yes", "sort" => 31],
                "app-speakextennum" => ["allow" => "yes", "sort" => 32],
                "app-speakingclock" => ["allow" => "yes", "sort" => 33],
                "ext-intercom-users" => ["allow" => "yes", "sort" => 34],
                "park-hints" => ["allow" => "yes", "sort" => 35],
                "app-parking" => ["allow" => "yes", "sort" => 36],
                "ext-queues" => ["allow" => "yes", "sort" => 37],
                "app-queue-toggle" => ["allow" => "yes", "sort" => 38],
                "app-queue-caller-count" => ["allow" => "yes", "sort" => 39],
                "app-rapidcode" => ["allow" => "yes", "sort" => 40],
                "app-recordings" => ["allow" => "yes", "sort" => 41],
                "ext-group" => ["allow" => "yes", "sort" => 42],
                "grps" => ["allow" => "yes", "sort" => 43],
                "vmblast-grp" => ["allow" => "yes", "sort" => 44],
                "timeconditions-toggles" => ["allow" => "yes", "sort" => 45],
                "app-dialvm" => ["allow" => "yes", "sort" => 46],
                "app-vmmain" => ["allow" => "yes", "sort" => 47],
                "app-blacklist" => ["allow" => "yes", "sort" => 48],
                "cti-conference" => ["allow" => "yes", "sort" => 49],
                "ext-local-confirm" => ["allow" => "yes", "sort" => 50],
                "findmefollow-ringallv2" => ["allow" => "yes", "sort" => 51],
                "app-pickup" => ["allow" => "yes", "sort" => 52],
                "app-chanspy" => ["allow" => "yes", "sort" => 53],
                "ext-test" => ["allow" => "yes", "sort" => 54],
                "ext-local" => ["allow" => "yes", "sort" => 55],
                "outbound-allroutes" => ["allow" => "yes", "sort" => 56],
                "camere" => ['allow'=>'yes','sort'=>'-1']
            );
            customcontexts_customcontexts_editincludes('hotel',$context_default_permissions,'hotel');
            # Allow all outbound routes
            foreach (customcontexts_getincludes('hotel') as $val) {
                if (strpos($val[2],'outrt-') !== False) {
                    $context_permissions[$val[2]] = array("allow" => "yes", "sort" => $val[5]);
                } else {
                    $context_permissions[$val[2]] = array("allow" => $val[4], "sort" => $val[5]);
                }
            }
            $context_permissions['camere'] = ['allow'=>'yes','sort'=>'-1'];
            customcontexts_customcontexts_editincludes('hotel',$context_permissions,'hotel');
            customcontexts_customcontexts_add('hotel','Hotel Rooms Context',null,'app-blackhole,hangup,1','app-blackhole,hangup,1',null,null);
        }

        # Lock hotel-admin context
        $dbh = FreePBX::Database();
        $sql = "UPDATE customcontexts_contexts_list SET locked = 1 WHERE context = 'hotel-admin'";
        $sth = $dbh->prepare($sql);
        $sth->execute();
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
        $location = $path . '/hotel';
        if (!file_exists($location)) {
            symlink(dirname(__FILE__) . '/htdocs', $location);
        }
        foreach ($modules as $module) {
            if (isset($module['rawname'])) {
                $rawname = trim($module['rawname']);
                if (file_exists($path . '/admin/modules/' . $rawname . '/hotel') && file_exists($path . '/admin/modules/' . $rawname . '/hotel/' . $rawname . '.class.php')) {
                    if ($module['status'] == MODULE_STATUS_ENABLED) {
                        if (!file_exists($location . '/modules/' . $rawname)) {
                            symlink($path . '/admin/modules/' . $rawname . '/hotel', $location . '/modules/' . $rawname);
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
        echo load_view(__DIR__.'/htdocs/index.php', array('subhead' => $subhead, 'content' => $content));
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
