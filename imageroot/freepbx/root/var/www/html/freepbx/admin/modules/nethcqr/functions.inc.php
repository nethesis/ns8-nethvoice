<?php
#
#    Copyright (C) 2017 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of CQR.
#
#    CQR is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any
#    later version.
#
#    CQR is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with CQR.  If not, see <http://www.gnu.org/licenses/>.
#
function nethcqr_destinations(){
    $cqrs = nethcqr_get_details();
    if ($cqrs){
        foreach ($cqrs as $cqr)
            $extens[] = array('destination' => 'nethcqr,'.$cqr['id_cqr'].',1',$cqr['id_cqr'],1, 'description' => $cqr['name'] ? $cqr['name'] : "CQR ID: ".$cqr['id_cqr']);
    return $extens;
    }
    return null;
}

function nethcqr_get_config($engine){
    global $ext;
        global $asterisk_conf;
        switch($engine) {
                case "asterisk":
                        $cqrs = nethcqr_get_details();
                        if($cqrs) {
                                foreach($cqrs as $cqr) {
                    if (recordings_get_file($cqr['announcement'])!='') {
                        $ext->add('nethcqr',$cqr['id_cqr'],'1', new ext_background(recordings_get_file($cqr['announcement']).',m'));
                        $ext->add('nethcqr',$cqr['id_cqr'],'', new ext_agi('nethcqr.php,'.$cqr['id_cqr']));
                    } else {
                        $ext->add('nethcqr',$cqr['id_cqr'],'1', new ext_agi('nethcqr.php,'.$cqr['id_cqr']));
                    }
                    $ext->add('nethcqr',$cqr['id_cqr'],'', new ext_hangup());
                                }
                        }
                break;
        }
}

function nethcqr_configpageinit($pagename) {
    //executed
        global $currentcomponent;
        $action = isset($_REQUEST['action']) ? $_REQUEST['action'] : '';
        $id = isset($_REQUEST['id_cqr']) ? $_REQUEST['id_cqr'] : '';

        if($pagename == 'nethcqr'){
                $currentcomponent->addprocessfunc('nethcqr_configprocess');

                //dont show page if there is no action set
                if ($action && $action != 'delete' || $id) {
                        $currentcomponent->addguifunc('nethcqr_configpageload');
                }

        return true;
    }
}
function nethcqr_configprocess(){
        if (isset($_REQUEST['display']) && $_REQUEST['display'] == 'nethcqr'){
                global $db;
                //get variables
                $get_var = array('id_cqr', 'name', 'announcement', 'description', 'use_code', 'use_workphone',
                                                'manual_code', 'cod_cli_announcement', 'err_announcement', 'code_length', 'code_retries',
                                                'default_destination', 'db_type','db_url','db_name', 'db_user', 'db_pass','query',
                                                'cc_db_type','cc_db_url','cc_db_name', 'cc_db_user', 'cc_db_pass','cc_query','ccc_query');
                foreach($get_var as $var){
                        $vars[$var] = isset($_REQUEST[$var])    ? $_REQUEST[$var]               : '';
                }
                $action         = isset($_REQUEST['action'])    ? $_REQUEST['action']   : '';
                $entries        = isset($_REQUEST['entries'])   ? $_REQUEST['entries']  : '';
                switch ($action) {
                        case 'save':
                                //get real dest
                                $_REQUEST['id_cqr'] = $vars['id_cqr'] = nethcqr_save_details($vars);
                                   nethcqr_save_entries($vars['id_cqr'], $entries);
                                needreload();
                $_REQUEST['action'] = 'edit';
                                redirect_standard_continue('id_cqr');
                        break;
                        case 'delete':
                                nethcqr_delete($vars['id_cqr']);
                                needreload();
                                redirect_standard_continue();
                        break;
                }
        }
}

