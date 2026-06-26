<?php
// vim: set ai ts=4 sw=4 ft=php:
namespace FreePBX\modules;
/*
* Class stub for BMO Module class
* In getActionbar change "modulename" to the display value for the page
* In getActionbar change extdisplay to align with whatever variable you use to decide if the page is in edit mode.
*
*/

class Returnontransfer extends \FreePBX_Helpers implements \BMO
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
		if(!$this->getConfig('timeout')) {
			$this->setConfig('timeout','15');
			$this->setConfig('prefix','RT: ${xfer_exten} ${CALLERID(name)}');
			$this->setConfig('alertinfo','');
			$this->setConfig('enabled',true);
		}
		if($this->getConfig('enabled')) {
			$this->FreePBX->Config->update('TRANSFER_CONTEXT','blindxfer_ringback');
		}
	}
	public function uninstall()
	{
		$this->FreePBX->Config->reset_conf_settings(array('TRANSFER_CONTEXT'),true);
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
		//Handle form submissions
		switch ($_REQUEST['action']) {
			case 'save':
			foreach (['timeout','prefix','alertinfo'] as $keyword) {
				$this->setConfig($keyword,$_REQUEST[$keyword]);
			}
			$sql = array();
			if ($_REQUEST['enabled']==1) {
				$this->setConfig('enabled',true);
				$this->FreePBX->Config->update('TRANSFER_CONTEXT','blindxfer_ringback');
			} else {
				$this->setConfig('enabled',false);
				$this->FreePBX->Config->reset_conf_settings(array('TRANSFER_CONTEXT'),true);
			}
			needreload();
			break;
		}
	}

	// We want to do dialplan stuff.
	public static function myDialplanHooks()
	{
		return 900; //at the very last instance
	}

	public function doDialplanHook(&$ext, $engine, $priority)
	{
		$settings = $this->getAll();
		$timeout = !empty($settings['timeout']) ? $settings['timeout'] : 15;
		$prefix = !empty($settings['prefix']) ? $settings['prefix'] : 'RT: ${xfer_exten} ${CALLERID(name)}';
		$alertinfo = $settings['alertinfo'];

		if ($settings['enabled']) {
			$context = 'blindxfer_ringback';
			$e = '_X.';
			$ext->add($context,$e,'',new \ext_noop('${BLINDTRANSFER}'));
			$ext->add($context,$e,'',new \ext_set('blind','${CUT(BLINDTRANSFER,-,1)}'));
			$ext->add($context,$e,'',new \ext_set('blind_exten','${CUT(blind,/,2)}'));
			$ext->add($context,$e,'',new \ext_noop('${blind_exten}'));
			$ext->add($context,$e,'',new \ext_set('timeoutd',$timeout)); // Set timeout
			$ext->add($context,$e,'',new \ext_set('CHANNEL(language)', '${MASTER_CHANNEL(CHANNEL(language))}'));
			$ext->add($context,$e,'',new \ext_set('xfer_exten','${EXTEN}'));
			$ext->add($context,$e,'',new \ext_noop('${xfer_exten}'));
			$ext->add($context,$e,'',new \ext_execif('$["${DB(AMPUSER/${CALLERID(num)}/cidnum)}" == ""]', 'Set','blind_cid=${CALLERID(num)}','Set','blind_cid=${DB(AMPUSER/${CALLERID(num)}/cidnum)}'));
			$ext->add($context,$e,'',new \ext_noop('${blind_cid}'));
			$ext->add($context,$e,'',new \ext_execif('$["${DB(AMPUSER/${CALLERID(num)}/cidnum)}" == "" && "${DB(AMPUSER/${DEXTEN}/cidnum)}" != "" && "${DB(AMPUSER/${xfer_exten}/cidnum)}" == "" && "${DB(QPENALTY/${xfer_exten}/dynmemberonly)}" == ""]', 'Set','__REALCALLERIDNUM=${DEXTEN}', 'Set','__REALCALLERIDNUM=${blind_cid}'));
			$ext->add($context,$e,'',new \ext_noop('${REALCALLERIDNUM}'));
			$ext->add($context,$e,'',new \ext_agi('returnontransfer_setContext.php,${xfer_exten},${CALLERID(num)},${blind_exten}'));
			$ext->add($context,$e,'',new \ext_noop('${xfer_context}'));
			$ext->add($context,$e,'',new \ext_dial('local/${EXTEN}@${xfer_context}','${timeoutd}'));
			$ext->add($context,$e,'',new \ext_noop('${BLINDTRANSFER}'));
			$ext->add($context,$e,'',new \ext_set('foo','${CUT(BLINDTRANSFER,-,1)}'));
			$ext->add($context,$e,'',new \ext_set('cb_exten','${CUT(foo,/,2)}'));
			$ext->add($context,$e,'',new \ext_noop('${cb_exten}'));
			$ext->add($context,$e,'',new \ext_gotoif('$["${DIALSTATUS}" = "ANSWER"]','hangup:callback'));
			$ext->add($context,$e,'callback',new \ext_set('CALLERID(name)',$prefix)); # Set prefix to indicate it is a ringback
			if (isset($alertinfo) && !empty($alertinfo) && $alertinfo != "") {
				$ext->add($context,$e,'',new \ext_setvar('__ALERT_INFO', $alertinfo));
			}
			$ext->add($context,$e,'',new \ext_agi('returnontransfer_setContext.php,${cb_exten},${CALLERID(num)}'));
			$ext->add($context,$e,'',new \ext_execif('$["${REALCALLERIDNUM}" != ${CALLERID(num)}]', 'Set','__REALCALLERIDNUM=${CALLERID(num)}'));
			$ext->add($context,$e,'',new \ext_noop('${xfer_context}'));
			$ext->add($context,$e,'',new \ext_dial('local/${cb_exten}@${xfer_context},'));
			$ext->add($context,$e,'hangup',new \ext_hangup(''));
			$ext->add($context,'h','',new \ext_hangup(''));
		}

	}

	// http://wiki.freepbx.org/pages/viewpage.action?pageId=29753755
	public function getActionBar($request)
	{
		$buttons = array();
		switch ($request['display']) {
			case 'returnontransfer':
			$buttons = array(
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

	public function showPage()
	{
		$settings = $this->getAll();
		$subhead = _('Return on Blind Transfer Options');
		$content = load_view(__DIR__.'/views/form.php', array('settings' => $settings));
		show_view(__DIR__.'/views/default.php', array('subhead' => $subhead, 'content' => $content));
	}
}
