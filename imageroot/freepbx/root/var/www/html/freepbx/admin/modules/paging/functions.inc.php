<?php
// vim: set ai ts=4 sw=4 ft=php:
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2013 Schmooze Com Inc.
//

/* paging_init - Is run every time the page is loaded, checks
   to make sure that the database is current and loaded, if not,
   it propogates it. I expect that extra code will go here to
   check for version upgrades, etc, of the paging database, to
   allow for easy upgrades.
 */

//	Generates dialplan for paging  - is called from retrieve_conf

function paging600_get_config($engine) {
	global $ext, $db;

	//context 'inject' a file in to a conference
	$c = 'paging-chanspy';
	$ext->add($c, 's', '', new ext_answer());
	$ext->add($c, 's', '', new ext_wait(1));
	$ext->add($c, 's', '', new ext_playback('beep&extension'));
	$ext->add($c, 's', '', new ext_sayalpha('${AMPUSER}'));
	$ext->add($c, 's', '', new ext_playback('calling'));
	$ext->add($c, 's', '', new ext_saydigits('${DIALED}'));
	$ext->add($c, 's', '',
		new ext_execif('$["${DEVICE_STATE(${ORIG_CHANNEL})}" = "NOT_INUSE"]',
		'Playback', 'sorry&this&channel&has-expired'));
	$ext->add($c, 's', '',
		new ext_execif('$["${DEVICE_STATE(${ORIG_CHANNEL})}" = "NOT_INUSE"]',
		'Busy', 5));
	$ext->add($c, 's', '',
		new ext_execif('$["${DEVICE_STATE(${ORIG_CHANNEL})}" = "NOT_INUSE"]',
		'Hangup'));
	$ext->add($c, 's', '', new ext_chanspy('${ORIG_CHANNEL}', 'qEB'));
	$ext->add($c, 's', '', new ext_hangup());

	//We are moving the Outbound Route-Notifications feature from the pro version
	//to the free version. If pagingpro_core_routing still exists, the pagingpro module 
	//has not been updated yet, so let it continue handling this feature.  
	$pagingproInfo = \FreePBX::Modules()->getInfo("pagingpro");
	$pagingproStatus = empty($pagingproInfo['pagingpro']['status']) ? 0 : $pagingproInfo['pagingpro']['status']; //0 default, 2 enabled
	$sql        = "SELECT COLUMN_NAME FROM information_schema.columns WHERE table_name = 'pagingpro_core_routing'";
	$results    = $db->getAll($sql, DB_FETCHMODE_ASSOC);
	if (empty($results) || $pagingproStatus != 2) {
		//hook in to outbound routes dialplan
		$outbound_routes = core_routing_list();
		foreach ($outbound_routes as $r) {
			$page_group = paging_core_routing_get($r['route_id']);
			if (!$page_group) {
				continue;
			}
			$c = 'outrt-' . $r['route_id'];
			$patterens = core_routing_getroutepatternsbyid($r['route_id']);

			foreach($patterens as $p) {
				$fpattern = core_routing_formatpattern($p);
				$e = $fpattern['dial_pattern'];

				$ext->splice($c, $e, 2, new ext_set('PAGEGROUP', $page_group));
				$ext->splice($c, $e, 3,
					new ext_agi('paging_call_spooler.agi,'
						. 'calltype=outbound_notify'));
			}
		}
	}
}

