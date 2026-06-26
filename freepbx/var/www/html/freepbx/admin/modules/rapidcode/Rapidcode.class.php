<?php
#
#    Copyright (C) 2018 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of RapidCode FreePBX module.
#
#    RapidCode module is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any
#    later version.
#
#    RapidCode module is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with RapidCode module.  If not, see <http://www.gnu.org/licenses/>.
#
namespace FreePBX\modules;
/*
 * Class stub for BMO Module class
 * In getActionbar change "modulename" to the display value for the page
 * In getActionbar change extdisplay to align with whatever variable you use to decide if the page is in edit mode.
 *
 */

class Rapidcode implements \BMO
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

	// http://wiki.freepbx.org/display/FOP/BMO+Hooks#BMOHooks-HTTPHooks(ConfigPageInits)
	//
	// This handles any data passed to this module before the page is rendered.
	public function doConfigPageInit($page) {
		$id = $_REQUEST['id']?$_REQUEST['id']:'';
		$action = $_REQUEST['action']?$_REQUEST['action']:'';
		$exampleField = $_REQUEST['example-field']?$_REQUEST['example-field']:'';
		//Handle form submissions
		switch ($action) {
		case 'add':
			$id = $this->addItem($_REQUEST['label'],$_REQUEST['number'],$_REQUEST['code']);
			$_REQUEST['id'] = $id;
			break;
		case 'edit':
			$this->updateItem($_REQUEST['id'],$_REQUEST['label'],$_REQUEST['number'],$_REQUEST['code']);
			break;
		case 'delete':
			$this->deleteItem($_REQUEST['id']);
			unset($_REQUEST['action']);
			unset($_REQUEST['id']);
			break;
                case 'importcsv':
                        if (isset($_FILES) && isset($_FILES['csvfile']) && isset($_FILES['csvfile']['tmp_name'])) {
                            $errors = array();
                            if (($handle = fopen($_FILES['csvfile']['tmp_name'], "r")) !== FALSE) {
                                 while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
                                     if (count($data) !== 3) {
                                         $errors[] = _('Wrong elements number on line:').' "'.implode(',',$data).'"';
                                         continue;
                                     }
                                     $res = $this->addItem($data[0],$data[1],$data[2]);
                                     if ($res === FALSE) {
                                         $errors[] = _('Failed to add code on line:').' "'.implode(',',$data).'"';
                                     }
                                 }
                                 fclose($handle);
                             }
                        }
                        break;
		}
	}

	// http://wiki.freepbx.org/pages/viewpage.action?pageId=29753755
	public function getActionBar($request)
	{
		$buttons = array();
		switch ($request['display']) {
		case 'rapidcode':
			$buttons = array(
				'delete' => array(
					'name' => 'delete',
					'id' => 'delete',
					'value' => _('Delete')
				),
				'reset' => array(
					'name' => 'reset',
					'id' => 'reset',
					'value' => _('Reset')
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
				$ret = $this->getList();
                                $code = '*0'; // *0 is the default feature code for RapidCode

                                if (is_array($featurelist = featurecodes_getAllFeaturesDetailed())){
                                    foreach ($featurelist as $f) {
                                        if ($f['featurename'] !== 'rapidcode') {
                                             continue;
                                        }
                                        if (!empty($f['customcode'])) {
                                            $code = $f['customcode'];
                                        } elseif (!empty(['defaultcode'])) {
                                            $code = $f['defaultcode'];
                                        }
                                        break;
                                    }
                                }
                                foreach ($ret as $index => $r) {
                                    $r['code'] = $code . ' ' . $r['code'];
                                    $ret[$index] = $r;
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
				$subhead = _('Edit Rapid Code');
				$content = load_view(__DIR__.'/views/form.php', $this->getOne($_REQUEST['id']));
			}else{
				$subhead = _('Add Rapid Code');
				$content = load_view(__DIR__.'/views/form.php');
			}
			break;
                case 'csvimport':
                    $subhead = _('Import Rapidcodes from CSV');
                    $content = load_view(__DIR__.'/views/csvimport.php');
                    break;
                case 'csvexport':
                    $out = load_view(__DIR__.'/views/csvexport.php');
                    echo $out;
                    exit ();
                    break;
		default:
			$subhead = _('Rapid Code List');
			$content = load_view(__DIR__.'/views/grid.php');
			break;
		}
		echo load_view(__DIR__.'/views/default.php', array('subhead' => $subhead, 'content' => $content));
	}

	public function getOne($id){
            $dbh = \FreePBX::Database();
            $sql = 'SELECT * FROM `rapidcode` WHERE `id` = ?';
            $stmt = $dbh->prepare($sql);
            $stmt->execute(array($id));
            return $stmt->fetchAll(\PDO::FETCH_ASSOC)[0];
	}
	/**
	 * getList gets a list od subjects and their respective id.
	 */
	public function getList(){
            $dbh = \FreePBX::Database();
            $sql = 'SELECT * FROM `rapidcode`';
            $stmt = $dbh->prepare($sql);
            $stmt->execute(array());
            $res = $stmt->fetchAll(\PDO::FETCH_ASSOC);
            return $res;
	}
	/**
	 * addItem Add an Item
	 */
	public function addItem($label,$number,$code){
            try {
                $number = preg_replace('/^\+/','00',$number);
                $number = preg_replace('/[^0-9\*#]/','',$number);
                $code = preg_replace('/[^0-9]/','',$code);
                $dbh = \FreePBX::Database();
                // check if code already exists
                $sql = 'SELECT `id` FROM `rapidcode` WHERE `code` = ?';
                $stmt = $dbh->prepare($sql);
                $stmt->execute(array($code));
                $id = $stmt->fetchAll()[0][0];
                if (isset($id)) {
                    $this->deleteItem($id);
                }
                $sql = 'INSERT INTO `rapidcode` (`label`,`number`,`code`) VALUES (?,?,?)';
                $stmt = $dbh->prepare($sql);
                $stmt->execute(array($label,$number,$code));
                $sql = 'SELECT LAST_INSERT_ID() FROM `rapidcode`';
                $stmt = $dbh->prepare($sql);
                $stmt->execute(array());
                $res = $stmt->fetchAll()[0][0];
                return $res;
            } catch (Exception $e) {
                return FALSE;
            }
	}
	/**
	 * updateItem Updates the given ID
	 */
	public function updateItem($id,$label,$number,$code){
            $number = preg_replace('/^\+/','00',$number);
            $number = preg_replace('/[^0-9\*#]/','',$number);
            $code = preg_replace('/[^0-9]/','',$code);
            $dbh = \FreePBX::Database();
            $sql = 'UPDATE `rapidcode` SET `label` = ?, `number` = ?, `code` = ? WHERE id = ?';
            $stmt = $dbh->prepare($sql);
            $stmt->execute(array($label,$number,$code,$id));
	}
	/**
	 * deleteItem Deletes the given ID
	 */
	public function deleteItem($id){
            $dbh = \FreePBX::Database();
            $sql = 'DELETE FROM `rapidcode` WHERE `id` = ?';
            $stmt = $dbh->prepare($sql);
            $stmt->execute(array($id));
	}









}
