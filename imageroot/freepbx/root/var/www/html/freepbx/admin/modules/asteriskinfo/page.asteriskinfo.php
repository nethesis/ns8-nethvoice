<?php
namespace FreePBX\modules;
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
$astinfo = \FreePBX::create()->Asteriskinfo;
$request = $_REQUEST;
$dispnum = 'asteriskinfo'; //used for switch on config.php
$astman = $astinfo->astman;

//Failsafe. module.xml should prevent the need for this.
if(!$astman->connected()){
	echo '<div class = "alert alert-error">'._("Asterisk doesn't appear to be running").'</div>';
	return;
}

$action = isset($_REQUEST['action'])?$_REQUEST['action']:'';
$extdisplay = !empty($_REQUEST['extdisplay'])?$_REQUEST['extdisplay']:'summary';
$chan_dahdi = ast_with_dahdi();
$modesummary = _("Summary");
$moderegistries = _("Registries");
$modechannels = _("Channels");
$modepeers = _("Peers");
$modesip = _("Chan_Sip Info");
$modepjsip = _("Chan_PJSip Info");
$modeiax = _("IAX Info");
$modeconferences = _("Conferences");
$modequeues = _("Queues");
$modesubscriptions = _("Subscriptions");
$modedahdi = _("Dahdi");
$modeall = _("Full Report");
$uptime = _("Uptime");
$activechannels = _("Active Channel(s)");
$sipchannels = _("Chan_Sip Channel(s)");
$pjsipchannels = _("Chan_PJSip Channel(s)");
$iax2channels = _("IAX2 Channel(s)");
$iax2peers = _("IAX2 Peers");
$sipregistry = _("Chan_Sip Registry");
$pjsipregistry = _("Chan_PJSip Registrations");
$pjsiptransports = _("Chan_PJSip Transports");
$pjsipcontacts = ("Chan_PJSip Contacts");
$pjsipauths = ("Chan_PJSip Auths");
$pjsipaors = ("Chan_PJSip AORs");
$sippeers = _("Chan_Sip Peers");
$pjsipendpoints = _("Chan_PJSip Endpoints");
$iax2registry = _("IAX2 Registry");
$subscribenotify = _("Subscribe/Notify");
$dahdidriverinfo = _("DAHDi Channels");
$dahdipriinfo = _("Dahdi PRI Spans");
$conf_meetme = _("MeetMe Conference Info");
$conf_confbridge = _("Conference Bridge Info");
$queuesinfo = _("Queues Info");
$voicemailusers = _("Voicemail Users");
$gtalkchannels = _("Google Talk Channels");
$jabberconnections = _("Jabber Connections");
$xmppconnections = _("Motif Connections");

$modes = array(
	"summary" => $modesummary,
	"registries" => $moderegistries,
	"channels" => $modechannels,
	"peers" => $modepeers,
	"sip" => $modesip,
	"pjsip" => $modepjsip,
	"iax" => $modeiax,
	"conferences" => $modeconferences,
	"subscriptions" => $modesubscriptions,
	"voicemail" => $voicemailusers,
	"queues" => $modequeues
);
if ($chan_dahdi){
	$modes["dahdi"] = $modedahdi;
}
//Make sure "ALL" is the last item.
$modes["all"] = $modeall;

$hooktabs = $hookall = '';
$hooks = $astinfo->asteriskInfoHooks();
if(!empty($hooks) && is_array($hooks)) {
	foreach ($hooks as $hook) {
		if(!isset($hook['title'])){
			continue;
		}
		if(!isset($hook['mode'])){
			continue;
		}
		if(!isset($hook['commands'])){
			continue;
		}
		$modes[$hook['mode']] = $hook['title'];
		$hookhtml = '<h2>'.$hook['title'].'</h2>';
		if(!empty($hook['commands']) && is_array($hook['commands'])) {
			foreach ($hook['commands'] as $key => $value) {
				$output = $astinfo->getOutput($value);
				$hookhtml .= load_view(__DIR__.'/views/panel.php', array('title' => $key, 'body' => $output));
			}
		}
		$hooktabs .= '<div role="tabpanel" id="'.$hook['mode'].'" class="tab-pane">';
		$hooktabs .= $hookhtml;
		$hooktabs .= '</div>';
		$hookall .= $hookhtml;
	}
}

