<?php

namespace FreePBX\modules;
/*
* Class stub for BMO Module class
* In getActionbar change "modulename" to the display value for the page
* In getActionbar change extdisplay to align with whatever variable you use to decide if the page is in edit mode.
*
*/

class Recallonbusy extends \FreePBX_Helpers implements \BMO
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
		if(!$this->getConfig('default')) {
			$this->setConfig('default','disabled');
		}
		if(!$this->getConfig('digit')) {
			$this->setConfig('digit',5);
		}
	}
	public function uninstall()
	{
		$this->delConfig('default');
	}

	public function showPage()
	{
		$settings = array();
		$settings['default'] = $this->getConfig('default');
		$settings['digit'] = !empty($this->getConfig('digit')) ? $this->getConfig('digit') : 5;
		$head = _('Recall On Busy options');
		$subhead = _('Configure global options for Recall on Busy');
		$content = load_view(__DIR__.'/views/form.php', array('settings' => $settings));
		show_view(__DIR__.'/views/default.php', array('subhead' => $subhead, 'head' => $head, 'content' => $content));
	}

	public function getActionBar($request)
	{
		$buttons = array();
                if ($request['display'] === 'recallonbusy') {
			$buttons = array(
				'submit' => array(
					'name' => 'submit',
					'id' => 'submit',
					'value' => _('Submit')
				),
				'reset' => array(
					'name' => 'reset',
					'id' => 'reset',
					'value' => _('Reset')
				)
			);
		}
		return $buttons;
	}


	// The following two stubs are planned for implementation in FreePBX 15.
	public function backup()
	{
	}
	public function restore($backup)
	{
	}

	public static function myConfigPageInits() {
		return array("extensions");
	}

	public static function myGuiHooks() {
		//return array("INTERCEPT" => "modules/core/page.extensions.php");
		return array("core");
	}

	public function doGuiHook(&$currentcomponent) {
		global $astman;
		if ($_REQUEST['display'] == "extensions" && !empty($_REQUEST['extdisplay'])) {
			$enabled = $astman->database_get("ROBconfig",$_REQUEST['extdisplay']);
			$enabled = !empty($enabled) ? $enabled : $this->getConfig('default');
			$section = _("Extension Options");
			$category = "advanced";
			$currentcomponent->addoptlistitem('recallonbusy', 'enabled', _("Enable"));
	                $currentcomponent->addoptlistitem('recallonbusy', 'disabled', _("Disable"));
        	        $currentcomponent->setoptlistopts('recallonbusy', 'sort', false);
			$currentcomponent->addguielem($section, new \gui_radio('recallonbusy', $currentcomponent->getoptlist('recallonbusy'), $enabled, _("Recall On Busy"), _("Enable Recall On Busy when this extension calls a busy one"), false,'','',false),$category);
		}
	}

	public function doConfigPageInit($display) {
		global $astman;
		if ($display == "extensions" && !empty($_REQUEST['recallonbusy'])) {
			// Save Recall On Busy option for the extension
			$astman->database_put("ROBconfig",$_REQUEST['extdisplay'],$_REQUEST['recallonbusy']);
		} elseif ($display == "recallonbusy") {
			if (!empty($_REQUEST['default'])) {
				$this->setConfig('default',$_REQUEST['default']);
			}
			if (!empty($_REQUEST['digit'])) {
				$this->setConfig('digit',$_REQUEST['digit']);
			}
		}
	}

	// We want to do dialplan stuff.
	public static function myDialplanHooks()
	{
		return True;
	}

	public function doDialplanHook(&$ext, $engine, $priority)
	{
		include_once '/var/www/html/freepbx/rest/lib/libExtensions.php';
		foreach (\FreePBX::Core()->getAllUsers() as $extension => $data) {
		#	if (!isMainExtension($extension)) {
		#		continue;
		#	}
			$ext->splice('ext-local', $extension, 'dest', new \ext_gosubif('$["${DIALSTATUS}"="BUSY" && "${DB(AMPUSER/${AMPUSER}/cidnum)}" != "" && "${DB(DND/${EXTEN})}" != "YES"]','recall-on-busy,s,1'),'',1);
		}
		if ($this->getConfig('default') == 'enabled') {
			$ifstring = '$["${DB(AMPUSER/${AMPUSER}/cidnum)}" != "" & ("${DIALSTATUS}"="BUSY" | "${DIALSTATUS}"="CHANUNAVAIL") & ("${DB(ROBconfig/${AMPUSER})}"="enabled" | "${DB(ROBconfig/${AMPUSER})}"="" ) & "${DB(DND/${EXTTOCALL})}" != "YES"]';
		} else {
			$ifstring = '$["${DB(AMPUSER/${AMPUSER}/cidnum)}" != "" & ("${DIALSTATUS}"="BUSY" | "${DIALSTATUS}"="CHANUNAVAIL") & "${DB(ROBconfig/${AMPUSER})}"="enabled" & "${DB(DND/${EXTTOCALL})}" != "YES"]';
		}
		$ext->splice('macro-exten-vm', 's', 20, new \ext_execif($ifstring,'MacroExit'));
		$context = 'recall-on-busy';
		$ext->add($context, 's', '', new \ext_agi('recallonbusy_set.php,${EXTTOCALL}'));
		$ext->add($context, 's', '', new \ext_return());
		$ext->addInclude('ext-local',$context);
	}
}