function nethcqr_configpageload(){
//disegna la pagina. Viene chiamato da nethcqr_configpageinit
    global $currentcomponent, $display;
    $action = isset($_REQUEST['action']) ? $_REQUEST['action'] : '';
    $id_cqr = isset($_REQUEST['id_cqr']) ? $_REQUEST['id_cqr'] : null;

    if ($action  == 'add') {
        $currentcomponent->addguielem('_top', new gui_pageheading('title', _('Add CQR')), 0); //Titolo pagina
        $deet = array('id_cqr', 'name', 'announcement', 'description', 'use_code', 'use_workphone',
                                                   'manual_code', 'cod_cli_announcement', 'err_announcement',
                                                'code_length', 'code_retries','default_destination',
                                                   'db_type','db_url','db_name', 'db_user', 'db_pass','query',
                        'cc_db_type','cc_db_url','cc_db_name', 'cc_db_user', 'cc_db_pass','cc_query','ccc_query');
        //setta le variabili di default del nuovo cqr
        foreach ($deet as $d) {
            switch ($d){
                case 'db_url':
                case 'cc_db_url':
                    $cqr[$d] = 'localhost';
                    break;
                case 'use_code':
                    $cqr[$d] = 1;
                               break;
                case 'use_workphone':
                    $cqr[$d] = 1;
                               break;
                case 'announcement':
                                        $cqr[$d] = 0;
                                        break;
                case 'manual_code':
                    $cqr[$d] = 1;
                                        break;
                case 'cod_cli_announcement':
                                        $cqr[$d] = 0;
                                        break;
                case 'err_announcement':
                                        $cqr[$d] = 0;
                                        break;
                case 'code_length':
                    $cqr[$d] = 5;
                                        break;
                case 'code_retries':
                    $cqr[$d] = 3;
                                    break;
                case 'db_type':
                case 'cc_db_type':
                    $cqr[$d] = 'mysql';
                                    break;
                default:
                    $cqr[$d] = '';
                                    break;
                        }
        }
    } else { //$action != 'add'
        $cqr = nethcqr_get_details($id_cqr);
        $cqr = $cqr[0]; //nethcqr_get_details($id_cqr) return an array of cqrs (only one if $id_cqr != '')
        $label = sprintf(_("Edit CQR: %s"), $cqr['name'] ? $cqr['name'] : 'ID '.$cqr['id_cqr']);
        $currentcomponent->addguielem('_top', new gui_pageheading('title', $label), 0);
        //display usage
        //TODO

        //display delete link
        $label = sprintf(_("Delete CQR: %s"), $cqr['name'] ? $cqr['name'] : 'ID '.$cqr['id_cqr']);
        $del =    '<span><img width="16" height="16" border="0" title="
            '.$label.'" alt="" src="images/core_delete.png"/>&nbsp;'.$label.'</span>';
        $currentcomponent->addguielem('_top',
            new gui_link('del', $del, $_SERVER['PHP_SELF'].'?'.$_SERVER['QUERY_STRING'].'&action=delete', true, false), 0);
    }
    //general options
    $gen_section = _('CQR General Options');
        $currentcomponent->addguielem($gen_section,
                new gui_textbox('name', stripslashes($cqr['name']), _('CQR Name'), _('Name of this CQR.')));
        $currentcomponent->addguielem($gen_section,
                new gui_textbox('description', stripslashes($cqr['description']), _('CQR Description'), _('Description of this cqr.')));

                //Custome code
            //customer code section
            //build select list for code_length and code_retries BUT DO NOT DISPLAY THEM
            //code_length
            $currentcomponent->addoptlist('code_length', false);
                for($i=1; $i <13; $i++)
                        $currentcomponent->addoptlistitem('code_length', $i, $i);
            //code_retries
            $currentcomponent->addoptlist('code_retries', false);
                    for($i=0; $i <11; $i++)
                            $currentcomponent->addoptlistitem('code_retries', $i, $i);

            $cc_section = _('Customer Code Resolution');


///////////////////Customer code use_code//////////////////////////////////////////////////////////////////////////

                $currentcomponent->addguielem($cc_section,
                        new gui_checkbox('use_code', $cqr['use_code'], _('Use Customer Code'), _('If checked, extract customer code from caller ID. If Manual Code is checked too, customer code can be dialed by caller if ID is not recognized. Customer code can be used in CQR query using %CUSTOMERCODE%')));
                //Custome code db_type
                $currentcomponent->addoptlist('cc_db_type', false);
                        $currentcomponent->addoptlistitem('cc_db_type', 'mysql', 'MySQL');
                        $currentcomponent->addoptlistitem('cc_db_type', 'mssql', 'MSSQL');
                $currentcomponent->addguielem($cc_section,
                        new gui_selectbox('cc_db_type', $currentcomponent->getoptlist('cc_db_type'),
                        $cqr['cc_db_type'], _('Customer Code Db Type'), _('Select one of supported database type for custome code query'), false));
                //Custome code db_url
                $currentcomponent->addguielem($cc_section,
                        new gui_textbox('cc_db_url', stripslashes($cqr['cc_db_url']), _('Customer Code Db URL'), _('URL of database for custome code query')));
                //Custome code db_name
                $currentcomponent->addguielem($cc_section,
                        new gui_textbox('cc_db_name', stripslashes($cqr['cc_db_name']), _('Customer Code Db Name'), _('Name of database for custome code query')));
                //Custome code db_user
                $currentcomponent->addguielem($cc_section,
                        new gui_textbox('cc_db_user', stripslashes($cqr['cc_db_user']), _('Customer Code Db Username'), _('Username that will be used accessing database for custome code query')));
                //db_pass
                $currentcomponent->addguielem($cc_section,
                        new gui_password('cc_db_pass', stripslashes($cqr['cc_db_pass']), _('Customer Code Db Password'), _('Password for database for custome code query')));
                //query
                $currentcomponent->addguielem($cc_section,
                        new gui_textarea('cc_query', stripslashes($cqr['cc_query']), _('Customer Code Query'), _('Query for custome code. %CID% will be replaced with caller ID. Example: SELECT `customer_code` FROM `phonebook` WHERE `caller_id` = \'%CID%\'')));
                //Custome code manual_code
                $currentcomponent->addguielem($cc_section,
                        new gui_checkbox('manual_code', $cqr['manual_code'], _('Manual Customer Code'), _('If checked customer code can be dialed by caller if ID is not recognized')));
        //Use work phone for query if exists
                $currentcomponent->addguielem($cc_section,
                        new gui_checkbox('use_workphone', $cqr['use_workphone'], _('Use workphone for query'), _('Use company workphone for query if available instead of callers.')));
            //add recording to ask customer cod
                $currentcomponent->addoptlistitem('recordings', '', _('None'));
                foreach(recordings_list() as $r)
                        $currentcomponent->addoptlistitem('recordings', $r['id'], $r['displayname']);

                $currentcomponent->setoptlistopts('recordings', 'sort', false);

                $currentcomponent->addguielem($cc_section,
                new gui_selectbox('cod_cli_announcement', $currentcomponent->getoptlist('recordings'),
                $cqr['cod_cli_announcement'], _('Announcement Customer Code'), _('Greeting to be played to ask Customer Code.'), false));
            //add recording for error typing customer code
                $currentcomponent->addguielem($cc_section,
                new gui_selectbox('err_announcement', $currentcomponent->getoptlist('recordings'),
                $cqr['err_announcement'], _('Announcement Customer Code Error'), _('Greeting to be played when an error occur typing Customer Code.'), false));
        //code_length
        $currentcomponent->addguielem($cc_section,
                new gui_selectbox('code_length', $currentcomponent->getoptlist('code_length'),
                $cqr['code_length'], _('Customer Code Length'), _('Length of manual customer code'), false));
        //code_retries
        $currentcomponent->addguielem($cc_section,
                new gui_selectbox('code_retries', $currentcomponent->getoptlist('code_retries'),
                $cqr['code_retries'], _('Code Retry'), _('Number of time code can be redialed'), false));
                //query customer code check
                $currentcomponent->addguielem($cc_section,
                new gui_textarea('ccc_query', stripslashes($cqr['ccc_query']), _('Customer Code Check Query'), _('Query for custome code checking. %CODCLI% will be replaced with the custome code. Example: SELECT `customer_code` FROM `phonebook` WHERE `customer_code` = \'%CODCLI%\'')));
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    //cqr options
    $section = _('CQR Options');

    //build recordings select list
//        $currentcomponent->addoptlistitem('recordings', '', _('None'));
 //       foreach(recordings_list() as $r)
   //             $currentcomponent->addoptlistitem('recordings', $r['id'], $r['displayname']);

//    $currentcomponent->setoptlistopts('recordings', 'sort', false);
    //add recording to gui
        $currentcomponent->addguielem($section,
                new gui_selectbox('announcement', $currentcomponent->getoptlist('recordings'),
                        $cqr['announcement'], _('Announcement'), _('Greeting to be played on entry to the CQR.'), false));
    //db_type
    $currentcomponent->addoptlist('db_type', false);
        $currentcomponent->addoptlistitem('db_type', 'mysql', 'MySQL');
        $currentcomponent->addoptlistitem('db_type', 'mssql', 'MSSQL');
    $currentcomponent->addguielem($section,
                new gui_selectbox('db_type', $currentcomponent->getoptlist('db_type'),
                $cqr['db_type'], _('Database Type'), _('Select one of supported database type'), false));
    //db_url
    $currentcomponent->addguielem($section,
                new gui_textbox('db_url', stripslashes($cqr['db_url']), _('Database URL'), _('URL of database')));
    //db_name
    $currentcomponent->addguielem($section,
                new gui_textbox('db_name', stripslashes($cqr['db_name']), _('Database Name'), _('Name of database')));
    //db_user
    $currentcomponent->addguielem($section,
                new gui_textbox('db_user', stripslashes($cqr['db_user']), _('Database Username'), _('Username that will be used accessing database')));
    //db_pass
    $currentcomponent->addguielem($section,
                new gui_password('db_pass', stripslashes($cqr['db_pass']), _('Database Password'), _('Password for database')));
    //query
    $currentcomponent->addguielem($section,
        new gui_textarea('query', stripslashes($cqr['query']), _('Query'), _('Query. %CID% will be replaced with caller ID, %CUSTOMERCODE% with customer code found by Customer code query. Example: SELECT `name` FROM `phonebook` WHERE `customer_code` = \'%CUSTOMERCODE%\'')));
    //default destination
    $currentcomponent->addguielem($section,
        new gui_drawselects('default_destination_drawselect',99999,stripslashes($cqr['default_destination']),_('Default Destination'),_('Default destination of the call'),$require=true));
    $currentcomponent->addguielem($section,
        new gui_hidden('default_destination', 'dummy'));

    //hidden
    $currentcomponent->addguielem($section, new gui_hidden('id_cqr', $cqr['id_cqr']));
        $currentcomponent->addguielem($section, new gui_hidden('action', 'save'));

    //Section for destinations
    $section = _('NethCQR Entries');
    //draw the entries part of the table. A bit hacky perhaps, but hey - it works!
        $currentcomponent->addguielem($section, new guielement('rawhtml', nethcqr_draw_entries($cqr['id_cqr']), ''), 6);

}

