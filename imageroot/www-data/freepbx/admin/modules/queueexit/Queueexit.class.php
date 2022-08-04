<?php
namespace FreePBX\modules;
class Queueexit implements \BMO
{

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

    // This handles any data passed to this module before the page is rendered.
    public function doConfigPageInit($page) {
        $id = $_REQUEST['id']?$_REQUEST['id']:'';
        $action = $_REQUEST['action']?$_REQUEST['action']:'';
        $exampleField = $_REQUEST['example-field']?$_REQUEST['example-field']:'';
        //Handle form submissions
        $dbh = \FreePBX::Database();
        $destinations = array();
        foreach (['timeout_destination','full_destination','joinempty_destination','leaveempty_destination','joinunavail_destination','leaveunavail_destination','continue_destination'] as $key) {
            if (isset($_REQUEST['goto'.$key]) && isset($_REQUEST[$_REQUEST['goto'.$key].$key])) {
                $destinations[$key] = $_REQUEST[$_REQUEST['goto'.$key].$key];
            } else {
                $destinations[$key] = '';
            }
        }
        switch ($action) {
        case 'add':
            $sql = 'INSERT INTO `queueexit` 
                (displayname,timeout_destination,full_destination,joinempty_destination,leaveempty_destination,joinunavail_destination,leaveunavail_destination,continue_destination) 
                VALUES (?,?,?,?,?,?,?,?)';
            $sth = $dbh->prepare($sql);
            $sth->execute(array(
                $_REQUEST['displayname'],
                $destinations['timeout_destination'],
                $destinations['full_destination'],
                $destinations['joinempty_destination'],
                $destinations['leaveempty_destination'],
                $destinations['joinunavail_destination'],
                $destinations['leaveunavail_destination'],
                $destinations['continue_destination']
            ));
            needreload();
            break;
        case 'edit':
            $sql = 'REPLACE INTO `queueexit` 
                (`id`,`displayname`,`timeout_destination`,`full_destination`,`joinempty_destination`,`leaveempty_destination`,`joinunavail_destination`,`leaveunavail_destination`,`continue_destination`) 
                VALUES (?,?,?,?,?,?,?,?,?)';
            $sth = $dbh->prepare($sql);
            $sth->execute(array(
                $_REQUEST['id'],
                $_REQUEST['displayname'],
                $destinations['timeout_destination'],
                $destinations['full_destination'],
                $destinations['joinempty_destination'],
                $destinations['leaveempty_destination'],
                $destinations['joinunavail_destination'],
                $destinations['leaveunavail_destination'],
                $destinations['continue_destination']
            ));
            needreload();
            break;
        case 'delete':
            $sql = 'DELETE FROM `queueexit` WHERE `id` = ?';
            $sth = $dbh->prepare($sql);
            $sth->execute(array($id));
            unset($_REQUEST['action']);
            unset($_REQUEST['id']);
            needreload();
            break;
        }
    }

    public function getActionBar($request)
    {
        $buttons = array();
        switch ($request['display']) {
        case 'queueexit':
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
                foreach ( $this->queueexit_get() as $queueexit) {
                    $name = $queueexit['displayname'];
                    $ret[] = array('queueexit'=>$name, 'id'=>$queueexit['id']); 
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
                $subhead = _('Edit Queue Exit');
                $content = load_view(__DIR__.'/views/form.php', array('config' => queueexit_get_details($id)));
            }else{
                $subhead = _('Add Queue Exit');
                $content = load_view(__DIR__.'/views/form.php');
            }
            break;
        default:
            $subhead = _('Queue Exit List');
            $content = load_view(__DIR__.'/views/grid.php');
            break;
        }
        echo load_view(__DIR__.'/views/default.php', array('subhead' => $subhead, 'content' => $content));
    }

    public function queueexit_get(){
        $dbh = \FreePBX::Database();
        $sql = 'SELECT * FROM queueexit';
        $sth = $dbh->prepare($sql);
        $sth->execute();
        $res = $sth->fetchAll();
        return $res;
    }


}
