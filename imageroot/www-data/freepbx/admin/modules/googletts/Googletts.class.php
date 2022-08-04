<?php
#
#    Copyright (C) 2018 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of GoogleTTS FreePBX module.
#
#    GoogleTTS module is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any
#    later version.
#
#    GoogleTTS module is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with GoogleTTS module.  If not, see <http://www.gnu.org/licenses/>.
#

namespace FreePBX\modules;
/*
 * Class stub for BMO Module class
 * In getActionbar change "modulename" to the display value for the page
 * In getActionbar change extdisplay to align with whatever variable you use to decide if the page is in edit mode.
 *
 */

class Googletts implements \BMO
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
        $google_api_key = $_REQUEST['google_api_key']?$_REQUEST['google_api_key']:'';
        $text = $_REQUEST['text']?$_REQUEST['text']:'';
        $lang = $_REQUEST['language']?$_REQUEST['language']:'';
        $voice = $_REQUEST['voice']?$_REQUEST['voice']:'';
        $name = $_REQUEST['name']?$_REQUEST['name']:'';
        $description = $_REQUEST['description']?$_REQUEST['description']:'';
        //Handle form submissions
        $dbh = \FreePBX::Database();

        switch ($action) {
        case 'saveapikey':
            googletts_set_option('API_KEY', $google_api_key);
            break;
        case 'add':
            $checksum = md5($text.$lang.$voice);
            if (!file_exists('/tmp/'.$checksum . '.mp3')) {
                $checksum = googletts_tts($text,$lang,$voice);
            }
            $res = googletts_save_recording($checksum,$lang,$name,$description);
            if ($res !== FALSE) {
                header("Location: /freepbx/admin/config.php?display=recordings&action=edit&id=$res");
            }
            break;
        }
    }

    // http://wiki.freepbx.org/pages/viewpage.action?pageId=29753755
    public function getActionBar($request)
    {
        $buttons = array();
        switch ($request['display']) {
        case 'googletts':
            if (!isset($request['view']) || $request['view'] == 'add' || $request['view'] == 'config'){
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
                foreach ( $this->googletts_get() as $announcement) {
                    $ret[] = array('announcement' => $announcement['description'], 'post_dest' => $announcement['post_dest'], 'id' => $announcement['id']); 
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
        $view = $_REQUEST['view']?$_REQUEST['view']:'';
        if ($view == '') {
            $options = googletts_get_options();
            if (!isset($options['API_KEY']) || $options['API_KEY'] == '') {
                $view = 'config';
            } else {
                $view = 'add';
            }
        }
        switch ($view) {
        case 'add':
            $subhead = _('Add a new TTS recording');
            $content = load_view(__DIR__.'/views/add.php');
            break;
        case 'config':
            $subhead = _('Configure Google API Key');
            $content = load_view(__DIR__.'/views/config.php');
            break;
        }
        echo load_view(__DIR__.'/views/default.php', array('subhead' => $subhead, 'content' => $content));
    }
}
