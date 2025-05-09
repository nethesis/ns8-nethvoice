<?php
//PHPLICENSE 

//get room list
function nethhotel_list() {
        $rooms = array();
	$results = sql("select id from sip where keyword='context' and data='hotel' order by id","getAll",DB_FETCHMODE_ASSOC);
	foreach($results as $result){
		// check to see if we are in-range for the current AMP User.
		$rooms[] = $result['id'];
	}
	return $rooms;
}


//get extensions not in room list
function nethhotel_ext_list() {
        $results = sql("select id from sip where keyword='context' and data='from-internal' order by id","getAll",DB_FETCHMODE_ASSOC);
        foreach($results as $result){
                // check to see if we are in-range for the current AMP User.
                $extens[] = $result['id'];
        }
        return $extens;
}


function nethhotel_get($account){
	//get all the variables for the meetme
	$results = sql("SELECT id from sip  WHERE id = '$account' and  keyword='context' and data='hotel'","getAll",DB_FETCHMODE_ASSOC);
	return count($results);
}

function nethhotel_del($account){
	$results = sql("UPDATE sip SET data='from-internal' WHERE id = \"$account\" AND keyword='context'","query");
	needreload();
}

function nethhotel_add($account){
	$results = sql("UPDATE sip SET data='hotel' WHERE id = \"$account\" AND keyword='context'","query");
	needreload();
}

function nethhotel_configpageinit($dispnum) {
        global $currentcomponent;

        if ( ($dispnum == 'users' || $dispnum == 'extensions') ) {
                $currentcomponent->addguifunc('nethhotel_configpageload');
        }
}
function nethhotel_configpageload() {
        global $currentcomponent;

        $viewing_itemid =  isset($_REQUEST['extdisplay'])?$_REQUEST['extdisplay']:null;
        $action =  isset($_REQUEST['action'])?$_REQUEST['action']:null;
        if ( $viewing_itemid != '' && $action != 'del') {
                if(nethhotel_get($viewing_itemid))
                {
                   $grpTEXT = _("Remove from rooms context");
                   $icon = "images/core_delete.png";
                   $action = "confirm_delete";
                }
                else
                {
                   $grpTEXT = _("Add to rooms context");
                   $icon = "images/core_add.png";
                   $action = "add";
                } 
                $label = '<span><img width="16" height="16" border="0"  alt="" src="'.$icon.'" style="margin-right: 5px"/>'.$grpTEXT.'</span>';
                $currentcomponent->addguielem('_top', new gui_link('nethhotellink', $label, $_SERVER['PHP_SELF']."?display=nethhotel&extdisplay=$viewing_itemid&action=$action"));
        }
}

