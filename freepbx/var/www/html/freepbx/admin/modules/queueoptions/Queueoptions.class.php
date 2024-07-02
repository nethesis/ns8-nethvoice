<?php
// vim: set ai ts=4 sw=4 ft=php:
namespace FreePBX\modules;
/*
 * Class stub for BMO Module class
 * In getActionbar change "modulename" to the display value for the page
 * In getActionbar change extdisplay to align with whatever variable you use to decide if the page is in edit mode.
 *
 */

class Queueoptions implements \BMO
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
        $sql = "CREATE TABLE IF NOT EXISTS queueoptions(
            `id` INT(11) AUTO_INCREMENT PRIMARY KEY,
            `name` VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
            `VQ_CIDPP` VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
            `VQ_AINFO` VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
            `VQ_JOINMSG` VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
            `VQ_RETRY` tinyint(1) NOT NULL DEFAULT '0',
            `VQ_OPTIONS` tinyint(1) NOT NULL DEFAULT '0',
            `VQ_GOSUB` VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
            `VQ_AGI` VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
            `VQ_POSITION_ENABLED` tinyint(1) NOT NULL DEFAULT '0',
            `VQ_POSITION` int(11) NOT NULL DEFAULT '2',
            `VQ_CONFIRMMSG` VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
            `VQ_AANNOUNCE` VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
            `VQ_MOH` VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
            `VQ_MAXWAIT_ENABLED` tinyint(1) NOT NULL DEFAULT '0',
            `VQ_MAXWAIT` int(11) NOT NULL DEFAULT '300',
            `VQ_DEST_ENABLED` tinyint(1) NOT NULL DEFAULT '0',
            `VQ_DEST` VARCHAR(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'app-blackhole,hangup,1',
            `DEST` VARCHAR(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'app-blackhole,hangup,1'
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
        $action = $_REQUEST['action']?$_REQUEST['action']:'';
        if ($page === 'queues' and ($action == 'add' or $action == 'edit')) {
            $id = $_REQUEST['extdisplay']?$_REQUEST['extdisplay']:'';
            $sql = 'DELETE FROM `queues_details` WHERE `id` = ? AND `keyword` = "lazymembers"';
            $data = array($id);
            if (isset($_REQUEST['LazyMembers']) && $_REQUEST['LazyMembers'] == 1) {
                $sql .= ';INSERT INTO `queues_details` (`id`,`keyword`,`data`) values (?,"lazymembers","yes")';
                $data[] = $id;
            }
            $sth = $dbh->prepare($sql);
            $sth->execute($data);
        }
        if ($page === 'queueoptions') {
            $id = $_REQUEST['id']?$_REQUEST['id']:'';
            $name = $_REQUEST['name']?$_REQUEST['name']:'';
            $VQ_CIDPP = $_REQUEST['VQ_CIDPP']?$_REQUEST['VQ_CIDPP']:'';
            $VQ_AINFO = $_REQUEST['VQ_AINFO']?$_REQUEST['VQ_AINFO']:'';
            $VQ_JOINMSG = $_REQUEST['VQ_JOINMSG']?$_REQUEST['VQ_JOINMSG']:'';
            $VQ_RETRY = $_REQUEST['VQ_RETRY']?$_REQUEST['VQ_RETRY']:'';
            $VQ_OPTIONS = $_REQUEST['VQ_OPTIONS']?$_REQUEST['VQ_OPTIONS']:'';
            $VQ_GOSUB = $_REQUEST['VQ_GOSUB']?$_REQUEST['VQ_GOSUB']:'';
            $VQ_AGI = $_REQUEST['VQ_AGI']?$_REQUEST['VQ_AGI']:'';
            $VQ_POSITION_ENABLED = $_REQUEST['VQ_POSITION_ENABLED']?$_REQUEST['VQ_POSITION_ENABLED']:0;
            $VQ_POSITION = $_REQUEST['VQ_POSITION']?$_REQUEST['VQ_POSITION']:'';
            $VQ_CONFIRMMSG = $_REQUEST['VQ_CONFIRMMSG']?$_REQUEST['VQ_CONFIRMMSG']:'';
            $VQ_AANNOUNCE = $_REQUEST['VQ_AANNOUNCE']?$_REQUEST['VQ_AANNOUNCE']:'';
            $VQ_MOH = $_REQUEST['VQ_MOH']?$_REQUEST['VQ_MOH']:'';
            $VQ_MAXWAIT_ENABLED = $_REQUEST['VQ_MAXWAIT_ENABLED']?$_REQUEST['VQ_MAXWAIT_ENABLED']:0;
            $VQ_MAXWAIT = $_REQUEST['VQ_MAXWAIT']?$_REQUEST['VQ_MAXWAIT']:'';
            $VQ_DEST_ENABLED = $_REQUEST['VQ_DEST_ENABLED']?$_REQUEST['VQ_DEST_ENABLED']:0;
            $DEST = $_REQUEST['DEST']?$_REQUEST['DEST']:'';
            //Destination
            $key = 'VQ_DEST';
            if (isset($_REQUEST['goto'.$key]) && isset($_REQUEST[$_REQUEST['goto'.$key].$key])) {
                $$key = $_REQUEST[$_REQUEST['goto'.$key].$key];
            } else {
                $$key = '';
            }
            //Handle form submissions
            switch ($action) {
            case 'add':
                $sql = 'INSERT INTO `queueoptions`
                     (`name`,`VQ_CIDPP`,`VQ_AINFO`,`VQ_JOINMSG`,`VQ_RETRY`,`VQ_OPTIONS`,`VQ_GOSUB`,`VQ_AGI`,`VQ_POSITION_ENABLED`,`VQ_POSITION`,`VQ_CONFIRMMSG`,`VQ_AANNOUNCE`,`VQ_MOH`,`VQ_MAXWAIT_ENABLED`,`VQ_MAXWAIT`,`VQ_DEST_ENABLED`,`VQ_DEST`,`DEST`)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
                $sth = $dbh->prepare($sql);
                $sth->execute(array(
                    $name,
                    $VQ_CIDPP,
                    $VQ_AINFO,
                    $VQ_JOINMSG,
                    (int) $VQ_RETRY,
                    (int) $VQ_OPTIONS,
                    $VQ_GOSUB,
                    $VQ_AGI,
                    (int) $VQ_POSITION_ENABLED,
                    (int) $VQ_POSITION,
                    $VQ_CONFIRMMSG,
                    $VQ_AANNOUNCE,
                    $VQ_MOH,
                    (int) $VQ_MAXWAIT_ENABLED,
                    (int) $VQ_MAXWAIT,
                    (int) $VQ_DEST_ENABLED,
                    $VQ_DEST,
                    $DEST
                ));
                needreload();
                break;
            case 'edit':
                $sql = 'REPLACE INTO `queueoptions` 
                    (`id`,`name`,`VQ_CIDPP`,`VQ_AINFO`,`VQ_JOINMSG`,`VQ_RETRY`,`VQ_OPTIONS`,`VQ_GOSUB`,`VQ_AGI`,`VQ_POSITION_ENABLED`,`VQ_POSITION`,`VQ_CONFIRMMSG`,`VQ_AANNOUNCE`,`VQ_MOH`,`VQ_MAXWAIT_ENABLED`,`VQ_MAXWAIT`,`VQ_DEST_ENABLED`,`VQ_DEST`,`DEST`)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
                $sth = $dbh->prepare($sql);
                $sth->execute(array(
                    $id,
                    $name,
                    $VQ_CIDPP,
                    $VQ_AINFO,
                    $VQ_JOINMSG,
                    (int) $VQ_RETRY,
                    (int) $VQ_OPTIONS,
                    $VQ_GOSUB,
                    $VQ_AGI,
                    (int) $VQ_POSITION_ENABLED,
                    (int) $VQ_POSITION,
                    $VQ_CONFIRMMSG,
                    $VQ_AANNOUNCE,
                    $VQ_MOH,
                    (int) $VQ_MAXWAIT_ENABLED,
                    (int) $VQ_MAXWAIT,
                    (int) $VQ_DEST_ENABLED,
                    $VQ_DEST,
                    $DEST
                ));
                needreload();
                break;
            case 'delete':
                $sql = 'DELETE FROM `queueoptions` WHERE `id` = ?';
                $sth = $dbh->prepare($sql);
                $sth->execute(array($id));
                unset($_REQUEST['action']);
                unset($_REQUEST['id']);
                needreload();
                break;
           }
        }
    }

    // http://wiki.freepbx.org/pages/viewpage.action?pageId=29753755
    public function getActionBar($request)
    {
        $buttons = array();
        switch ($request['display']) {
        case 'queueoptions':
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
                foreach ( $this->queueoptions_get() as $qcb) {
                    $ret[] = array('name'=>$qcb['name'], 'id'=>$qcb['id'], 'dest'=>$qcb['DEST']); 
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
                $subhead = _('Edit Queue Options');
                $content = load_view(__DIR__.'/views/form.php', array('config' => $this->queueoptions_get($id)));
            }else{
                $subhead = _('Add Queue Options');
                $content = load_view(__DIR__.'/views/form.php');
            }
            break;
        default:
            $subhead = _('Queue Options List');
            $content = load_view(__DIR__.'/views/grid.php');
            break;
        }
        echo load_view(__DIR__.'/views/default.php', array('subhead' => $subhead, 'content' => $content));
    }

    public function queueoptions_get($id = false){
        $dbh = \FreePBX::Database();
        if ($id === false) {
            $sql = 'SELECT * FROM queueoptions';
            $sth = $dbh->prepare($sql);
            $sth->execute();
            $res = $sth->fetchAll();
        } else {
            $sql = 'SELECT * FROM queueoptions WHERE id = ?';
            $sth = $dbh->prepare($sql);
            $sth->execute(array($id));
            $res = $sth->fetchAll()[0];
        }
        return $res;
    }
    // We want to do dialplan stuff.
    public static function myDialplanHooks()
    {
        return 100;
    }

    public function doDialplanHook(&$ext, $engine, $priority)
    {
        $callbacks = $this->queueoptions_get();
        if (!empty($callbacks)) {
            foreach ($callbacks as $config) {
                $context = 'queueoptions-'.$config['id'];
                $e = 's';
                $ext->add($context,$e,'',new \ext_noop('Queueoptions "'.$config['name'].'"'));
                $options = 't';
                if ($config['VQ_RETRY']) {
                    $options .= 'n';
                }
                if ($config['VQ_OPTIONS']) {
                    $options .= 'c';
                }
                $ext->add($context,$e,'',new \ext_set('VQ_OPTIONS',$options));
                if (!empty($config['VQ_CIDPP'])) {
                    $ext->add($context,$e,'',new \ext_set('VQ_CIDPP',$config['VQ_CIDPP']));
                }
                if (!empty($config['VQ_AINFO'])) {
                    foreach (['\\','\\',':'] as $char) {
                        $config['VQ_AINFO'] = str_replace($char,'\\'.$char,$config['VQ_AINFO']);
                    }
                    $ext->add($context,$e,'',new \ext_set('VQ_AINFO',$config['VQ_AINFO']));
                }
                if (!empty($config['VQ_JOINMSG'])) {
                    $ext->add($context,$e,'',new \ext_set('VQ_JOINMSG',$config['VQ_JOINMSG']));
                }
                if (!empty($config['VQ_GOSUB'])) {
                    $ext->add($context,$e,'',new \ext_set('VQ_GOSUB',$config['VQ_GOSUB']));
                }
                if (!empty($config['VQ_AGI'])) {
                    $ext->add($context,$e,'',new \ext_set('VQ_AGI',$config['VQ_AGI']));
                }
                if ($config['VQ_POSITION_ENABLED']) {
                    $ext->add($context,$e,'',new \ext_set('VQ_POSITION',$config['VQ_POSITION']));
                }
                if (!empty($config['VQ_CONFIRMMSG'])) {
                    $ext->add($context,$e,'',new \ext_set('VQ_CONFIRMMSG',$config['VQ_CONFIRMMSG']));
                }
                if (!empty($config['VQ_AANNOUNCE'])) {
                    $ext->add($context,$e,'',new \ext_set('VQ_AANNOUNCE',$config['VQ_AANNOUNCE']));
                }
                if (!empty($config['VQ_MOH'])) {
                    $ext->add($context,$e,'',new \ext_set('VQ_MOH',$config['VQ_MOH']));
                }
                if ($config['VQ_MAXWAIT_ENABLED']) {
                    $ext->add($context,$e,'',new \ext_set('VQ_MAXWAIT',$config['VQ_MAXWAIT']));
                }
                if ($config['VQ_DEST_ENABLED']) {
                    // if VQ_DEST is queueexit, use queue number from DEST instead of ${EXTEN} which is always 's'
                    if (strpos($config['VQ_DEST'],'queueexit-')===0 and strpos($config['DEST'],'ext-queues') === 0 ) {
                        $queue_exten = preg_replace('/ext-queues,([0-9]+),[0-9]+/', '$1', $config['DEST']);
                        $config['VQ_DEST'] = preg_replace('/queueexit-([0-9]+),\${EXTEN},/', 'queueexit-$1,'.$queue_exten.',',$config['VQ_DEST']);
                    }
                    $ext->add($context,$e,'',new \ext_set('VQ_DEST',$config['VQ_DEST']));
                }
                $ext->add($context,$e,'',new \ext_goto($config['DEST']));
            }
        }
    }
    public static function myConfigPageInits() { return array("queues"); }
    public static function myGuiHooks() { return array(); }
}







