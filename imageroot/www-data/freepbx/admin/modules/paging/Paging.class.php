<?php
// vim: set ai ts=4 sw=4 ft=php:
namespace FreePBX\modules;

class Paging extends \FreePBX_Helpers implements \BMO {

	public function __construct($freepbx = null) {
		$this->freepbx = $freepbx;
		$this->db = $freepbx->Database;
	}

	public function install() {

	}
	public function uninstall() {

	}
	public function backup(){

	}
	public function restore($backup){

	}

	// User and Extensions page, which are part of core.
	public static function myGuiHooks() {
		return array("core");
	}

	// Which also means we need to catch POST's from those pages.
	public static function myConfigPageInits() {
		return array("extensions", "users");
	}

	// Called when generating the page
	public function doGuiHook(&$cc) {
		if ($_REQUEST['display'] == "extensions" || $_REQUEST['display'] == "users") {
			if (isset($_REQUEST['tech_hardware']) || $_REQUEST['extdisplay']) {
				$this->addOverridesToPage($cc);
			}
		}
		return;
	}

	public function doConfigPageInit($page) {
		$conf = \FreePBX::Config();
		$ramp_conf = $conf->get_conf_settings();
		foreach ($ramp_conf as $key => $value) {
			$amp_conf[$key] = $value['value'];
		}
		$request = $_REQUEST;
		$action = isset($request['action'])?$request['action']:null;
		$extdisplay = isset($request['extdisplay'])?$request['extdisplay']:null;

		if ($page == "extensions" || $page == "users") {
			// Catch the POST.
			if (isset($request['extdisplay']) && isset($request['intercom_override'])) {
				if (preg_match('/override=(.+)/', $request['intercom_override'], $match)) {
					//While adding extension extdisplay field is coming as empty so
					// we have to take extension from the extension field.
					if (($request['action'] == 'add') && (empty($request['extdisplay']))) {
						$ext = $request['extension'];
					} else {
						$ext = $request['extdisplay'];
					}
					$this->setOverride($ext, $match[1]);
				}
			}
		}
		if($page == "paging"){
			$get_vars = array(
				'action'		=> '',
				'announce'		=> '',
				'conflict_url'	=> '',
				'default_group'	=> 0,
				'description'	=> '',
				'display'		=> 'paging',
				'duplex'		=> 0,
				'extdisplay'	=> '',
				'force_page'	=> 0,
				'pagegrp'		=> '',
				'pagelist'		=> '',
				'pagenbr'		=> '',
				'Submit'		=> '',
				'announcement' => '',
				'type'			=> 'tool',
				'volume'		=> 0,
				'drop_silence'		=>'0' 


			);

			foreach ($get_vars as $k => $v) {
				$vars[$k] = isset($request[$k]) ? $request[$k] : $v;
			}
			$vars['pagenbr'] = trim($vars['pagenbr']);
			if ($vars['Submit'] == _('Delete')) {
				$vars['action'] = 'delete';
				$request['action'] = 'delete';
			}
			//$vars['announce'] = $vars['announcement']; no need to do this both are differnt varibles
			//action actions
			switch ($vars['action']) {
				case 'delete':
					paging_del($vars['extdisplay']);
					break;
				case 'submit':
					//TODO: issue, we are deleting and adding at the same time so remeber later to check
					//      if we are deleting a destination
					$usage_arr = array();
					if ($vars['pagegrp'] != $vars['pagenbr']) {
						$usage_arr = framework_check_extension_usage($vars['pagenbr']);
					}
					if ($usage_arr) {
						$vars['conflict_url'] = framework_display_extension_usage_alert($usage_arr);
						break;
					} else {
						//limit saved devices to PAGINGMAXPARTICIPANTS
						if (isset($amp_conf['PAGINGMAXPARTICIPANTS'])
							&& $amp_conf['PAGINGMAXPARTICIPANTS']
						) {
							if (!empty($vars['pagelist'])) {
								$vars['pagelist'] = array_slice(
									$vars['pagelist'],
									0,
									$amp_conf['PAGINGMAXPARTICIPANTS']);
							}
						}

						paging_modify(
							$vars['pagegrp'],
							$vars['pagenbr'],
							$vars['pagelist'],
							$vars['force_page'],
							$vars['duplex'],
							$vars['description'],
							$vars['default_group'],
							$vars['announcement'],
							$vars['volume']
						);
						$request['action'] = $vars['action'] = 'modify';
						if ($vars['extdisplay'] == '' || ($vars['pagegrp'] != $vars['pagenbr'])) {
							$request['extdisplay'] = $vars['extdisplay'] = $vars['pagenbr'];
						}
						$_REQUEST['extdisplay'] = $vars['extdisplay'];
					}
					break;
				case 'save_settings':
					$def = paging_get_autoanswer_defaults(true);
					$doptions = 'b(autoanswer^s^1(${ALERTINFO},${CALLINFO}))';
					$this->astman->database_put("paging","quiet",$request['quiet']);
					
					if (ctype_digit($vars['announce'])) {
						$r = recordings_get($vars['announce']);
						if ($r) {
							$vars['announce'] = $r['filename'];
						} else {
							$vars['announce'] = 'beep';
						}
						$a = 'A(' . $vars['announce'] . ')'.$doptions;
					} elseif ($vars['announce'] == 'none') {
						$a = "A()$doptions";
					} elseif ($vars['announce'] == 'beep') {
						$a = "A(beep)$doptions";
					}

					$this->setDropSilence(!empty($vars['drop_silence']));
					paging_set_autoanswer_defaults(array('DOPTIONS' => $a));
					needreload();
					break;
				case 'getJSON':
					header('Content-Type: application/json');
					switch ($request['jdata']) {
						case 'grid':
								$pagelist = paging_list();
								$rdata = array();
								foreach($pagelist as $pg){
									$rdata[] = array('description' => $pg['description'],'page_group' => $pg['page_group'],'is_default' => $pg['is_default'] , 'link' => array($pg['description'],$pg['page_group']));
								}
							echo json_encode($rdata);
							exit();
						break;

						default:
							echo json_encode(array('error' => _("Unknown Request")));
							exit();
						break;
					}
				break;
				default:
					break;
			}
		}
	}