function paging_get_config($engine) {
	global $db, $ext, $chan_dahdi, $version, $amp_conf, $conferences_conf, $astman;
	switch($engine) {
	case "asterisk":

		// setup for intercom
		$fcc = new featurecode('paging', 'intercom-prefix');
		$intercom_code = $fcc->getCodeActive();
		unset($fcc);

		// Since these are going down channel local, set ALERT_INFO and SIPADDHEADER which will be set in dialparties.agi
		// no point in even setting the headers here they will get lost in channel local
		//

		/* Set these up once here and in intercom so that autoanswer macro does not have
		 * to go through this for every single extension which causes a lot of extra overhead
		 * with big page groups
		 */

		$has_answermacro = false;

		$alertinfo = 'Ring Answer';
		$callinfo  = '<uri>\;answer-after=0';
		$sipuri    = 'intercom=true';
		$doptions = 'A(beep)b(autoanswer^s^1(${ALERTINFO},${CALLINFO}))';
		$vxml_url = '';
		$dtime = '5';
		$custom_vars = array();
		$autoanswer_arr = paging_get_autoanswer_defaults();

		foreach ($autoanswer_arr as $autosetting) {
			switch (trim($autosetting['var'])) {
			case 'ALERTINFO':
				$alertinfo = trim($autosetting['setting']);
				break;
			case 'CALLINFO':
				$callinfo = trim($autosetting['setting']);
				break;
			case 'SIPURI':
				$sipuri = trim($autosetting['setting']);
				break;
			case 'VXML_URL':
				$vxml_url = trim($autosetting['setting']);
				break;
			case 'DOPTIONS':
				$doptions = trim($autosetting['setting']);
				break;
			case 'DTIME':
				$dtime = trim($autosetting['setting']);
				break;
			default:
				$key = trim($autosetting['var']);
				$custom_vars[$key] = trim($autosetting['setting']);
				if (ltrim($custom_vars[$key],'_') == "ANSWERMACRO") {
					$has_answermacro = true;
				}
				break;
			}
		}

		$context = 'originate-aa';
		$ext->add($context, '_.X', '', new ext_macro('blkvm-set'));
		$ext->add($context, '_.X', '', new ext_gosub('1','ssetup','app-paging'));
		$ext->add($context,'_.X', '', new ext_macro('autoanswer','${EXTEN}'));
		$ext->add($context,'_.X', '', new ext_gosub('1','s','autoanswer','${ALERTINFO},${CALLINFO}'));
		$ext->add($context,'_.X', '', new ext_goto('1', '${EXTEN}', 'from-internal'));

		$apppaging = 'app-paging';
		if (!empty($intercom_code)) {
			$code = '_'.$intercom_code.'.';
			$context = 'ext-intercom';
			// Add for languages
			$ext->add($context, 'lang-playback', '', new ext_gosubif('$[${DIALPLAN_EXISTS('.$context.',${CHANNEL(language)})}]', $context.',${CHANNEL(language)},${ARG1}', $context.',en,${ARG1}'));
			$ext->add($context, 'lang-playback', '', new ext_return());

			$ext->add($context, $code, '', new ext_macro('user-callerid'));
			$ext->add($context, $code, '', new ext_setvar('dialnumber', '${EXTEN:'.strlen($intercom_code).'}'));
			$ext->add($context, $code, '', new ext_setvar('INTERCOM_CALL', 'TRUE'));
			$ext->add($context, $code, '', new ext_gosub('1','s','sub-record-check','exten,${dialnumber}'));
			$ext->add($context, $code, '', new ext_gotoif('$["${DB(AMPUSER/${AMPUSER}/intercom/block)}" = "blocked"]', 'end'));
			$ext->add($context, $code, '', new ext_gotoif('$["${DB(DND/${dialnumber})}" = "YES"]', 'end'));
			$ext->add($context, $code, '', new ext_gotoif('$["${DB(AMPUSER/${dialnumber}/intercom/${AMPUSER})}" = "allow" ]', 'allow'));
			$ext->add($context, $code, '', new ext_gotoif('$["${DB(AMPUSER/${dialnumber}/intercom/${AMPUSER})}" = "deny" ]', 'nointercom'));
			$ext->add($context, $code, '', new ext_gotoif('$["${DB(AMPUSER/${dialnumber}/intercom)}" = "disabled" ]', 'nointercom'));
			$ext->add($context, $code, 'allow', new ext_dbget('DEVICES','AMPUSER/${dialnumber}/device'));
			$ext->add($context, $code, '', new ext_gotoif('$["${DEVICES}" = "" ]', 'end'));
			$ext->add($context, $code, '', new ext_dbget('OVERRIDE','AMPUSER/${dialnumber}/intercom/override'));
			$ext->add($context, $code, '', new ext_setvar('LOOPCNT', '${FIELDQTY(DEVICES,&)}'));

			/* Set these up so that macro-autoanswer doesn't have to
			 */
			$ext->add($context, $code, '', new ext_setvar('_SIPURI', ''));
			if (trim($alertinfo) != "") {
				$ext->add($context, $code, '', new ext_setvar('_ALERTINFO', $alertinfo));
			}
			if (trim($callinfo) != "") {
				$ext->add($context, $code, '', new ext_setvar('_CALLINFO', $callinfo));
			}
			if (trim($sipuri) != "") {
				$ext->add($context, $code, '', new ext_setvar('_SIPURI', $sipuri));
			}
			if (trim($vxml_url) != "") {
				$ext->add($context, $code, '', new ext_setvar('_VXML_URL', $vxml_url));
			}
			foreach ($custom_vars as $key => $value) {
				$ext->add($context, $code, '', new ext_setvar('_'.ltrim($key,'_'), $value));
			}
			$ext->add($context, $code, '', new ext_setvar('_DTIME', $dtime));
			$ext->add($context, $code, '', new ext_setvar('_ANSWERMACRO', ''));

			$ext->add($context, $code, '', new ext_gotoif('$[${LOOPCNT} > 1 ]', 'pagemode'));
			$ext->add($context, $code, '', new ext_macro('autoanswer','${DEVICES}'));
			$ext->add($context, $code, '', new ext_setvar('_DOPTIONS', $doptions));

			$ext->add($context, $code, 'check', new ext_chanisavail('${DEVICE}', 's'));

			// If it's ringing for an inbound call, we should page.
			$ext->add($context, $code, '', new ext_execif('$["${AVAILSTATUS}" = "6"]', 'Set', 'AVAILORIGCHAN=${DEVICE}'));

			// Did we have a device we can page? If so, go to continue. If not, check for
			// paging override functions.
			$ext->add($context, $code, '', new ext_gotoif('$["${AVAILORIGCHAN}" != ""]', 'continue'));

			// Check the intercom override.
			$ext->add($context, $code, '', new ext_execif('$["${OVERRIDE}" = ""]', 'Set', 'OVERRIDE=reject'));
			$ext->add($context, $code, '', new ext_gotoif('$["${OVERRIDE}" = "reject"]', 'end'));

			// We don't know what the phones are going to do. Let's be generous.
			$ext->add($context, $code, '', new ext_set('DTIME', '30'));

			// If it's ring, treat it as a normal call.
			$ext->add($context, $code, '', new ext_execif('$["${OVERRIDE}" = "ring"]', 'Set', 'DOPTIONS=A(beep)'));

			// It's something else. Assume it's force, and just smash the device.
			$ext->add($context, $code, 'continue', new ext_noop('Continuing with page',5));

			$len = strlen($code)-2;
			$dopt = 'I'; // Don't sent connectedline updates.
			$ext->add($context, $code, '', new ext_gotoif('$["${DB(AMPUSER/${EXTEN:' . $len . '}/cidname)}" = ""]','godial'));
			$ext->add($context, $code, '', new ext_set('CONNECTEDLINE(name,i)', '${DB(AMPUSER/${EXTEN:' . $len . '}/cidname)}'));
			$ext->add($context, $code, '', new ext_set('CONNECTEDLINE(num)', '${EXTEN:' . $len . '}'));

			$ext->add($context, $code, 'godial', new ext_dial('${DIAL}','${DTIME},' . $dopt . '${DOPTIONS}${INTERCOM_EXT_DOPTIONS}'));

			$ext->add($context, $code, 'end', new ext_execif('$[${INTERCOM_RETURN}]', 'Return'));
			$ext->add($context, $code, '', new ext_busy());
			$ext->add($context, $code, '', new ext_macro('hangupcall'));
			$ext->add($context, $code, 'pagemode', new ext_setvar('ITER', '1'));
			$ext->add($context, $code, '', new ext_setvar('DIALSTR', ''));
			$ds = $amp_conf['ASTCONFAPP'] == 'app_confbridge' ? '${DIALSTR}-${CUT(DEVICES,&,${ITER})}'
				: '${DIALSTR}&LOCAL/PAGE${CUT(DEVICES,&,${ITER})}@'.$apppaging;
			$ext->add($context, $code, 'begin', new ext_chanisavail('${DB(DEVICE/${CUT(DEVICES,&,${ITER})}/dial)}','s'));
			$ext->add($context, $code, '', new ext_gotoif('$["${AVAILORIGCHAN}" = ""]', 'skip'));
			$ext->add($context, $code, '', new ext_setvar('DIALSTR', $ds));
			$ext->add($context, $code, 'skip', new ext_setvar('ITER', '$[${ITER} + 1]'));
			$ext->add($context, $code, '', new ext_gotoif('$[${ITER} <= ${LOOPCNT}]', 'begin'));
			$ext->add($context, $code, '', new ext_setvar('DIALSTR', '${DIALSTR:1}'));
			$ext->add($context, $code, '', new ext_gotoif('$["${DIALSTR}" = ""]', 'checkpageoption'));// if empty string then dial all devices
			$ext->add($context, $code, '', new ext_setvar('_AMPUSER', '${AMPUSER}'));
			if ($amp_conf['ASTCONFAPP'] == 'app_confbridge') {
				$ext->add($context, $code, '', new ext_gosub('1', 'page', false, '${DIALSTR}'));
			} else {
				$ext->add($context, $code, '', new ext_page('${DIALSTR},d'));
			}
			$ext->add($context, $code, 'checkpageoption', new ext_noop('Intercom option ${OVERRIDE}'));
			$ext->add($context, $code, '', new ext_gotoif('$["${OVERRIDE}" = "reject"]', 'end2'));
			$ext->add($context, $code, '', new ext_gosub('1', 'dialall', false, '${DIALSTR}'));
			$ext->add($context, $code, 'end2', new ext_execif('$[${INTERCOM_RETURN}]', 'Return'));
			$ext->add($context, $code, '', new ext_busy());
			$ext->add($context, $code, '', new ext_macro('hangupcall'));

			$ext->add($context, $code, 'nointercom', new ext_noop('Intercom disallowed by ${dialnumber}'));
			$ext->add($context, $code, '', new ext_execif('$[${INTERCOM_RETURN}]', 'Return'));
			$ext->add($context, $code, '', new ext_gosub('1', 'lang-playback', $context, 'hook_0'));
			$ext->add($context, $code, '', new ext_congestion());

			if ($amp_conf['ASTCONFAPP'] == 'app_confbridge') {
				$sub = 'page';
				$ext->add($context, $sub, '', new ext_set('PAGE_CONF', '${EPOCH}${RAND(100,999)}'));
				$ext->add($context, $sub, '', new ext_set('PAGEMODE', 'PAGE'));
				$ext->add($context, $sub, '', new ext_set('PAGE_MEMBERS', '${ARG1}'));
				$ext->add($context, $sub, '', new ext_set('PAGE_CONF_OPTS', 'duplex'));
				$ext->add($context, $sub, '', new ext_agi('page.agi'));
				$ext->add($context, $sub, '', new ext_set('CONFBRIDGE(user,template)', 'page_user_duplex'));
				$ext->add($context, $sub, '', new ext_set('CONFBRIDGE(user,admin)', 'yes'));
				$ext->add($context, $sub, '', new ext_set('CONFBRIDGE(user,marked)', 'yes'));
				$ext->add($context, $sub, '', new ext_meetme('${PAGE_CONF}',',','admin_menu'));
				$ext->add($context, $sub, '', new ext_hangup());
			}
// dial all number FREEPBX-14551 intercom Override in options
				$sub = 'dialall';
				$ext->add($context, $sub, '', new ext_gotoif('$[${LOOPCNT} > 1 ]', 'preparedialst'));
			    $ext->add($context, $sub, 'preparedialst', new ext_setvar('ITER', '1'));
				$ext->add($context, $sub, '', new ext_setvar('DIALSTR', ''));
				$ext->add($context, $sub, 'begin1', new ext_setvar('DIALSTR','${DIALSTR}&${DB(DEVICE/${CUT(DEVICES,&,${ITER})}/dial)}'));
				$ext->add($context, $sub, '', new ext_setvar('ITER', '$[${ITER} + 1]'));
				$ext->add($context, $sub, '', new ext_gotoif('$[${ITER} <= ${LOOPCNT}]', 'begin1'));
				$ext->add($context, $sub, '', new ext_setvar('DIALSTR', '${DIALSTR:1}'));
				$ext->add($context, $sub, '', new ext_noop('Dial statring  ${DIALSTR}'));
				$ext->add($context, $sub, '', new ext_gotoif('$["${OVERRIDE}" = "ring"]', 'dialnow'));
				$ext->add($context, $sub, '', new ext_setvar('_DOPTIONS', $doptions));
				$ext->add($context, $sub, 'dialnow',new ext_dial('${DIALSTR}','${DTIME},' . $dopt . '${DOPTIONS}${INTERCOM_EXT_DOPTIONS}'));
				$ext->add($context, $sub, '', new ext_hangup());

			$lang = 'en'; // English
			$ext->add($context, $lang, 'hook_0', new ext_playback('intercom&for&extension'));
			$ext->add($context, $lang, '', new ext_saydigits('${dialnumber}'));
			$ext->add($context, $lang, '', new ext_playback('is&disabled'));
			$ext->add($context, $lang, '', new ext_return());
			$lang = 'ja'; // Japanese
			$ext->add($context, $lang, 'hook_0', new ext_playback('extension'));
			$ext->add($context, $lang, '', new ext_saydigits('${dialnumber}'));
			$ext->add($context, $lang, '', new ext_playback('jp-no&intercom&jp-wa&disabled-2'));
			$ext->add($context, $lang, '', new ext_return());

			$extintercomusers = 'ext-intercom-users';
			$sql = "SELECT LENGTH(id) as len FROM devices GROUP BY len";
			$sth = \FreePBX::Database()->prepare($sql);
			$sth->execute();
			$rows = $sth->fetchAll(\PDO::FETCH_ASSOC);
			foreach($rows as $row) {
				$ext->add($extintercomusers, '_'.$intercom_code.str_repeat('X',$row['len']),'', new ext_goto($context.',${EXTEN},1'));
			}

			$context = $extintercomusers;
			// for language handling which is done on a per context basis
			$ext->add($context, 'lang-playback', '', new ext_gosubif('$[${DIALPLAN_EXISTS('.$context.',${CHANNEL(language)})}]', $context.',${CHANNEL(language)},${ARG1}', $context.',en,${ARG1}'));
			$ext->add($context, 'lang-playback', '', new ext_return());
			$ext->addInclude('from-internal-additional', $context);
		}

		$fcc = new featurecode('paging', 'intercom-on');
		$oncode = $fcc->getCodeActive();
		unset($fcc);

		if ($oncode) {
			$ext->add($context, $oncode, '', new ext_macro('user-callerid'));
			$ext->add($context, $oncode, '', new ext_set('CONNECTEDLINE(name-charset,i)','utf8'));
			$ext->add($context, $oncode, '', new ext_set('CONNECTEDLINE(name,i)',_("Intercom: Enabled")));
			$ext->add($context, $oncode, '', new ext_set('CONNECTEDLINE(num,i)','${AMPUSER}'));
			$ext->add($context, $oncode, '', new ext_answer(''));
			$ext->add($context, $oncode, '', new ext_wait('1'));
			$ext->add($context, $oncode, '', new ext_setvar('DB(AMPUSER/${AMPUSER}/intercom)', 'enabled'));
			$ext->add($context, $oncode, '', new ext_playback('intercom&enabled'));
			$ext->add($context, $oncode, '', new ext_macro('hangupcall'));

			$target = '${EXTEN:'.strlen($oncode).'}';
			$oncode = "_".$oncode.".";
			$ext->add($context, $oncode, '', new ext_macro('user-callerid'));
			$ext->add($context, $oncode, '', new ext_set('CONNECTEDLINE(name-charset,i)','utf8'));
			$ext->add($context, $oncode, '', new ext_set('CONNECTEDLINE(name,i)',sprintf(_("Intercom from %s: Enabled"),$target)));
			$ext->add($context, $oncode, '', new ext_set('CONNECTEDLINE(num,i)','${AMPUSER}'));
			$ext->add($context, $oncode, '', new ext_setvar('dialnumber', '${EVAL(${EXTEN:'.strlen(substr($oncode, 1, -1)).'})}')); // Asterisk variable for saydigits languages
			$ext->add($context, $oncode, '', new ext_answer(''));
			$ext->add($context, $oncode, '', new ext_wait('1'));
			$ext->add($context, $oncode, '', new ext_gotoif('$["${DB(AMPUSER/${AMPUSER}/intercom/'.$target.')}" = "allow" ]}','unset'));
			$ext->add($context, $oncode, '', new ext_gotoif('$[${DB_EXISTS(AMPUSER/'.$target.'/device)} != 1]','invaliduser'));
			$ext->add($context, $oncode, '', new ext_dbput('AMPUSER/${AMPUSER}/intercom/'.$target, 'allow'));
			$ext->add($context, $oncode, '', new ext_gosub('1', 'lang-playback', $context, 'hook_1'));
			$ext->add($context, $oncode, '', new ext_macro('hangupcall'));
			$ext->add($context, $oncode, 'unset', new ext_dbdeltree('AMPUSER/${AMPUSER}/intercom/'.$target));
			$ext->add($context, $oncode, '', new ext_gosub('1', 'lang-playback', $context, 'hook_2'));
			$ext->add($context, $oncode, '', new ext_macro('hangupcall'));
			$ext->add($context, $oncode, 'invaliduser', new ext_gosub('1', 'lang-playback', $context, 'hook_3'));
			$ext->add($context, $oncode, '', new ext_macro('hangupcall'));

			$lang = 'en'; // English
			$ext->add($context, $lang, 'hook_1', new ext_playback('intercom&from&extension&number'));
			$ext->add($context, $lang, '', new ext_saydigits('${dialnumber}'));
			$ext->add($context, $lang, '', new ext_playback('enabled'));
			$ext->add($context, $lang, '', new ext_return());
			$ext->add($context, $lang, 'hook_2', new ext_playback('intercom&enabled&cancelled&for&extension&number'));
			$ext->add($context, $lang, '', new ext_saydigits('${dialnumber}'));
			$ext->add($context, $lang, '', new ext_return());
			$ext->add($context, $lang, 'hook_3', new ext_playback('extension&number'));
			$ext->add($context, $lang, '', new ext_saydigits('${dialnumber}'));
			$ext->add($context, $lang, '', new ext_playback('invalid'));
			$ext->add($context, $lang, '', new ext_return());
			$lang = 'ja'; // Japanese
			$ext->add($context, $lang, 'hook_1', new ext_playback('extension'));
			$ext->add($context, $lang, '', new ext_saydigits('${dialnumber}'));
			$ext->add($context, $lang, '', new ext_playback('jp-kara&jp-no&intercom&jp-wo&allow'));
			$ext->add($context, $lang, '', new ext_return());
			$ext->add($context, $lang, 'hook_2', new ext_playback('extension'));
			$ext->add($context, $lang, '', new ext_saydigits('${dialnumber}'));
			$ext->add($context, $lang, '', new ext_playback('jp-kara&jp-no&intercom&setting&jp-wo&cancelled'));
			$ext->add($context, $lang, '', new ext_return());
			$ext->add($context, $lang, 'hook_3', new ext_playback('extension'));
			$ext->add($context, $lang, '', new ext_saydigits('${dialnumber}'));
			$ext->add($context, $lang, '', new ext_playback('invalid'));
			$ext->add($context, $lang, '', new ext_return());
		}

		$fcc = new featurecode('paging', 'intercom-off');
		$offcode = $fcc->getCodeActive();
		unset($fcc);

		if ($offcode) {
			$ext->add($context, $offcode, '', new ext_macro('user-callerid'));
			$ext->add($context, $offcode, '', new ext_set('CONNECTEDLINE(name-charset,i)','utf8'));
			$ext->add($context, $offcode, '', new ext_set('CONNECTEDLINE(name,i)',_("Intercom: Disabled")));
			$ext->add($context, $offcode, '', new ext_set('CONNECTEDLINE(num,i)','${AMPUSER}'));
			$ext->add($context, $offcode, '', new ext_answer(''));
			$ext->add($context, $offcode, '', new ext_wait('1'));
			$ext->add($context, $offcode, '', new ext_setvar('DB(AMPUSER/${AMPUSER}/intercom)', 'disabled'));
			$ext->add($context, $offcode, '', new ext_playback('intercom&disabled'));
			$ext->add($context, $offcode, '', new ext_macro('hangupcall'));

			$target = '${EXTEN:'.strlen($offcode).'}';
			$offcode = "_".$offcode.".";
			$ext->add($context, $offcode, '', new ext_macro('user-callerid'));
			$ext->add($context, $offcode, '', new ext_set('CONNECTEDLINE(name-charset,i)','utf8'));
			$ext->add($context, $offcode, '', new ext_set('CONNECTEDLINE(name,i)',sprintf(_("Intercom from %s: Disabled"),$target)));
			$ext->add($context, $offcode, '', new ext_set('CONNECTEDLINE(num,i)','${AMPUSER}'));
			$ext->add($context, $offcode, '', new ext_setvar('dialnumber', '${EVAL(${EXTEN:'.strlen(substr($offcode, 1, -1)).'})}')); // Asterisk variable for saydigits languages
			$ext->add($context, $offcode, '', new ext_answer(''));
			$ext->add($context, $offcode, '', new ext_wait('1'));
			$ext->add($context, $offcode, '', new ext_gotoif('$["${DB(AMPUSER/${AMPUSER}/intercom/'.$target.')}" = "deny" ]}','unset2'));
			$ext->add($context, $offcode, '', new ext_gotoif('$[${DB_EXISTS(AMPUSER/'.$target.'/device)} != 1]','invaliduser2'));
			$ext->add($context, $offcode, '', new ext_dbput('AMPUSER/${AMPUSER}/intercom/'.$target, 'deny'));
			$ext->add($context, $offcode, '', new ext_gosub('1', 'lang-playback', $context, 'hook_4'));
			$ext->add($context, $offcode, '', new ext_macro('hangupcall'));
			$ext->add($context, $offcode, 'unset2', new ext_dbdeltree('AMPUSER/${AMPUSER}/intercom/'.$target));
			$ext->add($context, $offcode, '', new ext_gosub('1', 'lang-playback', $context, 'hook_5'));
			$ext->add($context, $offcode, '', new ext_macro('hangupcall'));
			$ext->add($context, $offcode, 'invaliduser2', new ext_gosub('1', 'lang-playback', $context, 'hook_6'));
			$ext->add($context, $offcode, '', new ext_macro('hangupcall'));

			$lang = 'en';
			$ext->add($context, $lang, 'hook_4', new ext_playback('intercom&from&extension&number'));
			$ext->add($context, $lang, '', new ext_saydigits('${dialnumber}'));
			$ext->add($context, $lang, '', new ext_playback('disabled'));
			$ext->add($context, $lang, '', new ext_return());
			$ext->add($context, $lang, 'hook_5', new ext_playback('intercom&disabled&cancelled&for&extension&number'));
			$ext->add($context, $lang, '', new ext_saydigits('${dialnumber}'));
			$ext->add($context, $lang, '', new ext_return());
			$ext->add($context, $lang, 'hook_6', new ext_playback('extension&number'));
			$ext->add($context, $lang, '', new ext_saydigits('${dialnumber}'));
			$ext->add($context, $lang, '', new ext_playback('invalid'));
			$ext->add($context, $lang, '', new ext_return());
			$lang = 'ja';
			$ext->add($context, $lang, 'hook_4', new ext_playback('extension'));
			$ext->add($context, $lang, '', new ext_saydigits('${dialnumber}'));
			$ext->add($context, $lang, '', new ext_playback('jp-kara&jp-no&intercom&jp-wo&deny'));
			$ext->add($context, $lang, '', new ext_return());
			$ext->add($context, $lang, 'hook_5', new ext_playback('extension'));
			$ext->add($context, $lang, '', new ext_saydigits('${dialnumber}'));
			$ext->add($context, $lang, '', new ext_playback('jp-kara&jp-no&intercom&setting&jp-wo&cancelled'));
			$ext->add($context, $lang, '', new ext_return());
			$ext->add($context, $lang, 'hook_6', new ext_playback('extension'));
			$ext->add($context, $lang, '', new ext_saydigits('${dialnumber}'));
			$ext->add($context, $lang, '', new ext_playback('invalid'));
			$ext->add($context, $lang, '', new ext_return());
		}

			/* Create macro-autoanswer that will try to intelligently set the
			required parameters to handle paging. Eventually it will use
				known device information.

				This macro does the following:

				Input:  FreePBX Device number to be called requiring autoanswer
				Output: ${DIAL} Channel Variable with the dial string to be called
						Appropriate SIP headers added
								Other special requirements that may be custom for this device

				1. Set ${DIAL} to the device's dial string
				2. If there is a device specific macro defined in the DEVICE's object
				   (DEVICE/<devicenum>/autoanswer/macro) then execute that macro and end
				3. Try to identify endpoints by their useragents that may need known
				   changes and make those changes. These are generated from the
					 paging_autoanswer table so users can extend them, if any are present
				5. Set the variables and end unless a useragent specific ANSWERMACRO is
				   defined in which case call it and end.

				This macro is called for intercoming and paging to try and enable the
				target device to auto-answer. Devices with special needs can be handled
				with the device specific macro. For example, if you have a device that
				can not auto-answer except by specifically configuring a line key on
				the device that always answers, you could use a device specific macro
				to change the dialstring. If you had a set of such devices, you could
				standardize on the device numbers (e.g. nnnn for normal calls and 2nnnn
				for auto-answer calls). You could then create a general purpose macro
				to modify the dial string accordingly. Provisioning tools will be able
				to take advantage of setting and creating such an ability.
				If you have a set of devices that can be identified with a SIP useragent
				then you can use a general macro without setting info in each device.
			 */

		$autoanswer_arr = paging_get_autoanswer_useragents();

		$macro = 'macro-autoanswer';
		// Do we already know what the correct string is? This may have been handed to us
		// by page.agi.
		$ext->add($macro, "s", '', new ext_gotoif('$["${KNOWNDIAL}" != ""]', 'knowndial'));

		// Do we have a PJSIP Endpoint?
		$ext->add($macro, "s", '', new ext_setvar('DEVICE', '${DB(DEVICE/${ARG1}/dial)}'));
		$ext->add($macro, "s", '', new ext_gotoif('$["${DEVICE:0:5}" == "PJSIP" ]', 'dopjsip'));

		// We're not pjsip, so our dial is going to be our device
		$ext->add($macro, "s", '', new ext_setvar('KNOWNDIAL', '${DEVICE}'));
		$ext->add($macro, "s", '', new ext_goto('knowndial'));

		// Handle PJSIP stuff.
		$ext->add($macro, "s", 'dopjsip', new ext_setvar('KNOWNDIAL', '${PJSIP_DIAL_CONTACTS(${ARG1})}'));
		// If there's an ampersand, there's more than one device registered to this endpoint, and we
		// need to page, rather than intercom.
		$ext->add($macro, "s", '', new ext_gotoif('$[${REGEX("&" ${KNOWNDIAL})} == 0]', 'knowndial'));
		// Bugger. However, we can hard-code some settings here that'll make our life a bit easier.
		$ext->add($macro, "s", '', new ext_gosub('1','ssetup', 'app-paging'));
		$ext->add($macro, "s", '', new ext_setvar('PAGEMODE', 'PAGE'));
		$ext->add($macro, "s", '', new ext_setvar('PAGE_CONF_OPTS', 'duplex'));
		$ext->add($macro, "s", '', new ext_setvar('STREAM', 'NONE'));
		$ext->add($macro, "s", '', new ext_setvar('PAGE_MEMBERS', '${ARG1}'));
		// Start the AGI to get the clients into the conf
		$ext->add($macro, "s", '', new ext_agi('page.agi'));
		// Now I need to join the conf as admin.
		$ext->add($macro, "s", '', new ext_set('CONFBRIDGE(user,template)', 'page_user_duplex'));
		$ext->add($macro, "s", '', new ext_set('CONFBRIDGE(user,admin)', 'yes'));
		$ext->add($macro, "s", '', new ext_set('CONFBRIDGE(user,marked)', 'yes'));
		$ext->add($macro, "s", '', new ext_meetme('${PAGE_CONF}',',','admin_menu')); // ext_confbridge, actually.
		$ext->add($macro, "s", '', new ext_hangup()); // Don't even try to continue after this.

		// Right. Bypassing all that, it's a single device, and, we know what our dial string is.
		$ext->add($macro, "s", 'knowndial', new ext_setvar('DIAL', '${KNOWNDIAL}'));

		// If we are in DAHDI compat mode, then we need to substitute DAHDI for ZAP
		if ($chan_dahdi) {
			$ext->add($macro, "s", '', new ext_execif('$["${DIAL:0:3}" = "ZAP"]', 'Set','DIAL=DAHDI${DIAL:3}'));
		}
		$ext->add($macro, "s", '', new ext_gotoif('$["${DB(DEVICE/${ARG1}/autoanswer/macro)}" != "" ]', 'macro'));

		// If there are no phone specific auto-answer vars, then we don't care what the phone is below
		//
		if (!empty($autoanswer_arr)) {
			global $version;
			$ext->add($macro, "s", '', new ext_gotoif('$["${DIAL:0:5}" = "PJSIP"]', 'pjsipua'));
			//http://issues.freepbx.org/browse/FREEPBX-7715
			if(version_compare($version,"12","<")) {
				$ext->add($macro, "s", '', new ext_setvar('USERAGENT', '${SIPPEER(${CUT(DIAL,/,2)}:useragent)}'));
			} else {
				$ext->add($macro, "s", '', new ext_setvar('USERAGENT', '${SIPPEER(${CUT(DIAL,/,2)},useragent)}'));
			}
			$ext->add($macro, "s", '', new ext_goto('uafin'));
			$ext->add($macro, "s", 'pjsipua', new ext_setvar('AOR','${CUT(DIAL,/,2)}'));
			$ext->add($macro, "s", '', new ext_setvar('CONTACT','${PJSIP_AOR(${AOR},contact)}'));
			$ext->add($macro, "s", '', new ext_setvar('USERAGENT', '${PJSIP_CONTACT(${CONTACT},user_agent)}'));

			$ext->add($macro, "s", 'uafin', new ext_execif('$["${KNOWNAGENT}" != ""]', 'Set', 'USERAGENT=${KNOWNAGENT}'));
		}
		// We used to set all the variables here (ALERTINFO, CALLINFO, etc. That has been moved to each
		// paging group and the intercom main macro, since it was redundant for every phone causing a lot
		// of overhead with large page groups.
		//

		// Defaults are setup, now make specific adjustments for detected phones
		// These come from the SQL table as well where installations can make customizations
		//
		$ext->add($macro, "s", '', new ext_execif('$["${LEN(${PVOL})}" != "0"]', 'Set','PAGE_VOL=\\;volume=${PVOL}'));
		foreach ($autoanswer_arr as $autosetting) {
			$useragent   = trim($autosetting['useragent']);
			$autovar     = trim($autosetting['var']);
			$data        = trim($autosetting['setting']);
			switch (ltrim($autovar,'_')) {
			case 'ANSWERMACRO':
				$has_answermacro = true;
				// fall through - no break on purpose
			case 'ALERTINFO':
			case 'CALLINFO':
			case 'SIPURI':
			case 'VXML_URL':
			case 'DOPTIONS':
			case 'DTIME':
			default:
				if (trim($data) != "") {
					$ext->add($macro, "s", '', new ext_execif('$["${USERAGENT:0:'.strlen($useragent).'}" = "'.$useragent.'"]', 'Set',$autovar.'='.$data));
				}
				break;
			}
		}

		// Now any adjustments have been made, set the headers and done
		//
		if ($has_answermacro) {
			$ext->add($macro, "s", '', new ext_gotoif('$["${ANSWERMACRO}" != ""]','macro2'));
		}
		$ext->add($macro, "s", '', new ext_execif('$["${SIPURI}" != ""]', 'Set','__SIP_URI_OPTIONS=${SIPURI}'));
		$ext->add($macro, "s", 'macro', new ext_macro('${DB(DEVICE/${ARG1}/autoanswer/macro)}','${ARG1}'), 'n',2);
		if ($has_answermacro) {
			$ext->add($macro, "s", 'macro2', new ext_macro('${ANSWERMACRO}','${ARG1}'), 'n',2);
		}

		//auto answer stuff
		//set autoanswer variables
		if (!empty($custom_vars)) {
			foreach ($custom_vars as $key => $value) {
				$ext->add($apppaging, '_AUTOASWER.', '', new ext_setvar('_'.ltrim($key,'_'), $value));
			}
			$ext->add($apppaging, '_AUTOASWER.', '', new ext_macro('autoanswer','${EXTEN:9}'));
			$ext->add($apppaging, '_AUTOASWER.', '', new ext_return());
		}

		// Macro to apply SIP Headers to channel.
		//   function ext_gosubif($condition, $true_priority, $false_priority = false, $true_args = '', $false_args = '') {
		//
		$ext->add("autoanswer", "s", '', new ext_gosubif('$["${ARG1}" != ""]', 'func-set-sipheader,s,1', false, 'Alert-Info,${ARG1}'));
		$ext->add("autoanswer", "s", '', new ext_gosubif('$["${ARG2}" != ""]', 'func-set-sipheader,s,1', false, 'Call-Info,${ARG2}'));
		$ext->add("autoanswer", "s", '', new ext_gosub('func-apply-sipheaders,s,1'));
		$ext->add("autoanswer", "s", '', new ext_return());

		// Setup Variables before AGI script
		//
		$ext->add($apppaging, 'ssetup', '', new ext_set('_SIPURI', ''));
		if (isset($alertinfo) && trim($alertinfo) != "") {
			$ext->add($apppaging, 'ssetup', '', new ext_set('_ALERTINFO', $alertinfo));
		}

		if (isset($callinfo) && trim($callinfo) != "") {
			$ext->add($apppaging, 'ssetup', '', new ext_set('_CALLINFO', $callinfo));
		}
		if (isset($sipuri) && trim($sipuri) != "") {
			$ext->add($apppaging, 'ssetup', '', new ext_set('_SIPURI', $sipuri));
		}
		if (isset($vxml_url) && trim($vxml_url) != "") {
			$ext->add($apppaging, 'ssetup', '', new ext_set('_VXML_URL', $vxml_url));
		}
		$ext->add($apppaging, 'ssetup', '', new ext_set('_DTIME', $dtime));
		$ext->add($apppaging, 'ssetup', '', new ext_set('_ANSWERMACRO', ''));

		$page_opts = $amp_conf['ASTCONFAPP'] == 'app_confbridge' ? '1qs' : '1dqsx';
		$ext->add($apppaging, 'ssetup', '', new ext_set('PAGE_CONF', '${EPOCH}${RAND(100,999)}'));
		$ext->add($apppaging, 'ssetup', '', new ext_return());

		// Normal page version (now used for Force also)
		// If we had any custom_vars then call the AUTOASWER subroutine first, otherwise go
		// straight to macro-autoanswer
		if (!empty($custom_vars)) {
			$ext->add($apppaging, "_PAGE.", 'SKIPCHECK', new ext_gosub('AUTOASWER${EXTEN:4},1'));
		} else {
			$ext->add($apppaging, "_PAGE.", 'SKIPCHECK', new ext_macro('autoanswer', '${EXTEN:4}'));
		}

		$ext->add($apppaging, "_PAGE.", '', new ext_noop('${EXTRINGTIME}'));
		$ext->add($apppaging, "_PAGE.", '', new ext_gotoif('$["${EXTRINGTIME}" != "true"]', 'doptions'));
		$ext->add($apppaging, "_PAGE.", '', new ext_set('_DTIME', '${RINGTIMER_DEFAULT}'));
		$ext->add($apppaging, "_PAGE.", '', new ext_execif('$["${DB(AMPUSER/${EXTEN:4}/ringtimer)}" != "" & ${DB(AMPUSER/${EXTEN:4}/ringtimer)} > 0]', 'Set', '_DTIME=${DB(AMPUSER/${EXTEN:4}/ringtimer)}'));

		//strip the global Announcement out of doptions (We use our announcement variable lower --V)
		$doptions2 = preg_replace("/A\([^\)]*\)/","",$doptions);
		$ext->add($apppaging, "_PAGE.", 'doptions', new ext_execif('$["${DOPTIONS}" = ""]', 'Set', '_DOPTIONS='.$doptions2));
		$ext->add($apppaging, "_PAGE.", '', new ext_dial('${DIAL}','${DTIME},A(${ANNOUNCEMENT})${DOPTIONS}'));
		$ext->add($apppaging, "_PAGE.", 'skipself', new ext_hangup());

		// Try ChanSpy Version
		$ext->add($apppaging, "_SPAGE.", 'chanspy', new ext_chanspy('${SP_DEVICE}-','qW'));
		$ext->add($apppaging, "_SPAGE.", '', new ext_hangup());

		// If Asterisk 10 and app_confbridge:
		//
		// Common to admin:
		//  d: dynamically addd conf
		//  o: talker optimization (don't mix non-talkers)
		//  q: quiet mode no enter/leave sounds
		//  x: close conf when last marked user exits
		//
		// Not in Admin:
		//  1: ???
		//  s: present menu

		//See http://issues.freepbx.org/browse/FREEPBX-8796
		//before you even think about removing this to after checking for a page group!
		if ($amp_conf['ASTCONFAPP'] == 'app_confbridge' && isset($conferences_conf) && is_a($conferences_conf, "conferences_conf")) {
			$pu = 'page_user';
			$pud = 'page_user_duplex';
			foreach (array($pu, $pud) as $u) {
				$conferences_conf->addConfUser($u, 'quiet', 'yes');
				$conferences_conf->addConfUser($u, 'announce_user_count', 'no');
				$conferences_conf->addConfUser($u, 'wait_marked', 'yes');
				$conferences_conf->addConfUser($u, 'end_marked', 'yes');
				$dds = \FreePBX::Paging()->getDropSilence() ? 'yes' : 'no';
				$conferences_conf->addConfUser($u, 'dsp_drop_silence', $dds);
				if($astman->database_get("paging","quiet") == 1 && $u == 'page_user') {
					$conferences_conf->addConfUser($u, 'announce_join_leave', 'no');
				}
				$conferences_conf->addConfUser($u, 'admin', 'no');
				$conferences_conf->addConfUser($u, 'marked', 'no');
			}
			$conferences_conf->addConfUser($pu, 'startmuted', 'yes');
		}

		//page playback
		$c = 'app-page-stream';
		$ext->add($c, 's', '', new ext_wait(1));
		$ext->add($c, 's', '', new ext_answer());
		$ext->add($c, 's', '', new ext_set('CHANNEL(language)','${SIPLANG}'));

		// TODO: PAGE_CONF_OPTS reset in agi script so just use proper context if 10+confbridge no mute
		// x: close conf when last marked user exits
		// q: quiet mode no enter/leave sounds
		//
		// TODO: Ideally what we want is to mark the stream and wait for that, if no stream then no wait for makred user. However
		//       it seems like to end a conference you have to have the kick after last marked user since there doesn't have to be
		//       an admin as far as I can tell.
		//
		//
		if ($amp_conf['ASTCONFAPP'] == 'app_confbridge') {
			$ext->add($c, 's', '', new ext_set('CONFBRIDGE(user,template)', $pud));
			$ext->add($c, 's', '', new ext_set('CONFBRIDGE(user,marked)', 'yes'));
			//ADMIN_MUTED is a page stream Startup from scheduler page
			$ext->add($c, 's', '', new ext_execif('$["${PAGE_USER_TYPE}" = "ADMIN_MUTED"]', 'Set', 'CONFBRIDGE(user,startmuted)=yes'));
			$ext->add($c, 's', '', new ext_execif('$["${PAGE_USER_TYPE}" = "ADMIN_MUTED"]', 'Set', 'CONFBRIDGE(user,marked)=yes'));
			$ext->add($c, 's', '', new ext_meetme('${PAGE_CONF}','',''));
		} else {
			$ext->add($c, 's', '', new ext_meetme('${PAGE_CONF}', '${PAGE_CONF_OPTS}'));
		}
		$ext->add($c, 's', '', new ext_hangup());


		$apppagegroups = 'app-pagegroups';
		// Now get a list of all the paging groups...
		$sql = "SELECT page_group, force_page, duplex, announcement, volume FROM paging_config";
		$paging_groups = $db->getAll($sql, DB_FETCHMODE_ASSOC);

		if (!$paging_groups) {
			break;//no need to continue if we dont have any pagegroups
		}

		$extpaging = 'ext-paging';
		if(!empty($paging_groups)) {
			$ext->addInclude('from-internal-additional',$extpaging);
		}
		foreach ($paging_groups as $thisgroup) {
			$grp=trim($thisgroup['page_group']);
			switch ($thisgroup['force_page']) {
			case 1:
				$pagemode = 'FPAGE';
				break;
			case 2:
				$pagemode = 'SPAGE';
				break;
			case 0:
			default:
				$pagemode = 'PAGE';
				break;
			}

			$sql = "SELECT ext FROM paging_groups WHERE page_number='$grp'";
			$all_exts = $db->getCol($sql);

			// Create the paging context that is used in the paging application for each phone to auto-answer
			//add ext-paging with goto's to our app-paging context and a hint for the page

			$ext->add($extpaging, $grp, '', new ext_goto($apppagegroups . ',' . $grp . ',1'));
			$ext->addHint($extpaging, $grp, 'Custom:PAGE' . $grp);

			//app-page dialplan

			$ext->add($apppagegroups, $grp, '', new ext_macro('user-callerid'));
			$ext->add($apppagegroups, $grp, '', new ext_set('_PAGEGROUP', $grp));
			if(!empty($thisgroup['volume'])) {
				$ext->add($apppagegroups, $grp, '', new ext_set('_PVOL', ($thisgroup['volume'] - 1))); //Sangoma Paging Volume adjustment
			}

			//if page group it in use, goto to busy
			$ext->add($apppagegroups, $grp, 'busy-check', new ext_gotoif('$[${TRYLOCK(apppagegroups'. $grp .')}]', '', 'busy'));

			//set blf to in use
			$ext->add($apppagegroups, $grp, 'devstate', new ext_setvar('DEVICE_STATE(Custom:PAGE' . $grp .')', 'INUSE'));

			$ext->add($apppagegroups, $grp, '', new ext_gosub('1','ssetup', $apppaging));
			$ext->add($apppagegroups, $grp, '', new ext_set('PAGEMODE', $pagemode));
			$ext->add($apppagegroups, $grp, '', new ext_set('PAGE_MEMBERS', implode('-', $all_exts)));
			if ($amp_conf['ASTCONFAPP'] == 'app_confbridge') {
				$ext->add($apppagegroups, $grp, '', new ext_set('PAGE_CONF_OPTS', ($thisgroup['duplex'] ? 'duplex' : '')));
			} else {
				$ext->add($apppagegroups, $grp, '', new ext_set('PAGE_CONF_OPTS', $page_opts . (!$thisgroup['duplex'] ? 'm' : '')));
			}
			//Default announcement is a beep
			$announcement = "beep";
			//extract our "global default announcement" from the doptions and set it to announcement
			if(preg_match("/A\(([^\)]*)\)/",$doptions,$matches)) {
				$announcement = isset($matches[1]) ? $matches[1] : "";
			}
			//get our individual page group announcement if set
			if(!empty($thisgroup['announcement'])) {
				switch($thisgroup['announcement']) {
					case "beep":
						$announcement = "beep";
					break;
					case "none":
						$announcement = "";
					break;
					case "default":
						//do nothing
					break;
					default:
						if(function_exists('recordings_get_file')) {
							$announcement = recordings_get_file($thisgroup['announcement']);
						} else {
							$announcement = "";
						}
					break;
				}
			}
			$ext->add($apppagegroups, $grp, '', new ext_set('ANNOUNCEMENT', $announcement));
			$ext->add($apppagegroups, $grp, 'agi', new ext_agi('page.agi'));

			//we cant use originate from the dialplan as the dialplan command is not asynchronous
			//we would like to though...
			//this code here as a sign of hope -MB
				/*foreach ($page_members as $member) {
						$ext->add($apppagegroups, $grp, 'page', new ext_originate($member,'app','meetme', '${PAGE_CONF}\,${PAGE_CONF_OPTS}'));
				}*/
			// TODO this is the master so set appropriate
			//      This is what everyone else has: 1doqsx
			//      Common:
			//        d: dynamically addd conf
			//        o: talker optimization (don't mix non-talkers)
			//        q: quiet mode no enter/leave sounds
			//        x: close conf when last marked user exits
			//      Added:
			//      	w: W() wait until marked user enters conf
			//      	A: Set marked mode
			//      	G: G() Play an intro announcemend in conference
			//      Removed:
			//        1: ???
			//        s: present menu
			//
			//
			if ($amp_conf['ASTCONFAPP'] == 'app_confbridge') {
				$ext->add($apppagegroups, $grp, '', new ext_set('CONFBRIDGE(user,template)', $pud));
				$ext->add($apppagegroups, $grp, '', new ext_set('CONFBRIDGE(user,admin)', 'yes'));
				$ext->add($apppagegroups, $grp, '', new ext_set('CONFBRIDGE(user,marked)', 'yes'));
				// TODO: should I have no menu?
				$ext->add($apppagegroups, $grp, '', new ext_answer(''));
				$ext->add($apppagegroups, $grp, 'page', new ext_meetme('${PAGE_CONF}',',','admin_menu'));
			} else {
				$ext->add($apppagegroups, $grp, '', new ext_answer(''));
				$ext->add($apppagegroups, $grp, 'page', new ext_meetme('${PAGE_CONF}', 'dqwxAG'));
			}
			$ext->add($apppagegroups, $grp, '', new ext_hangup());
			$ext->add($apppagegroups, $grp, 'busy', new ext_set('PAGE${PAGEGROUP}BUSY', 'TRUE'));
			$ext->add($apppagegroups, $grp, 'play-busy', new ext_busy(3));
			$ext->add($apppagegroups, $grp, 'busy-hang', new ext_goto('app-pagegroups,h,1'));
		}

		//h
		$ext->add($apppagegroups, 'h', '', new ext_execif('$[${ISNULL(${PAGE${PAGEGROUP}BUSY})}]', 'Set', 'DEVICE_STATE(Custom:PAGE${PAGEGROUP})=NOT_INUSE'));

		break;
	}
}