function nethcqr_delete($id_cqr){
    global $db;
    $id_cqr=$db->escapeSimple($id_cqr);
    $sql = "DELETE FROM `nethcqr_details` WHERE `id_cqr`=".$id_cqr;
    $results =& $db->query($sql);
    if (DB::isError($results)) {
            freepbx_debug(__FUNCTION__."QUERY: $sql");
        return false;
    }
    $sql = "DELETE FROM `nethcqr_entries` WHERE `id_cqr`=".$id_cqr;
    $results =& $db->query($sql);
    if (DB::isError($results)) {
        freepbx_debug(__FUNCTION__."QUERY: $sql");
            return false;
    }
return true;
}

function nethcqr_get_details($id_cqr=''){
    global $db;
    $id_cqr = $db->escapeSimple($id_cqr);
    $sql = "SELECT * FROM `nethcqr_details`";
    if ($id_cqr) $sql .=" WHERE `id_cqr` = $id_cqr";
    $results =& $db->getAll($sql,DB_FETCHMODE_ASSOC);
    if (DB::isError($results)) {
        freepbx_debug(__FUNCTION__."QUERY: $sql");
            return false;
    }
    return $results;
}

//draw cqr entries table header
function nethcqr_draw_entries_table_header() {
        return  array(_('Position'),_('Condition'), _('Destination'), _('Delete'));
}

