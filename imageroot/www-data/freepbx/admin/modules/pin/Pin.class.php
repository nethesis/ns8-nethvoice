<?php
// vim: set ai ts=4 sw=4 ft=php:
namespace FreePBX\modules;
/*
 * Class stub for BMO Module class
 * In getActionbar change "modulename" to the display value for the page
 * In getActionbar change extdisplay to align with whatever variable you use to decide if the page is in edit mode.
 *
 */

class Pin implements \BMO
{

    // Note that the default Constructor comes from BMO/Self_Helper.
    // You may override it here if you wish. By default every BMO
    // object, when created, is handed the FreePBX Singleton object.

    // Do not use these functions to reference a function that may not
    // exist yet - for example, if you add 'testFunction', it may not
    // be visibile in here, as the PREVIOUS Class may already be loaded.
    //
    // Use install.php or uninstall.php instead, which guarantee a new
    // instance of this object.
    public function install()
    {
        $dbh = \FreePBX::Database();
        $sql = "CREATE TABLE IF NOT EXISTS pin(
            `extension` INT(11) NOT NULL PRIMARY KEY,
            `pin` varchar(10) DEFAULT NULL,
            `enabled` tinyint(1) NOT NULL DEFAULT '1'
        );";
        $sth = $dbh->prepare($sql);
        $sth->execute();

        $sql = "CREATE TABLE IF NOT EXISTS pin_protected_routes(
            `route_id` INT(11) NOT NULL DEFAULT 0,
            `enabled` tinyint(1) NOT NULL DEFAULT '0',
            FOREIGN KEY (`route_id`) REFERENCES `outbound_routes`(`route_id`)
                ON UPDATE CASCADE
                ON DELETE CASCADE
        );";
        $sth = $dbh->prepare($sql);
        $sth->execute();
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

    // http://wiki.freepbx.org/display/FOP/BMO+Hooks#BMOHooks-HTTPHooks(ConfigPageInits)
    //
    // This handles any data passed to this module before the page is rendered.
    public function doConfigPageInit($page) {
        $dbh = \FreePBX::Database();
        if ($page == "routing" and isset($_REQUEST['id']) and isset($_REQUEST['EnablePIN'])) {
            /*****************************
             * Routing page hook
             * This is called every time routing page is saved 
             * and takes EnablePIN and route id values to update 
             * pin_protected_routes table
             ******************************/
            $sql = 'DELETE FROM `pin_protected_routes` WHERE `route_id` = ?; INSERT INTO `pin_protected_routes` (`route_id`,`enabled`) VALUES (?,?)';
            $sth = $dbh->prepare($sql);
            $sth->execute(array(
                $_REQUEST['id'],
                $_REQUEST['id'],
                $_REQUEST['EnablePIN'],
            ));
            return true;
        }
        $action = $_REQUEST['action']?$_REQUEST['action']:'';
        //Handle form submissions
        switch ($action) {
        case 'add':
            $sql = 'INSERT INTO `pin`
                (extension,pin,enabled)
                VALUES (?,?,?)';
            $sth = $dbh->prepare($sql);
            $sth->execute(array(
                $_REQUEST['extension'],
                $_REQUEST['pin'],
                $_REQUEST['enabled'],
            ));
            break;
        case 'edit':
            $sql = 'REPLACE INTO `pin` 
                (extension,pin,enabled)
                VALUES (?,?,?)';
            $sth = $dbh->prepare($sql);
            $sth->execute(array(
                $_REQUEST['extension'],
                $_REQUEST['pin'],
                $_REQUEST['enabled'],
            ));
            break;
        case 'delete':
            $sql = 'DELETE FROM `pin` WHERE `extension` = ?';
            $sth = $dbh->prepare($sql);
            $sth->execute(array($_REQUEST['extension']));
            unset($_REQUEST['action']);
            unset($_REQUEST['extension']);
            break;
        }
    }

    // http://wiki.freepbx.org/pages/viewpage.action?pageId=29753755
    public function getActionBar($request)
    {
        $buttons = array();
        switch ($request['display']) {
        case 'pin':
            if (isset($request['view']) && $request['view'] == 'form'){
                $buttons = array(
                    'delete' => array(
                        'name' => 'delete',
                        'id' => 'delete',
                        'value' => _('Delete')
                    ),
                    'submit' => array(
                        'name' => 'submit',
                        'id' => 'submit',
                        'value' => _('Submit')
                    )
                );
                if (empty($request['extdisplay'])) {
                    unset($buttons['delete']);
                }
            }
            break;
        }
        return $buttons;
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
                foreach ( $this->pin_get() as $pin) {
                    $ret[] = array('extension'=>$pin['extension'], 'pin'=>$pin['pin']); 
                }
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

    // http://wiki.freepbx.org/display/FOP/HTML+Output+from+BMO
    public function showPage()
    {
        switch ($_REQUEST['view']) {
        case 'form':
            if(isset($_REQUEST['id']) && !empty($_REQUEST['id'])){
                $subhead = _('Edit Pin');
                $content = load_view(__DIR__.'/views/form.php', array('config' => $this->pin_get($id)));
            }else{
                $subhead = _('Add Pin');
                $content = load_view(__DIR__.'/views/form.php');
            }
            break;
        default:
            $subhead = _('Pin List');
            $content = load_view(__DIR__.'/views/grid.php');
            break;
        }
        echo load_view(__DIR__.'/views/default.php', array('subhead' => $subhead, 'content' => $content));
    }

    public function pin_get($extension = false){
        $dbh = \FreePBX::Database();
        $res=array();
        if ($extension === false) {
            $sql = 'SELECT * FROM pin';
            $sth = $dbh->prepare($sql);
            $sth->execute();
            $tmp = $sth->fetchAll(\PDO::FETCH_ASSOC);
            foreach ($tmp as $p) {
                $res[$p['extension']] = $p;
            }
        } else {
            $sql = 'SELECT * FROM pin WHERE extension = ?';
            $sth = $dbh->prepare($sql);
            $sth->execute(array($extension));
            $res = $sth->fetchAll(\PDO::FETCH_ASSOC)[0];
        }
        return $res;
    }
    // We want to do dialplan stuff.
    public static function myDialplanHooks()
    {
        return 900;
    }
    public function doDialplanHook(&$ext, $engine, $priority) {
        $dbh = \FreePBX::Database();
        $sql = 'SELECT `route_id` FROM `pin_protected_routes` WHERE `enabled` = 1';
        $sth = $dbh->prepare($sql);
        $sth->execute();
        $tmp = $sth->fetchAll(\PDO::FETCH_ASSOC);
        foreach ($tmp as $route) {
            $context = 'outrt-'.$route['route_id'];
            $patterns = core_routing_getroutepatternsbyid($route['route_id']);
            foreach ($patterns as $pattern) {
                $fpattern = core_routing_formatpattern($pattern);
                $exten = $fpattern['dial_pattern'];
                $ext->splice($context, $exten,1, new \ext_agi('outbound-routes-pin.php,${CALLERID(number)}'));
            }
        }
    }
    public static function myConfigPageInits() { return array("routing"); }
}