// This is the hook for 'destinations'
function paging_destinations() {
	$extens = array();
	$results = paging_list();
	// return an associative array with destination and description
	if (isset($results)) {
		foreach($results as $result){
			$desc = $result['description'] ? '<'.$result['page_group'].'> '.$result['description'] : _('Page Group') . ' ' . $result['page_group'];
			$extens[] = array('destination' => 'app-pagegroups,' . $result['page_group'] . ',1', 'description' => $desc);
		}
		return $extens;
	} else {
		return null;
	}
}

function paging_getdestinfo($dest) {
	if (substr(trim($dest),0,15) == 'app-pagegroups,') {
		$exten = explode(',',$dest);
		$exten = $exten[1];
		$thisexten = paging_get_pagingconfig($exten);
		if (empty($thisexten)) {
			return array();
		} else {
			return array('description' => sprintf(_("Paging Group %s : %s"),$exten,$thisexten['description']),
			             'edit_url' => 'config.php?display=paging&view=form&extdisplay='.urlencode($exten),
					);
		}
	} else {
		return false;
	}
}

function paging_getdest($exten) {
	return array('app-pagegroups,'.$exten.',1');
}

function paging_get_autoanswer_defaults($orderd = false) {
	global $db;

	$sql = "SELECT * FROM paging_autoanswer WHERE useragent = 'default'";
	$results = $db->getAll($sql,DB_FETCHMODE_ASSOC);
	if(DB::IsError($results)) {
		$results = array();
	}
	if ($orderd) {
		foreach ($results as $r) {
			$res[$r['var']] = $r['setting'];
		}
		$results = $res;
	}
	return $results;
}