function nethcqr_get_entries($id_cqr){
    global $db;
    if ($id_cqr==='') return false;
    $sql = "SELECT `id_cqr`,`id_dest`,`position`,`condition`,`destination` FROM `nethcqr_entries` WHERE `id_cqr`=$id_cqr ORDER BY `position` ASC";
    $results =& $db->getAll($sql,DB_FETCHMODE_ASSOC);
    if (DB::isError($results)) {
            freepbx_debug(__FUNCTION__."QUERY: $sql");
        return false;
    }
    $ret = array();
    foreach ($results as $r)
        $ret[$r['position']] = $r;
    return $ret;
}

//draw destinations actually setted
function nethcqr_draw_entries($id_cqr){
    $headers = nethcqr_draw_entries_table_header();
    $cqr_entries = nethcqr_get_entries($id_cqr);
    if ($cqr_entries)
        foreach ($cqr_entries as $k => $v) {
                        $entries[$k]= $v;
                        $array = array('id_cqr' => $id_cqr, 'position' => $v['position']);
               //         $entries[$k]['hooks'] = nethcqr_draw_entries($array);
                }
    $headers = array ('cqr' => $headers);
    return load_view(dirname(__FILE__) . '/views/entries.php',
        array(
                    'headers' => $headers,
            'entries' => $entries
        )
    );
}

