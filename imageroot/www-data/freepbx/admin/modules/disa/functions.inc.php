<?php
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2013 Schmooze Com Inc.
//

if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
/* $Id */


// This is the hook for 'destinations'
function disa_destinations() {
	$results = FreePBX::Disa()->listAll();
	// return an associative array with destination and description
	if ($results) {
		$extens = array();
		foreach($results as $result){
			$extens[] = array('destination' => 'disa,'.$result['disa_id'].',1', 'description' => $result['displayname']);
		}
		return $extens;
	} else {
		return array();
	}
}

function disa_getdest($exten) {
	return array('disa,'.$exten.',1');
}

function disa_getdestinfo($dest) {
	global $active_modules;

	if (substr(trim($dest),0,5) == 'disa,') {
		$exten = explode(',',$dest);
		$exten = $exten[1];
		$thisexten = FreePBX::Disa()->get($exten);
		if (empty($thisexten)) {
			return array();
		} else {
			//$type = isset($active_modules['announcement']['type'])?$active_modules['announcement']['type']:'setup';
			return array(
				'description' => sprintf(_("DISA: %s"),$thisexten['displayname']),
				'edit_url' => 'config.php?display=disa&view=form&itemid='.urlencode($exten),
			);
		}
	} else {
		return false;
	}
}