function paging_set_autoanswer_defaults($data) {
	return \FreePBX::Paging()->setAutoanswerDefaults($data);
}

function paging_get_autoanswer_useragents($useragent = '') {
	global $db;

	$sql = "SELECT * FROM paging_autoanswer WHERE useragent != 'default' ";
	if ($useragent != "") {
		$sql .= "AND useragent = $useragent ";
	}
	$results = $db->getAll($sql,DB_FETCHMODE_ASSOC);
	if(DB::IsError($results)) {
		$results = array();
	}
	return $results;
}

function paging_list() {
	$result = \FreePBX::Paging()->listGroups();
	return $result;
}

function paging_check_extensions($exten=true) {
	global $active_modules;

	$extenlist = array();
	if (is_array($exten) && empty($exten)) {
		return $extenlist;
	}

	$sql = "SELECT page_group, description FROM paging_config ";
	if (is_array($exten)) {
		$sql .= "WHERE page_group in ('".implode("','",$exten)."')";
	}
	$sql .= " ORDER BY page_group";
	$results = sql($sql,"getAll",DB_FETCHMODE_ASSOC);

	$type = isset($active_modules['paging']['type'])?$active_modules['paging']['type']:'setup';
	foreach ($results as $result) {
		$thisexten = $result['page_group'];
		$extenlist[$thisexten]['description'] = _("Page Group: ").$result['description'];
		$extenlist[$thisexten]['status'] = 'INUSE';
		$extenlist[$thisexten]['edit_url'] = 'config.php?type='.urlencode($type).'setup&display=paging&selection='.urlencode($thisexten).'&action=modify';
	}
	return $extenlist;
}