$engineinfo = engine_getinfo();
$astver =  $engineinfo['version'];
$meetme_check = $astman->send_request('Command', array('Command' =>
	'module show like meetme'));
$confbridge_check = $astman->send_request('Command', array('Command' =>
	'module show like confbridge'));
$meetme_module = preg_match('/[1-9] modules loaded/', $meetme_check['data']);
$confbridge_module = preg_match('/[1-9] modules loaded/', $confbridge_check['data']);
if ($meetme_module) {
	$arr_conferences[$conf_meetme]="meetme list";
}
if ($confbridge_module) {
	$arr_conferences[$conf_confbridge]="confbridge list";
}

$jabber_mod_check = $astman->send_request('Command', array('Command' =>
	'module show like jabber'));
$gtalk_mod_check = $astman->send_request('Command', array('Command' =>
	'module show like gtalk'));
$xmpp_mod_check = $astman->send_request('Command', array('Command' =>
	'module show like xmpp'));
$jabber_module = preg_match('/[1-9] modules loaded/', $jabber_mod_check['data']);
$gtalk_module = preg_match('/[1-9] modules loaded/', $gtalk_mod_check['data']);
$xmpp_module = preg_match('/[1-9] modules loaded/', $xmpp_mod_check['data']);
$arr_channels[$activechannels]="core show channels";
$arr_subscriptions[$subscribenotify]="core show hints";
$arr_voicemail[$voicemailusers]="voicemail show users";
$arr_queues[$modequeues]="queue show";
if ($gtalk_module) {
	$arr_channels[$gtalkchannels]="gtalk show channels";
}
if ($jabber_module) {
	$arr_registries[$jabberconnections]="jabber show connected";
}

if (version_compare($astver, '11', 'ge')) {
	if ($xmpp_module) {
		$arr_registries[$xmppconnections] = "xmpp show connections";
	}
}

