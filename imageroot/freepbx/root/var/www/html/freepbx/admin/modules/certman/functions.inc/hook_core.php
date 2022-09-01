<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2014 Schmooze Com Inc.
//
function certman_configpageinit($pagename) {
	global $currentcomponent;
	global $amp_conf;

	$display = isset($_REQUEST['display'])?$_REQUEST['display']:null;
	$action = isset($_REQUEST['action'])?$_REQUEST['action']:null;
	$extdisplay = isset($_REQUEST['extdisplay'])?$_REQUEST['extdisplay']:null;
	$extension = isset($_REQUEST['extension'])?$_REQUEST['extension']:null;
	$tech_hardware = isset($_REQUEST['tech_hardware'])?$_REQUEST['tech_hardware']:null;
	$supported_hardware = array('sip','pjsip');

	// We only want to hook the 'extensions' pages.
	if ($pagename != 'extensions' && $pagename != 'devices')  {
		return true;
	}

	$certs = FreePBX::Certman()->getAllManagedCertificates();
	if(!empty($certs)) {
		// On a 'new' user, 'tech_hardware' is set, and there's no extension. Hook into the page.
		if ($tech_hardware != null || $pagename == 'users') {
			$currentcomponent->addguifunc("certman_devices_configpageload");
			$currentcomponent->addprocessfunc("certman_devices_configprocess");
		} elseif ($action=="add") {
			// We don't need to display anything on an 'add', but we do need to handle returned data.
			$currentcomponent->addprocessfunc("certman_devices_configprocess");
		} elseif ($extdisplay != '') {
			// We're now viewing an extension, so we need to display _and_ process.
			$currentcomponent->addguifunc("certman_devices_configpageload");
			$currentcomponent->addprocessfunc("certman_devices_configprocess");
		}
	}
}

function certman_devices_configpageload() {
	certman_configpageload('extension');
}

function certman_configpageload($mode) {
	global $amp_conf;
	global $currentcomponent;
	$extdisplay = isset($_REQUEST['extdisplay'])?$_REQUEST['extdisplay']:null;
	$currentcomponent->setoptlistopts('dtls_enable', 'sort', false);

	$section = "DTLS";
	$category = "advanced";

	$settings = FreePBX::Certman()->getDTLSOptions($extdisplay);
	$currentcomponent->addguielem($section, new gui_selectbox(
		'dtls_enable',
		array(
			array("text" => "No", "value" => "no"),
			array("text" => "Yes","value" => "yes")
		),
		$settings['enable'],
		_('Enable DTLS'),
		_('Enable or disable DTLS-SRTP support'),
		false),6,null,$category
	);
	$certs = array();
	foreach(FreePBX::Certman()->getAllManagedCertificates() as $cert) {
		$certs[] = array(
			"text" => $cert['basename'],
			"value" => $cert['cid']
		);
	}
	$currentcomponent->addguielem($section, new gui_selectbox(
		'dtls_certificate',
		$certs,
		isset($settings['cid']) ? $settings['cid'] : '',
		_('Use Certificate'),
		_("The Certificate to use from Certificate Manager"),
		false),6,null,$category
	);
	$currentcomponent->addguielem($section, new gui_selectbox(
		'dtls_verify',
		array(
			array("text" => "Yes","value" => "yes"),
			array("text" => "No", "value" => "no"),
			array("text" => "Fingerprint","value" => "fingerprint"),
			array("text" => "Certificate","value" => "certificate")
		),
		$settings['verify'],
		_('DTLS Verify'),
		_("Verify that provided peer certificate and fingerprint are valid
		<ul>
			<li>A value of 'yes' will perform both certificate and fingerprint verification</li>
			<li>A value of 'no' will perform no certificate or fingerprint verification</li>
			<li>A value of 'fingerprint' will perform ONLY fingerprint verification</li>
			<li>A value of 'certificate' will perform ONLY certficiate verification</li>
			</ul>"),
		false),6,null,$category
	);
	$currentcomponent->addguielem($section, new gui_selectbox(
		'dtls_setup',
		array(
			array("text" => "Act/Pass","value" => "actpass"),
			array("text" => "Active", "value" => "active"),
			array("text" => "Passive","value" => "passive")
		),
		$settings['setup'],
		_('DTLS Setup'),
		_("Whether we are willing to accept connections, connect to the other party, or both.
		This value will be used in the outgoing SDP when offering and for incoming SDP offers when the remote party sends actpass
		<ul>
			<li>active (we want to connect to the other party)</li>
			<li>passive (we want to accept connections only)</li>
			<li>actpass (we will do both)</li>
			</ul>"),
		false),6,null,$category
	);
	//
	$currentcomponent->addguielem($section, new gui_textbox(
		'dtls_rekey',
		$settings['rekey'],
		_('DTLS Rekey Interval'),
		_('Interval at which to renegotiate the TLS session and rekey the SRTP session. If this is not set or the value provided is 0 rekeying will be disabled'),
		'',
		'',
		false),6,null,$category
	);
}

function certman_devices_configprocess() {
	$action = isset($_REQUEST['action'])?$_REQUEST['action']:null;
	$extension = isset($_REQUEST['extdisplay'])?$_REQUEST['extdisplay']:null;
	$tech = isset($_POST['tech'])?$_POST['tech']:null;
	switch ($action) {
		case 'add':
			$extension = isset($_REQUEST['extension']) ? $_REQUEST['extension'] : null;
		case 'edit':
			if($_POST['dtls_enable'] == 'yes') {
				$settings = array();
				foreach($_POST as $key => $value) {
					if(preg_match('/^dtls_(.*)/',$key,$matches)) {
						$settings[$matches[1]] = $value;
					}
				}
				FreePBX::Certman()->addDTLSOptions($extension,$settings);
			} else {
				FreePBX::Certman()->removeDTLSOptions($extension);
			}
		break;
		case 'del':
			FreePBX::Certman()->removeDTLSOptions($extension);
		break;
	}
}