function paging_get_devs($grp) {
	global $db;

	// Just in case someone's trying to be smart with a SQL injection.
	$grp = $db->escapeSimple($grp);

	$sql = "SELECT ext FROM paging_groups where page_number='$grp'";
	$results = $db->getAll($sql);
	if(DB::IsError($results))
		$results = array();
	foreach ($results as $val)
		$tmparray[] = $val[0];
	return $tmparray;
}

function paging_get_pagingconfig($grp) {
	global $db;

	// Just in case someone's trying to be smart with a SQL injection.
	$grp = $db->escapeSimple($grp);

	$sql = "SELECT * FROM paging_config WHERE page_group='$grp'";
	$results = $db->getRow($sql, DB_FETCHMODE_ASSOC);
	if(DB::IsError($results)) {
		$results = null;
	}
	$sql = "SELECT * FROM admin WHERE variable='default_page_grp' AND value='$grp'";
	$default_group = $db->getRow($sql, DB_FETCHMODE_ASSOC);
	if(DB::IsError($default_group)) {
		$results['default_group'] = 0;
	} else {
		$results['default_group'] = empty($default_group) ? 0 : $default_group['value'];
	}
	return $results;
}

function paging_modify($oldxtn, $xtn, $plist, $force_page, $duplex, $description='', $default_group=0, $announcement=0, $volume=0) {
	global $db;
	// Just in case someone's trying to be smart with a SQL injection.
	$xtn = $db->escapeSimple($xtn);

	// Delete it if it's there.
	paging_del($oldxtn);

	// Now add it all back in.
	paging_add($xtn, $plist, $force_page, $duplex, $description, $default_group, $announcement, $volume);

	// Aaad we need a reload.
	needreload();

}