function nenethcqr_my_debug($msg){
$openfile = fopen ("/var/log/asterisk/freepbx_dbug.log","a");
$msg = var_export($msg,true);
fwrite ($openfile,"$msg\n\n");
fclose ($openfile);
}

//save cqr settings
function nethcqr_save_details($vals){
        global $db, $amp_conf;
        foreach($vals as $key => $value) {
                $vals[$key] = $db->escapeSimple($value);
        }
    $id_cqr=$vals['id_cqr'];
        $name=$vals['name'];
        $description=$vals['description'];
        $announcement=(int)$vals['announcement'];
    $use_code = ($vals['use_code']==='on') ? 1 : 0;
    $use_workphone = ($vals['use_workphone']==='on') ? 1 : 0;
    $manual_code = ($vals['manual_code']==='on') ? 1 : 0;
        $cod_cli_announcement=(int)$vals['cod_cli_announcement'];
        $err_announcement=(int)$vals['err_announcement'];
        $code_length=(int)$vals['code_length'];
        $code_retries=(int)$vals['code_retries'];
    $default_destination=$vals['default_destination'];
        $db_type=$vals['db_type'];
        $db_url=$vals['db_url'];
        $db_name=$vals['db_name'];
        $db_user=$vals['db_user'];
        $db_pass=$vals['db_pass'];
        $query=$vals['query'];
    $cc_db_type=$vals['cc_db_type'];
        $cc_db_url=$vals['cc_db_url'];
        $cc_db_name=$vals['cc_db_name'];
        $cc_db_user=$vals['cc_db_user'];
        $cc_db_pass=$vals['cc_db_pass'];
        $cc_query=$vals['cc_query'];
        $ccc_query=$vals['ccc_query'];
        if ($vals['id_cqr']) {
        $sql = "UPDATE `nethcqr_details` SET `name`='$name', `description`='$description', `announcement`=$announcement, `use_code`=$use_code, `use_workphone`=$use_workphone, `manual_code`=$manual_code, `cod_cli_announcement`=$cod_cli_announcement, `err_announcement`=$err_announcement, `code_length`=$code_length, `code_retries`=$code_retries, `db_type`='$db_type', `db_url`='$db_url', `db_name`='$db_name', `db_user`='$db_user', `db_pass`='$db_pass', `query`='$query', `default_destination`='$default_destination', `cc_db_type`='$cc_db_type', `cc_db_url`='$cc_db_url', `cc_db_name`='$cc_db_name', `cc_db_user`='$cc_db_user', `cc_db_pass`='$cc_db_pass', `cc_query`='$cc_query', `ccc_query`='$ccc_query' WHERE `id_cqr` = $id_cqr";
                $foo = $db->query($sql);
                if($db->IsError($foo)) {
                        die_freepbx(print_r($vals,true).' '.$foo->getDebugInfo());
                }
        } else {
                unset($vals['id_cqr']);
        $sql = "INSERT INTO `nethcqr_details` SET `name`='$name', `description`='$description', `announcement`=$announcement, `use_code`=$use_code, `use_workphone`=$use_workphone, `manual_code`=$manual_code, `code_length`=$code_length, `code_retries`=$code_retries, `db_type`='$db_type', `db_url`='$db_url', `db_name`='$db_name', `db_user`='$db_user', `db_pass`='$db_pass', `query`='$query', `default_destination`='$default_destination', `cc_db_type`='$cc_db_type', `cc_db_url`='$cc_db_url', `cc_db_name`='$cc_db_name', `cc_db_user`='$cc_db_user', `cc_db_pass`='$cc_db_pass', `cc_query`='$cc_query', `ccc_query`='$ccc_query' ";
                $foo = $db->query($sql);
                if($db->IsError($foo)) {
                        die_freepbx(print_r($vals,true).' '.$foo->getDebugInfo());
                }
                $sql = ( ($amp_conf["AMPDBENGINE"]=="sqlite3") ? 'SELECT last_insert_rowid()' : 'SELECT LAST_INSERT_ID()');
                $vals['id_cqr'] = $db->getOne($sql);
                if ($db->IsError($foo)){
                        die_freepbx($foo->getDebugInfo());
                }
        }

        return $vals['id_cqr'];
}

