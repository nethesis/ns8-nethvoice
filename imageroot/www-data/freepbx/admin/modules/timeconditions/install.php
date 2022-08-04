<?php /* $Id: install.php $ */
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }

$fcc = new featurecode('timeconditions', 'toggle-mode-all');
$fcc->delete();
unset($fcc);

$freepbx_conf =& freepbx_conf::create();

// TCINTERVAL
//
$set['value'] = '60';
$set['defaultval'] =& $set['value'];
$set['readonly'] = 0;
$set['hidden'] = 0;
$set['level'] = 1;
$set['module'] = 'timeconditions';
$set['category'] = 'Time Condition Module';
$set['emptyok'] = 0;
$set['name'] = 'Maintenance Polling Interval';
$set['description'] = 'The polling interval in seconds used by the Time Conditions maintenance task, launched by an Asterisk call file used to update Time Conditions override states as well as keep custom device state hint values up-to-date when being used with BLF. A shorter interval will assure that BLF keys states are accurate. The interval should be less than the shortest configured span between two time condition states, so that a manual override during such a period is properly reset when the new period starts.';
$set['type'] = CONF_TYPE_SELECT;
$set['options'] = '60, 120, 180, 240, 300, 600, 900';
$freepbx_conf->define_conf_setting('TCINTERVAL',$set);

// TCMAINT
//
$set['value'] = true;
$set['defaultval'] =& $set['value'];
$set['readonly'] = 0;
$set['hidden'] = 0;
$set['level'] = 1;
$set['module'] = 'timeconditions';
$set['category'] = 'Time Condition Module';
$set['emptyok'] = 0;
$set['name'] = 'Enable Maintenance Polling';
$set['description'] = 'If set to false, this will override the execution of the Time Conditions maintenance task launched by call files. If all the feature codes for time conditions are disabled, the maintenance task will not be launched anyhow. Setting this to false would be fairly un-common. You may want to set this temporarily if debugging a system to avoid the periodic dialplan running through the CLI that the maintenance task launches and can be distracting.';
$set['type'] = CONF_TYPE_BOOL;
$freepbx_conf->define_conf_setting('TCMAINT',$set);

$freepbx_conf->commit_conf_settings();