function paging_del($xtn) {
	global $db;
	$sql = "DELETE FROM paging_groups WHERE page_number='$xtn'";
	$res = $db->query($sql);
	if (DB::isError($res)) {
		var_dump($res);
		die_freepbx("Error in paging_del(): ");
	}

	$sql = "DELETE FROM paging_config WHERE page_group='$xtn'";
	$res = $db->query($sql);
	if (DB::isError($res)) {
		var_dump($res);
		die_freepbx("Error in paging_del(): ");
	}
	sql("DELETE FROM `admin` WHERE variable = 'default_page_grp' AND value = '$xtn'");

	needreload();
}

function paging_add($xtn, $plist, $force_page, $duplex, $description='', $default_group, $announcement=0, $volume=0) {
	global $db;

	// $plist contains a string of extensions, with \n as a seperator.
	// Split that up first.
	if (is_array($plist)) {
		$xtns = $plist;
	} else {
		$xtns = explode("\n",$plist);
	}
	foreach (array_keys($xtns) as $val) {
		$val = $db->escapeSimple(trim($xtns[$val]));
		// Sanity check input.

		$sql = "INSERT INTO paging_groups(page_number, ext) VALUES ('$xtn', '$val')";
		$db->query($sql);
	}

	$description = $db->escapeSimple(trim($description));
	$sql = "INSERT INTO paging_config(page_group, force_page, duplex, description, announcement, volume) VALUES ('$xtn', '$force_page', '$duplex', '$description', '$announcement', '$volume')";
	$db->query($sql);

	if ($default_group) {
		sql("DELETE FROM `admin` WHERE variable = 'default_page_grp'");
		sql("INSERT INTO `admin` (variable, value) VALUES ('default_page_grp', '$xtn')");
	} else {
		sql("DELETE FROM `admin` WHERE variable = 'default_page_grp' AND value = '$xtn'");
	}

	needreload();
}