// This actually generates the dialplan
function disa_get_config($engine) {
	global $ext;
	global $amp_conf;
	switch($engine) {
	case "asterisk":
		foreach(glob($amp_conf['ASTETCDIR'].'/disa-*.conf') as $filename) {
			@unlink($filename);
		}

		$disalist = FreePBX::Disa()->listAll();
		if(is_array($disalist)) {
			foreach($disalist as $item) {
				$nopass = false;

				// delete it incase there was one from before (of course if it was deleted???
				// this should all be done properly in class, see pinsets, but for now ...
				//
				$filename = $amp_conf['ASTETCDIR'].'/disa-'.$item['disa_id'].'.conf';
				if (isset($item['pin']) && !empty($item['pin']) && (strtolower($item['pin']) != 'no-password')) {
					$is_file = false;
					// Create the disa-$id.conf file
					$pinarr = explode(',', $item['pin'] );
					$contents = '';
					if (count($pinarr)) {
						$is_file = true;
						foreach($pinarr as $pin) {
							// Don't support remote MWI, too easy for users to break.
							$contents .= "$pin\n";
						}
					}
					if(!empty($contents)) {
						file_put_contents($filename, $contents);
					}
				} else {
					$nopass = true;
				}

				$thisitem = disa_get(ltrim($item['disa_id']));
				// add dialplan

				if ($thisitem['needconf'] == 'CHECKED') {
					$ext->add('disa', $item['disa_id'], '', new ext_setvar('RESCOUNT', '1'));
					$ext->add('disa', $item['disa_id'], 'loop',  new ext_gotoif('$[ ${RESCOUNT} > 5]', 'end'));
					$ext->add('disa', $item['disa_id'], '',  new ext_read('RRES', 'press-1', '1', ',1,3'));
					$ext->add('disa', $item['disa_id'], '', new ext_setvar('RESCOUNT', '$[${RESCOUNT}+1]'));
					$ext->add('disa', $item['disa_id'], '', new ext_gotoif('$["x${RRES}"="x"]', 'loop'));
				}
				$ext->add('disa', $item['disa_id'], '', new ext_answer(''));
				if (!$nopass) {
					if ($is_file) {
						$ext->add('disa', $item['disa_id'], '', new ext_authenticate($amp_conf['ASTETCDIR'].'/disa-'.$item['disa_id'].'.conf'));
					} else {
						$ext->add('disa', $item['disa_id'], '', new ext_authenticate($item['pin']));
					}
				}
				$ext->add('disa', $item['disa_id'], '', new ext_gosub("1", "s", "sub-record-check", 'disa,${EXTEN},'.disa_get_recording($item['disa_id'])));
				$ext->add('disa', $item['disa_id'], '', new ext_setvar('_DISA', 'disa^'.$item['disa_id'].'^newcall'));
				$ext->add('disa', $item['disa_id'], 'newcall', new ext_setvar('_DISACONTEXT', $thisitem['context']));
				$ext->add('disa', $item['disa_id'], '', new ext_setvar('_KEEPCID', (!$thisitem['keepcid'])?'TRUE':'FALSE'));
				if ($thisitem['hangup'] == 'CHECKED') {
					$ext->add('disa', $item['disa_id'], '', new ext_setvar('_HANGUP', '${TRUNK_OPTIONS}Hg'));
				} else {
					$ext->add('disa', $item['disa_id'], '', new ext_setvar('_HANGUP', '${TRUNK_OPTIONS}'));
		}
				$ext->add('disa', $item['disa_id'], '', new ext_setvar('TIMEOUT(digit)', $thisitem['digittimeout']));
				$ext->add('disa', $item['disa_id'], '', new ext_setvar('TIMEOUT(response)', $thisitem['resptimeout']));

				if ($item['cid'] && $item['keepcid']) {
					$ext->add('disa', $item['disa_id'], '', new ext_setvar('CALLERID(all)', $item['cid']));
					$ext->add('disa', $item['disa_id'], '', new ext_setvar('__REALCALLERIDNUM','${CALLERID(number):0:40}'));
				}
				$ext->add('disa', $item['disa_id'], '', new ext_disa('no-password,disa-dial'));

				$ext->add('disa', $item['disa_id'], 'end', new ext_hangup(''));
			}


			$context = 'disa-dial';

			foreach (array('_[0-9a-zA-Z]','_[0-9a-zA-Z*#].') as $exten) {
				$ext->add($context, $exten, '', new ext_noop('called ${EXTEN} in ${DISACONTEXT} by ID: ${CUT(DISA,^,2)}'));
				$ext->add($context, $exten, '', new ext_dial('Local/${EXTEN}@${DISACONTEXT}', '300,${HANGUP}'));  // Regular Trunk Dial
				$ext->add($context, $exten, '', new ext_gosub('1', 's-${DIALSTATUS}'));
				$ext->add($context, $exten, '', new ext_goto('${CUT(DISA,^,1)},${CUT(DISA,^,2)},${CUT(DISA,^,3)}'));
			}

			$exten = 's-ANSWER';
			$ext->add($context, $exten, '', new ext_return());

			$exten = 's-CANCEL';
			$ext->add($context, $exten, '', new ext_return());

			$exten = 's-BUSY';
			$ext->add($context, $exten, '', new ext_playtones('busy'));
			$ext->add($context, $exten, '', new ext_wait('3'));
			$ext->add($context, $exten, '', new ext_return());

			$exten = '_s-.';
			$ext->add($context, $exten, '', new ext_noop('DISA Dial failed due to ${DIALSTATUS} - returning to dial tone'));
			$ext->add($context, $exten, '', new ext_playtones('congestion'));
			$ext->add($context, $exten, '', new ext_wait('3'));
			$ext->add($context, $exten, '', new ext_stopplaytones());
			$ext->add($context, $exten, '', new ext_return());
		}
		break;
	}
}

function disa_list() {
	_disa_backtrace();
	return FreePBX::Disa()->listAll();

}

function disa_get($id){
	_disa_backtrace();
	return FreePBX::Disa()->get($id);
}

function disa_get_recording($id) {
	_disa_backtrace();
	return FreePBX::Disa()->getRecording($id);
}

function disa_put_recording($id, $recording = "dontcare") {
	_disa_backtrace();
	return FreePBX::Disa()->putRecording($id, $recording);
}


function disa_add($post) {
	_disa_backtrace();
	return FreePBX::Disa()->add($post);
}

function disa_del($id) {
	_disa_backtrace();
	return FreePBX::Disa()->delete($id);
}

function disa_edit($id, $post) {
	_disa_backtrace();
	return FreePBX::Disa()->edit($id, $post);
}

function _disa_backtrace(){
	$trace = debug_backtrace();
	$function = $trace[1]['function'];
	$line = $trace[1]['line'];
	$file = $trace[1]['file'];
	freepbx_log(FPBX_LOG_WARNING, 'Depreciated Function ' . $function . ' detected in ' . $file . ' on line ' . $line);
}