if (version_compare($astver, '12', 'ge')) {
	//PJSIP
	$pjsip_mod_check = $astman->send_request('Command', array('Command' => 'module show like chan_pjsip'));
	$pjsip_module = preg_match('/[1-9] modules loaded/', $pjsip_mod_check['data']);
	if ($pjsip_module) {
		$arr_channels[$pjsipchannels] = "pjsip show channels";
		$arr_registries[$pjsipregistry] = "pjsip show registrations";
		$arr_peers[$pjsipendpoints] = "pjsip show endpoints";
		$arr_pjsip[$pjsipchannels] = "pjsip show channels";
		$arr_pjsip[$pjsipregistry] = "pjsip show registrations";
		$arr_pjsip[$pjsipendpoints] = "pjsip show endpoints";
	} else {
		unset($modes['pjsip']);
	}
}
//SIP
$sip_mod_check = $astman->send_request('Command', array('Command' => 'module show like chan_sip'));
$sip_module = preg_match('/[1-9] modules loaded/', $sip_mod_check['data']);
if ($sip_module) {
	$arr_channels[$sipchannels] = "sip show channels";
	$arr_registries[$sipregistry] = "sip show registry";
	$arr_peers[$sippeers] = "sip show peers";
	$arr_sip[$sipchannels] = "sip show channels";
	$arr_sip[$sipregistry] = "sip show registry";
	$arr_sip[$sippeers] = "sip show peers";
} else {
	unset($modes['sip']);
}
//IAX2
$arr_channels[$iax2channels] = "iax2 show channels";
$arr_registries[$iax2registry] = "iax2 show registry";
$arr_peers[$iax2peers] = "iax2 show peers";
$arr_iax[$iax2channels] = "iax2 show channels";
$arr_iax[$iax2registry] = "iax2 show registry";
$arr_iax[$iax2peers] = "iax2 show peers";
//DAHDi
if ($chan_dahdi){
	$arr_channels[$dahdidriverinfo]="dahdi show channels";
	$arr_dahdi[$dahdidriverinfo]="dahdi show channels";
	$arr_dahdi[$dahdipriinfo]="pri show spans";
}
$amerror = '<div class="well well-warning">';
$amerror .= _("The module was unable to connect to the Asterisk manager.<br>Make sure Asterisk is running and your manager.conf settings are proper.<br><br>");
$amerror .= '</div>';
//Registries
$registrieshtml = '<h2>'.$moderegistries.'</h2>';
$output = '';
$arr_registries = !empty($arr_registries)&&is_array($arr_registries)?$arr_registries:array();
foreach ($arr_registries as $key => $value) {
	$output = $astinfo->getOutput($value);
	$registrieshtml .= load_view(__DIR__.'/views/panel.php', array('title' => $key, 'body' => $output));
}
//Channels
$channelshtml = '<h2>'.$modechannels.'</h2>';
$arr_channels = !empty($arr_channels)&&is_array($arr_channels)?$arr_channels:array();
foreach ($arr_channels as $key => $value) {
	$output = $astinfo->getOutput($value);
	$channelshtml .= load_view(__DIR__.'/views/panel.php', array('title' => $key, 'body' => $output));
}
//Peers
$peershtml = '<h2>'.$modepeers.'</h2>';
$arr_peers = !empty($arr_peers)&&is_array($arr_peers)?$arr_peers:array();
foreach ($arr_peers as $key => $value) {
	$output = $astinfo->getOutput($value);
	$peershtml .= load_view(__DIR__.'/views/panel.php', array('title' => $key, 'body' => $output));
}
//SIP
if(isset($modesip)){
	$siphtml = '<h2>'.$modesip.'</h2>';
	$arr_sip = !empty($arr_sip)&&is_array($arr_sip)?$arr_sip:array();
	foreach ($arr_sip as $key => $value) {
		$output = $astinfo->getOutput($value);
		$siphtml .= load_view(__DIR__.'/views/panel.php', array('title' => $key, 'body' => $output));
	}
}
//PJSIP
if(isset($modepjsip)){
	$pjsiphtml = '<h2>'.$modepjsip.'</h2>';
	$arr_pjsip = !empty($arr_pjsip)&&is_array($arr_pjsip)?$arr_pjsip:array();
	foreach ($arr_pjsip as $key => $value) {
		$output = $astinfo->getOutput($value);
		$pjsiphtml .= load_view(__DIR__.'/views/panel.php', array('title' => $key, 'body' => $output));
	}
}
//IAX
$iaxhtml = '<h2>'.$modeiax.'</h2>';
$arr_iax = !empty($arr_iax)&&is_array($arr_iax)?$arr_iax:array();
foreach ($arr_iax as $key => $value) {
	$output = $astinfo->getOutput($value);
	$iaxhtml .= load_view(__DIR__.'/views/panel.php', array('title' => $key, 'body' => $output));
}
//conferences
$conferenceshtml = '<h2>'.$modeconferences.'</h2>';
$arr_conferences = !empty($arr_conferences)&&is_array($arr_conferences)?$arr_conferences:array();
foreach ($arr_conferences as $key => $value) {
	$output = $astinfo->getOutput($value);
	$conferenceshtml .= load_view(__DIR__.'/views/panel.php', array('title' => $key, 'body' => $output));
}

//subscriptions
$subscriptionshtml = '<h2>'.$modesubscriptions.'</h2>';
$arr_subscriptions = !empty($arr_subscriptions)&&is_array($arr_subscriptions)?$arr_subscriptions:array();
foreach ($arr_subscriptions as $key => $value) {
	$output = $astinfo->getOutput($value);
	$subscriptionshtml .= load_view(__DIR__.'/views/panel.php', array('title' => $key, 'body' => $output));
}

//voicemail
$voicemailhtml = '<h2>'.$voicemailusers.'</h2>';
$arr_voicemail = !empty($arr_voicemail)&&is_array($arr_voicemail)?$arr_voicemail:array();
foreach ($arr_voicemail as $key => $value) {
	$output = $astinfo->getOutput($value);
	$voicemailhtml .= load_view(__DIR__.'/views/panel.php', array('title' => $key, 'body' => $output));
}