function paging_check_default($extension) {
	$sql = "SELECT ext FROM paging_groups WHERE ext = '$extension' AND page_number = (SELECT value FROM admin WHERE variable = 'default_page_grp' limit 1)";
	$results = sql($sql,"getAll");
	return (count($results) ? 1 : 0);
}

function paging_get_default() {
	return \FreePBX::Paging()->getDefaultGroup();
}

function paging_set_default($extension, $value) {
	$default_group = sql("SELECT value FROM `admin` WHERE variable = 'default_page_grp' limit 1", "getOne");
	if ($default_group == '') {
		return false;
	}
	sql("DELETE FROM paging_groups WHERE ext = '$extension' AND page_number = '$default_group'");
	if ($value == 1) {
		sql("INSERT INTO paging_groups (page_number, ext) VALUES ('$default_group', '$extension')");
	}
}

function paging_configpageinit($pagename) {
	global $currentcomponent;

	$action = isset($_REQUEST['action'])?$_REQUEST['action']:null;
	$extdisplay = isset($_REQUEST['extdisplay'])?$_REQUEST['extdisplay']:null;
	$extension = isset($_REQUEST['extension'])?$_REQUEST['extension']:null;
	$tech_hardware = isset($_REQUEST['tech_hardware'])?$_REQUEST['tech_hardware']:null;

	// We only want to hook 'devices' or 'extensions' pages.
	if ($pagename != 'devices' && $pagename != 'extensions') {
		return true;
	}

	if ($tech_hardware != null && ($pagename == 'extensions' || $pagename == 'devices')) {
		paging_applyhooks();
		$currentcomponent->addprocessfunc('paging_configprocess', 8);
	} elseif ($action=="add") {
		// We don't need to display anything on an 'add', but we do need to handle returned data.
		$currentcomponent->addprocessfunc('paging_configprocess', 8);
	} elseif ($extdisplay != '') {
		// We're now viewing an extension, so we need to display _and_ process.
		paging_applyhooks();
		$currentcomponent->addprocessfunc('paging_configprocess', 8);
	}
}