	public function addOverridesToPage(&$cc) {
		$cc->addoptlistitem('intercom_override_options', 'reject', _("Reject"));
		$cc->addoptlistitem('intercom_override_options', 'ring', _("Ring"));
		$cc->addoptlistitem('intercom_override_options', 'force', _("Force"));
		$cc->setoptlistopts('intercom_override_options', 'sort', false);

		$section = _("Paging and Intercom");
		$name = _("Intercom Override");
		$info  = _("When using Intercom to page an extension, if the extension is in use, you have three options.")."<ul>\n";
		$info .= "<li>"._("<strong>Reject</strong><br> Return a BUSY signal to the caller")."</li>\n";
		$info .= "<li>"._("<strong>Ring</strong><br> Treat the page as a normal call, and ring the extension (if Call Waiting is disabled, this will return BUSY")."</li>\n";
		$info .= "<li>"._("<strong>Force</strong><br> Send the headers telling the phone to go into auto answer mode. This may not work, and is dependant on the phone.")."</li>\n";
		$info .= "</ul>";
		$stat = $this->getOverride($_REQUEST['extdisplay']);
		$cc->addguielem($section, new \gui_radio('intercom_override', $cc->getoptlist('intercom_override_options'), $stat, $name, $info), 5, null, "other", "advanced");

	}

	public function getDropSilence() {
		$set = $this->getConfig("dsp_drop_silence_set");
		if(!$set) {
			return true;
		}
		return $this->getConfig("dsp_drop_silence");
	}

	public function setDropSilence($state) {
		$this->setConfig("dsp_drop_silence_set", 1);
		$state = !empty($state) ? 1 : 0;
		return $this->setConfig("dsp_drop_silence", $state);
	}

	public function getOverride($ext = false) {
		if ($ext === false) {
			$or = "reject";
		} else {
			$or = $this->getConfig("intercom-override", $ext);
		}
		if (!$or) {
			return "reject";
		} else {
			return $or;
		}
	}

	private function setOverride($ext = false, $override = "reject") {
		if ($ext === false) {
			throw new \Exception("No Extension given");
		}
		$this->setConfig("intercom-override", $override, $ext);
		$astman = $this->freepbx->astman;
		$astman->database_put('AMPUSER', "$ext/intercom/override", $override);
	}

	public function getActionBar($request) {
		$buttons = array();
		switch($request['display']) {
			case 'paging':
				$buttons = array(
					'delete' => array(
						'name' => 'delete',
						'id' => 'delete',
						'value' => _("Delete")
					),
					'reset' => array(
						'name' => 'reset',
						'id' => 'reset',
						'value' => _("Reset")
					),
					'submit' => array(
						'name' => 'submit',
						'id' => 'submit',
						'value' => _("Submit")
					)
				);
				if(empty($request['extdisplay'])){
					unset($buttons['delete']);
				}
				$request['view'] = isset($request['view'])?$request['view']:'';
				if($request['view'] != 'form'){
					$buttons = array();
				}
				if($request['view'] == 'form' && $request['action'] == 'submit'){
					$buttons = array();
				 }
				return $buttons;
			break;
		}
	}
	public function ajaxRequest($req, &$setting) {
		switch ($req) {
			case 'getJSON':
			case 'setDefault':
				return true;
				break;
			default:
				return false;
				break;
		}
	}

