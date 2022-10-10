<?php
global $currentcomponent;
$device_info = core_devices_get($_REQUEST['extdisplay']);
if (empty($device_info)) {
    $cc = 'from-internal';
} else {
  $tech = $device_info['tech'];
  switch ($tech) {
    case 'pjsip':
    case 'iax2':
    case 'iax':
    case 'sip':
    case 'dahdi':
    case 'zap':
      $_REQUEST['tech'] = $tech;
      $cc = $device_info['context'];
    break;
    default:
      $cc = 'from-internal';
  }
}
$contextssel  = customcontexts_getcontexts();
$currentcomponent->addoptlistitem('contextssel', 'from-internal', _('ALLOW ALL (Default)'));
$curcontext = !empty($cc)?$cc:'from-internal';
$contextssel = is_array($contextssel)?$contextssel:array();
foreach ($contextssel as $val) {
  $currentcomponent->addoptlistitem('contextssel', $val[0], $val[1]);
}
$category = 'advanced';

if ( $_REQUEST['display'] == 'extensions' ) {
	$section = (isset($_REQUEST['extdisplay']) ? modgettext::_("Edit Extension",'core') : modgettext::_("Add Extension",'core'));
} else {
	$section = (isset($_REQUEST['extdisplay']) ? modgettext::_("Edit User",'core') : modgettext::_("Add User",'core'));
}

$currentcomponent->setoptlistopts('contextssel', 'sort', false);
$currentcomponent->addguielem($section, new gui_selectbox('customcontext', $currentcomponent->getoptlist('contextssel'), $curcontext, _('Custom Context'), sprintf(_('You can select a custom context from this list to limit this user to portions of the dialplan you defined in the %s module.'),customcontexts_getmodulevalue('moduledisplayname')),false), 4, null, $category);
$js = '<script type="text/javascript" id="customcontext_js">$(document).ready(function() {$("#devinfo_context").parents(".element-container").remove();$("#customcontext").attr("name","devinfo_context");$("#customcontext_js").parents(".element-container").remove();});</script>';
$currentcomponent->addguielem($section, new guielement('test-html', $js, ''),4, null, $category);