function nethhotel_get_config($engine) {
        global $db;
        global $ext; 
	global $amp_conf;
	$fcc2 = new featurecode('nethhotel', 'configalarm2');
	$fcc2->setDescription('Configura la sveglia di una camera qualunque');
	$fcc2->setDefault('978');
	$fcc2->update();
	$fcc3 = new featurecode('nethhotel', 'checkin');
	$fcc3->setDescription('Effettua il check-in/check-out di una camera. (Es. 967xxx)');
	$fcc3->setDefault('967');
	$fcc3->update();
	$fcc5 = new featurecode('nethhotel', 'extra');
	$fcc5->setDescription('Assegna un extra ad una camera. (Es. *33xxx#xx#x)');
	$fcc5->setDefault('*33');
	$fcc5->update();
	$fcc6 = new featurecode('nethhotel', 'cleanroom');
	$fcc6->setDescription('Codice pulizia camera');
	$fcc6->setDefault('969');
	$fcc6->update();
	$fcc7 = new featurecode('nethhotel', 'configalarm');
	$fcc7->setDescription('Configura la sveglia della camera chiamante');
	$fcc7->setDefault('977');
	$fcc7->update();
	$fcc8 = new featurecode('nethhotel', 'inspected_vacant');
	$fcc8->setDescription('Assegna alla camera, solo su FIAS, lo stato di ispezionata/libera');
	$fcc8->setDefault('970');
	$fcc8->update();
	$fcc9 = new featurecode('nethhotel', 'inspected_occupied');
	$fcc9->setDescription('Assegna alla camera, solo su FIAS, lo stato di ispezionata/occupata');
	$fcc9->setDefault('971');
	$fcc9->update();
        switch($engine) {
                case "asterisk":
			$configalarm2 = $fcc2->getCodeActive();
	                if($configalarm2)
                        {
			        $context = 'hotel-services';
                                $code = $configalarm2;
				$ext->add($context, $code, '', new ext_agi('set-reception-lang.php'));
                                $ext->add($context, $code, '', new ext_answer(''));
                                $ext->add($context, $code, '', new ext_agi('configAlarm.php,${CALLERID(number)},1'));
                                $ext->add($context, $code, '', new ext_hangup());
                        }
			$checkin = $fcc3->getCodeActive();
			if($checkin)
			{
			        $context = 'hotel-services';
                                $code = "_$checkin.";
				$ext->add($context, $code, '', new ext_agi('set-reception-lang.php'));
                                $ext->add($context, $code, '', new ext_answer(''));
                                $ext->add($context, $code, '', new ext_agi('checkin.php,${EXTEN:3},0'));
				if ($amp_conf['USEDEVSTATE']) {
                                    $ext->add($context, $code, '', new ext_setvar('(Custom:CHK10${EXTEN:3})','${statuslamp}'));
                                }
                                $ext->add($context, $code, '', new ext_hangup());
	
			}
                        $extra = $fcc5->getCodeActive();
                        if($extra)
                        {
                            foreach (array('hotel-services','camere') as $context) {
                                $code = "_$extra.";
				$ext->add($context, $code, '', new ext_agi('set-reception-lang.php'));
                                $ext->add($context, $code, '', new ext_answer(''));
                                $ext->add($context, $code, '', new ext_agi('extra.php,${EXTEN:'.strlen($extra).'}'));
                                $ext->add($context, $code, '', new ext_hangup());
                            }
                        }
                        $cleanroom = $fcc6->getCodeActive();
                        if($cleanroom) {
                            $context = 'camere';
                            $ext->add($context, '_[*#0-9]!','', new ext_agi('set-room-lang.php,${CALLERID(number)}'));
                            $ext->add($context, '_[*#0-9]!','', new ext_agi('camere.php,${CALLERID(number)},${EXTEN}'));

                            $ext->add($context, $cleanroom,'', new ext_agi('set-reception-lang.php'));
                            $ext->add($context, $cleanroom,'', new ext_answer(''));
                            $ext->add($context, $cleanroom,'', new ext_agi('cleanRoom.php,${CALLERID(number)},1') );
                            $ext->add($context, $cleanroom,'', new ext_hangup() );
                        }
                        $configalarm = $fcc7->getCodeActive();
                        if($configalarm) {
                            $context = 'camere';
                            $ext->add($context, $configalarm,'', new ext_agi('set-room-lang.php,${CALLERID(number)}'));
                            $ext->add($context, $configalarm,'', new ext_answer(''));
                            $ext->add($context, $configalarm,'', new ext_agi('configAlarm.php,${CALLERID(number)},0'));
                            $ext->add($context, $configalarm,'', new ext_hangup());
                        }
                        $inspected_vacant = $fcc8->getCodeActive();
                        if($inspected_vacant) {
                            $context = 'camere';
                            $ext->add($context, $inspected_vacant,'', new ext_system('/usr/share/neth-hotel-fias/re2pms.php ${CALLERID(number):-3} 5'));
                            $ext->add($context, $inspected_vacant,'', new ext_noop('Room ${CALLERID(number):-3} status is now Inspected/Vacant'));
                            $ext->add($context, $inspected_vacant,'', new ext_playback('activated'));
                            $ext->add($context, $inspected_vacant,'', new ext_hangup());
                        }
                        $inspected_occupied = $fcc9->getCodeActive();
                        if($inspected_occupied) {
                            $context = 'camere';
                            $ext->add($context, $inspected_occupied,'', new ext_system('/usr/share/neth-hotel-fias/re2pms.php ${CALLERID(number):-3} 6'));
                            $ext->add($context, $inspected_occupied,'', new ext_noop('Room ${CALLERID(number):-3} status is now Inspected/Occupied'));
                            $ext->add($context, $inspected_occupied,'', new ext_playback('activated'));
                            $ext->add($context, $inspected_occupied,'', new ext_hangup());
                        }
                        $context = 'sveglia';
                        $ext->add($context, 's', '', new  ext_noop('Sveglia'));
                        $ext->add($context, 's', '', new  ext_playback('beep'));
                        $ext->add($context, 's', '', new  ext_agi('set-room-lang.php,${CALLERID(number)}'));
                        $ext->add($context, 's', '', new  ext_agi('alarmsuccess.php,${CAMERA},${ALARM}'));
                        $ext->add($context, 's', '', new  ext_playback('alarm/sonoleore'));
                        $ext->add($context, 's', '', new  ext_sayunixtime(',,R'));
                        $ext->add($context, 's', '', new  ext_playback('minutes'));
                        $ext->add($context, 's', '', new  ext_musiconhold());
                        $ext->add($context, 's', '', new  ext_noop('FineSveglia'));

                        $ext->add($context, 'failed', '', new  ext_noop('Chiamata non risposta - ALLARME'));
                        $ext->add($context, 'failed', '', new  ext_agi('svegliafallita.php,${CAMERA},${ALARM},${RECEPTION}'));
                        $ext->add($context, 'failed', '', new  ext_hangup());

                        $context = 'allarmesveglia';
                        $ext->add($context, 's', '', new  ext_noop('AllarmeSveglia'));
                        $ext->add($context, 's', '', new  ext_agi('set-reception-lang.php'));
                        $ext->add($context, 's', '', new  ext_playback('alarm/sveglianonrisposta'));
                        $ext->add($context, 's', '', new  ext_agi('set-reception-lang.php'));
                        $ext->add($context, 's', '', new  ext_playback('alarm/camera'));
                        $ext->add($context, 's', '', new  ext_saydigits('${CAMERA}'));
                        $ext->add($context, 's', '', new  ext_playback('hours'));
                        $ext->add($context, 's', '', new  ext_sayunixtime('${ALARM},,R'));
                        $ext->add($context, 's', '', new  ext_playback('minutes'));
                        $ext->add($context, 's', '', new  ext_musiconhold());
                        $ext->add($context, 's', '', new  ext_noop('FineAllarmeSveglia'));

                        $ext->addInclude('from-internal-additional','hotel-services');
		break;
	}
	unset($fcc1);
	unset($fcc2);
	unset($fcc3);
	unset($fcc4);
	unset($fcc5);
	unset($fcc6);
	unset($fcc7);
	
}