	public function ajaxHandler(){
		switch ($_REQUEST['command']) {
			case 'getJSON':
				switch ($_REQUEST['jdata']) {
					case 'grid':
						return array_values($this->listGroups());
						break;
					default:
						return false;
						break;
				}
				break;
			case 'setDefault':
				$this->setDefaultGroup($_REQUEST['ext']);
				break;
			default:
				return false;
				break;
		}
	}

	public function listGroups(){
		$sql = "SELECT page_group, description FROM paging_config ORDER BY page_group";
		$stmt = $this->db->prepare($sql);
		$stmt->execute();
		$results = $stmt->fetchAll(\PDO::FETCH_ASSOC);
		if(!$results) {
			$results = array();
		} else {
			$default = $this->getDefaultGroup();
			foreach ($results as $key => $list) {
				$results[$key][0] = $list['page_group'];
				if ($list['page_group'] === $default) {
					$results[$key]['is_default'] = true;
				} else {
					$results[$key]['is_default'] = false;
				}
			}
		}
		return $results;
	}
	public function getDefaultGroup(){
	 	$sql = "SELECT value FROM `admin` WHERE variable = 'default_page_grp' limit 1";
		$stmt = $this->db->prepare($sql);
		$stmt->execute();
		$result = $stmt->fetchColumn();
		$default_group = $result;
		return $default_group;
	}
	public function setDefaultGroup($ext){
		$sql = "INSERT INTO admin (variable,value) VALUES ('default_page_grp',:ext) ON DUPLICATE KEY UPDATE value = :ext";
		$stmt = $this->db->prepare($sql);
		return $stmt->execute(array('ext' => $ext));
	}
	public function hookForm(){
	$module_hook = \moduleHook::create();
	$mods = \FreePBX::Hooks()->processHooks();
	$sections = array();
	foreach($mods as $mod => $contents) {
		if(empty($contents)) {
			continue;
		}
		if(is_array($contents)) {
			foreach($contents as $content) {
				if(!isset($sections[$content['rawname']])) {
					$sections[$content['rawname']] = array(
						"title" => $content['title'],
						"rawname" => $content['rawname'],
						"content" => $content['content']
					);
				} else {
					$sections[$content['rawname']]['content'] .= $content['content'];
				}
			}
		} else {
			if(!isset($sections[$mod])) {
				$sections[$mod] = array(
					"title" => ucfirst(strtolower($mod)),
					"rawname" => $mod,
					"content" => $contents
				);
			} else {
				$sections[$mod]['content'] .= $contents;
			}
		}
	}
	$hookcontent = '';
	foreach ($sections as $data) {
		$hookcontent .= '<div class="section-title" data-for="paginghook'.$data['rawname'].'"><h3><i class="fa fa-minus"></i> '.$data['title'].'</h3></div>';
		$hookcontent .= '<div class="section" data-id="paginghook'.$data['rawname'].'">';
		$hookcontent .=	 $data['content'];
		$hookcontent .= '</div>';
	}
	return array("hookContent" => $hookcontent, "oldHooks" => $module_hook->hookHtml);
	}
	public function getRightNav($request) {
	  if(isset($request['view']) && $request['view'] == 'form'){
	    return load_view(__DIR__."/views/bootnav.php",array());
	  }
	}
	public function search($query, &$results) {
		foreach($this->listGroups() as $g){
			$results[] = array("text" => sprintf(_("Page Group: %s (%s)"),$g['description'],$g['page_group']), "type" => "get", "dest" => "?display=paging&view=form&extdisplay=".$g['page_group']);
		}
	}
	//Removes an extension from all page groups.
	public function removeMemberAllGroups($exten){
		$sql = 'DELETE from paging_groups WHERE ext = :exten';
		$stmt = $this->db->prepare($sql);
		return $stmt->execute(array(':exten'=> $exten));
	}

	//Core hook called when user/extension is deleted
	public function delUser($extension, $editmode=false) {
		if(!$editmode) {
			$this->removeMemberAllGroups($extension);
		}
	}
	public function setAutoanswerDefaults($data) {
		$put = array();
		if (!is_array($data)) {
			return false;
		}
		foreach ($data as $k => $v) {
			if(empty($k) || empty($v)){
				continue;
			}
			$put[] = array('default', $k, $v);
		}
		if(!empty($put)){
			$sql = "REPLACE INTO paging_autoanswer (useragent, var, setting) VALUES (?, ?, ?)";
			$stmt = $this->db->prepare($sql);
			$error = false;
			$baditems = array();
			foreach ($put as $item) {
				if(!$stmt->execute($item)){
					$error = true;
					$baditems[] = $item;
				}
			}
			if($error === false){
				return true;
			}else{
				dbug($baditems);
				return false;
			}
		}
		return false;
	}
}