function nethcqr_save_entries($id_cqr, $entries){
        global $db;
        $id_cqr = $db->escapeSimple($id_cqr);
        sql('DELETE FROM nethcqr_entries WHERE id_cqr = "' . $id_cqr . '"');
    if ($entries)
        for ($i=0;$i < count($entries['position']); $i++){
	    $dbi = FreePBX::Database();
            $sql = "INSERT INTO `nethcqr_entries` SET `id_cqr`=?, `position`=?, `condition`=?, `destination`=?";
            $sth = $dbi->prepare($sql);
            $sth->execute(array($id_cqr,$entries['position'][$i],$entries['condition'][$i],$entries['goto'][$i]));
        }
return true;
}

function nethcqr_check_destinations($dest=true) {
global $active_modules;

        $destlist = array();
        if (is_array($dest) && empty($dest)) {
                return $destlist;
        }
        $sql = "SELECT `destination`,`name`,`position`,`condition`,`a`.`id_cqr`,`id_dest` FROM nethcqr_details a INNER JOIN nethcqr_entries d ON a.id_cqr = d.id_cqr  ";

        if ($dest !== true) {
                $sql .= "WHERE destination in ('".implode("','",$dest)."')";
        }
        $sql .= "ORDER BY name";
        $results = sql($sql,"getAll",DB_FETCHMODE_ASSOC);

        foreach ($results as $result) {
                $thisdest = $result['destination'];
                $thisid   = $result['id_cqr'];
                $name = $result['name'] ? $result['name'] : 'CQR ' . $thisid;
                $destlist[] = array(
                        'dest' => $thisdest,
                        'description' => sprintf(_("CQR: %s / Option: %s"),$name,$result['condition']),
                        'edit_url' => 'config.php?display=nethcqr&action=edit&id_cqr='.urlencode($thisid),
                );
        }
        return $destlist;
}

function nethcqr_getdestinfo($dest) {
        global $active_modules;
        if (substr(trim($dest),0,7) == 'nethcqr') {
            return array('description' => "NethCQR", 'edit_url' => 'config.php?display=nethcqr');
        } else return false;
}

function nethcqr_change_destination($old_dest, $new_dest) {
        global $db;
    $sql = "UPDATE nethcqr_entries SET dest = '$new_dest' WHERE dest = '$old_dest'";
        $db->query($sql);
}


