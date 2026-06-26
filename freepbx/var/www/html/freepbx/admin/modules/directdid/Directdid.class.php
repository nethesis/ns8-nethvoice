<?php
// vim: set ai ts=4 sw=4 ft=php:
namespace FreePBX\modules;
/*
 * Class stub for BMO Module class
 * In getActionbar change "modulename" to the display value for the page
 * In getActionbar change extdisplay to align with whatever variable you use to decide if the page is in edit mode.
 *
 */

class Directdid implements \BMO
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
        $id = $_REQUEST['id']?$_REQUEST['id']:'';
        $action = $_REQUEST['action']?$_REQUEST['action']:'';
        $exampleField = $_REQUEST['example-field']?$_REQUEST['example-field']:'';
        //Handle form submissions
        $dbh = \FreePBX::Database();
        $destinations = array();
        foreach (['timeout_destination','busy_destination','unavailable_destination'] as $key) {
            if (isset($_REQUEST['goto'.$key]) && isset($_REQUEST[$_REQUEST['goto'.$key].$key])) {
                $destinations[$key] = $_REQUEST[$_REQUEST['goto'.$key].$key];
            } else {
                $destinations[$key] = '';
            }
        }
        switch ($action) {
        case 'add':
            $sql = 'INSERT INTO `directdid` 
                (timeout,timeout_destination,busy_destination,unavailable_destination,root,prefix,varlength) 
                VALUES (?,?,?,?,?,?,?)';
            $sth = $dbh->prepare($sql);
            $sth->execute(array(
                $_REQUEST['timeout'],
                $destinations['timeout_destination'],
                $destinations['busy_destination'],
                $destinations['unavailable_destination'],
                $_REQUEST['root'],
                $_REQUEST['prefix'],
                $_REQUEST['varlength']
            ));
            needreload();
            break;
        case 'edit':
            $sql = 'REPLACE INTO `directdid` 
                (`id`,`timeout`,`timeout_destination`,`busy_destination`,`unavailable_destination`,`root`,`prefix`,`varlength`) 
                VALUES (?,?,?,?,?,?,?,?)';
            $sth = $dbh->prepare($sql);
            $sth->execute(array(
                $_REQUEST['id'],
                $_REQUEST['timeout'],
                $destinations['timeout_destination'],
                $destinations['busy_destination'],
                $destinations['unavailable_destination'],
                $_REQUEST['root'],
                $_REQUEST['prefix'],
                $_REQUEST['varlength']
            ));
            needreload();
            break;
        case 'delete':
            $sql = 'DELETE FROM `directdid` WHERE `id` = ?';
            $sth = $dbh->prepare($sql);
            $sth->execute(array($id));
            unset($_REQUEST['action']);
            unset($_REQUEST['id']);
            needreload();
            break;
        }
    }

    // http://wiki.freepbx.org/pages/viewpage.action?pageId=29753755
    public function getActionBar($request)
    {
        $buttons = array();
        switch ($request['display']) {
        case 'directdid':
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
                foreach ( $this->directdid_get() as $did) {
                    $x = '';
                    $name = $did['root'];
                    for ($i = 0; $i < $did['varlength']; $i++) {
                        $x .= 'X';
                    }
                    $name .= $x.' -> '.$did['prefix'].$x;
                    $ret[] = array('did'=>$name, 'id'=>$did['id']); 
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
                $subhead = _('Edit Direct DID');
                $content = load_view(__DIR__.'/views/form.php', array('config' => directdid_get_details($id)));
            }else{
                $subhead = _('Add Direct DID');
                $content = load_view(__DIR__.'/views/form.php');
            }
            break;
        default:
            $subhead = _('Direct DID List');
            $content = load_view(__DIR__.'/views/grid.php');
            break;
        }
        echo load_view(__DIR__.'/views/default.php', array('subhead' => $subhead, 'content' => $content));
    }

    public function directdid_get(){
        $dbh = \FreePBX::Database();
        $sql = 'SELECT * FROM directdid';
        $sth = $dbh->prepare($sql);
        $sth->execute();
        $res = $sth->fetchAll();
        return $res;
    }


}
