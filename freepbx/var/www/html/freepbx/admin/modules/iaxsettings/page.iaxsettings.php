<?php /* $Id:$ */
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
//  License for all code of this FreePBX module can be found in the license file inside the module directory
//  Copyright 2015 Sangoma Technologies.
//
$iaxsettings = FreePBX::Iaxsettings();
echo $iaxsettings->showPage();