//queues
$queueshtml = '<h2>'.$modequeues.'</h2>';
$arr_queues = !empty($arr_queues)&&is_array($arr_queues)?$arr_queues:array();
foreach ($arr_queues as $key => $value) {
	$output = $astinfo->getOutput($value);
	$queueshtml .= load_view(__DIR__.'/views/panel.php', array('title' => $key, 'body' => $output));
}
if ($chan_dahdi){
	//Dahdi
	$dahdihtml = '<h2>'.$modedahdi.'</h2>';
	$arr_dahdi = !empty($arr_dahdi)&&is_array($arr_dahdi)?$arr_dahdi:array();
	foreach ($arr_dahdi as $key => $value) {
		$output = $astinfo->getOutput($value);
		$dahdihtml .= load_view(__DIR__.'/views/panel.php', array('title' => $key, 'body' => $output));
	}
}
?>
<div class="container-fluid">
	<h1><?php echo _("Asterisk Info")?></h1>
	<div class="alert alert-info">
		<?php echo _('This page supplies various information about Asterisk')?><br/>
		<b><?php echo _("Current Asterisk Version:")?></b> <?php echo $astver ?>
	</div>
	<?php echo (!$astman)?$amerror:'';?>
	<div class = "display full-border">
		<div class="row">
			<div class="col-sm-9">
					<div class="fpbx-container">
						<div class="tab-content display full-border">
							<div role="tabpanel" id="summary" class="tab-pane active">
								<h2><?php echo _("Summary")?></h2>
								<table class="table">
									<tr>
										<td>
											<?php echo $astinfo->buildAsteriskInfo(); ?>
										</td>
									</tr>
								</table>
							</div>
							<div role="tabpanel" id="registries" class="tab-pane">
								<?php echo $registrieshtml?>
							</div>
							<div role="tabpanel" id="channels" class="tab-pane">
								<?php echo $channelshtml?>
							</div>
							<div role="tabpanel" id="peers" class="tab-pane">
								<?php echo $peershtml?>
							</div>
							<div role="tabpanel" id="sip" class="tab-pane">
								<?php echo $siphtml?>
							</div>
							<div role="tabpanel" id="pjsip" class="tab-pane">
							<?php echo $pjsiphtml?>
							</div>
							<div role="tabpanel" id="iax" class="tab-pane">
								<?php echo $iaxhtml?>
							</div>
							<div role="tabpanel" id="conferences" class="tab-pane">
								<?php echo $conferenceshtml?>
							</div>
							<div role="tabpanel" id="subscriptions" class="tab-pane">
								<?php echo $subscriptionshtml?>
							</div>
							<div role="tabpanel" id="dahdi" class="tab-pane">
								<?php echo $dahdihtml?>
							</div>
							<div role="tabpanel" id="voicemail" class="tab-pane">
								<?php echo $voicemailhtml?>
							</div>
							<div role="tabpanel" id="queues" class="tab-pane">
								<?php echo $queueshtml?>
							</div>
							<?php echo $hooktabs ?>
							<div role="tabpanel" id="all" class="tab-pane">
								<?php echo $registrieshtml ?>
								<?php echo $channelshtml ?>
								<?php echo $peershtml ?>
								<?php echo $siphtml ?>
								<?php echo $pjsiphtml ?>
								<?php echo $iaxhtml ?>
								<?php echo $dahdihtml ?>
								<?php echo $conferenceshtml ?>
								<?php echo $subscriptionshtml ?>
								<?php echo $voicemailhtml ?>
								<?php echo $queueshtml ?>
								<?php echo $hookall ?>
							</div>
						</div>
					</div>
				</div>
				<div class="col-sm-3 bootnav">
					<div class="list-group">
						<?php echo load_view(__DIR__.'/views/bootnav.php', array('modes' => $modes, 'extdisplay' => $extdisplay)); ?>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