function paging_applyhooks() {
	global $currentcomponent;

	// Add the 'process' function - this gets called when the page is loaded, to hook into
	// displaying stuff on the page.
	$currentcomponent->addoptlistitem('page_group', '0', _("Exclude"));
	$currentcomponent->addoptlistitem('page_group', '1', _("Include"));
	$currentcomponent->setoptlistopts('page_group', 'sort', false);

	$currentcomponent->addoptlistitem('intercom', 'enabled', _("Enabled"));
	$currentcomponent->addoptlistitem('intercom', 'disabled', _("Disabled"));
	$currentcomponent->setoptlistopts('intercom', 'sort', false);

	$currentcomponent->addoptlistitem('answermode', 'disabled', _("Disable"));
	$currentcomponent->addoptlistitem('answermode', 'intercom', _("Intercom"));
	$currentcomponent->setoptlistopts('answermode', 'sort', false);

	$currentcomponent->addguifunc('paging_configpageload');
}


// This is called before the page is actually displayed, so we can use addguielem().
function paging_configpageload() {
	global $currentcomponent,$astman;

	// Init vars from $_REQUEST[]
	$action = isset($_REQUEST['action']) ? $_REQUEST['action']:null;
	$extdisplay = isset($_REQUEST['extdisplay']) ? $_REQUEST['extdisplay']:null;
	$tech_hardware = isset($_REQUEST['tech_hardware']) ? $_REQUEST['tech_hardware']:'';

	// Don't display this stuff if it's on a 'This xtn has been deleted' page.
	if ($action != 'del' && $tech_hardware != 'virtual') {

		$default_group = sql("SELECT value FROM `admin` WHERE variable = 'default_page_grp'", "getOne");
		$section = _("Default Group Inclusion");
		if ($default_group != "") {
			$in_default_page_grp = paging_check_default($extdisplay);
			$currentcomponent->addguielem($section, new gui_selectbox('in_default_page_grp', $currentcomponent->getoptlist('page_group'), $in_default_page_grp, _('Default Page Group'), _('You can include or exclude this extension/device from being part of the default page group when creating or editing.'), false));
		}
		$section = _("Extension Options");
		$category = "advanced";

		$answermode = $astman->database_get("AMPUSER",$extdisplay."/answermode");
		$answermode = (trim($answermode) == '') ? $amp_conf['DEFAULT_INTERNAL_AUTO_ANSWER'] : $answermode;
		$currentcomponent->addguielem($section, new gui_radio('answermode', $currentcomponent->getoptlist('answermode'), $answermode, _("Internal Auto Answer"), _("When set to Intercom, calls to this extension/user from other internal users act as if they were intercom calls meaning they will be auto-answered if the endpoint supports this feature and the system is configured to operate in this mode. All the normal white list and black list settings will be honored if they are set. External calls will still ring as normal, as will certain other circumstances such as blind transfers and when a Follow Me is configured and enabled. If Disabled, the phone rings as a normal phone."), false, '','',false), $category);

		$intercom = $astman->database_get("AMPUSER",$extdisplay."/intercom");
		$intercom = (trim($intercom) == '') ? 'enabled' : $intercom;
		$currentcomponent->addguielem($section, new gui_radio('intercom', $currentcomponent->getoptlist('intercom'), $intercom, _("Intercom Mode"), _("When Enabled users can use *80<ext> to force intercom. When Disabled this user will reject intercom calls"), false, '','',false), $category);
	}
}

function paging_configprocess() {
	global $db;

	//create vars from the request
	//
	$action = isset($_REQUEST['action'])?$_REQUEST['action']:null;
	$ext = isset($_REQUEST['extdisplay'])?$_REQUEST['extdisplay']:null;
	$extn = isset($_REQUEST['extension'])?$_REQUEST['extension']:null;
	$in_default_page_grp = isset($_REQUEST['in_default_page_grp'])?$_REQUEST['in_default_page_grp']:false;

	if (($_REQUEST['display'] == 'devices') && $action == 'add') {
		$extdisplay = $_REQUEST['deviceid'];
	} else {
		$extdisplay = ($ext=='') ? $extn : $ext;
	}

	if ($action == "add" || $action == "edit") {
		if (!isset($GLOBALS['abort']) || $GLOBALS['abort'] !== true) {
			if ($in_default_page_grp !== false) {
				paging_set_default($extdisplay, $in_default_page_grp);
			}
		}
	} elseif ($action == "del") {
		$sql = "DELETE FROM paging_groups WHERE ext = '$extdisplay'";
		sql($sql);
	}
}

// provide hook for routing
function paging_hook_core($viewing_itemid, $target_menuid) {
    global $db;

    switch ($target_menuid) {
        case 'routing':
			//only render the Notifications ui options on an Outbound Route if pagingpro has been 
			//updated to a version that no longer handles this option, or if pro is not installed/enabled
			$pagingproInfo = \FreePBX::Modules()->getInfo("pagingpro");
			$pagingproStatus = empty($pagingproInfo['pagingpro']['status']) ? 0 : $pagingproInfo['pagingpro']['status']; //0 default, 2 enabled
			$sql        = "SELECT COLUMN_NAME FROM information_schema.columns WHERE table_name = 'pagingpro_core_routing'";
			$results    = $db->getAll($sql, DB_FETCHMODE_ASSOC);
			if (empty($results) || $pagingproStatus != 2) {
                $data['paging_groups'][] = _('None');
                foreach((array) paging_list() as $page) {
                    $data['paging_groups'][$page['page_group']]
                        = $page['description']
                        ? $page['description']
                        : _('Page Group') . ' ' . $page['page_group'];
                }
                if ($viewing_itemid) {
                    $data['paging_group'] = paging_core_routing_get($viewing_itemid);
                }
				return load_view(dirname(__FILE__) . '/views/routing_hook.php', $data);
			}
            break;
        default:
            return false;
            break;
    }
}

//prosses hook for core/routing
function paging_hookProcess_core($viewing_itemid, $request) {
    global $db;
    switch ($request['display']) {
		case 'routing':
            $action = isset($request['action']) ? $request['action'] : '';
            $page_id = isset($request['paging_notification'])
                        ? $request['paging_notification']
                        : '';
            $route = $viewing_itemid;

            switch ($action) {
                case 'addroute':
					//if a Notification page group is selected during the creation of
					//a new outbound route, find the resulting route_id, then use that
					//to add an entry to paging_core_routing
					if (!empty($page_id)  && isset($request['routename'])) {
						$sql        = "SELECT * FROM outbound_routes where name='" . $request['routename'] . "'";
						$results    = $db->getAll($sql, DB_FETCHMODE_ASSOC);
						$routeId = $results[0]['route_id'];

						paging_core_routing_put($page_id, $routeId);
					} 
					break;
                case 'editroute':
                    if ($page_id && $route) {
                        paging_core_routing_put($page_id, $route);
                    } elseif(!$page_id && $route) {
                        paging_core_routing_del($route);
                    }
                    break;
                case 'delroute':
                    paging_core_routing_del($route);
                    break;
			}
			break;
        default:
            return false;
            break;
    }
}

//get core/routing settings
function paging_core_routing_get($route) {
    global $db;
    $ret = $db->getOne('SELECT page_id FROM paging_core_routing '
            . 'WHERE route = ?', array($route));
    db_e($ret);

    return $ret;
}

//delete core/routing settings
function paging_core_routing_del($route) {
    global $db;
    $ret = $db->query('DELETE FROM paging_core_routing WHERE route = ?',
            array($route));
    db_e($ret);

    return $ret;
}

//save core/routing settings
function paging_core_routing_put($page_id, $route) {
    global $db;
    $sql = 'REPLACE INTO paging_core_routing (page_id, route) VALUES (?, ?)';
    $ret = $db->query($sql, array($page_id, $route));
    db_e($ret);

    return $ret;
}

?>
