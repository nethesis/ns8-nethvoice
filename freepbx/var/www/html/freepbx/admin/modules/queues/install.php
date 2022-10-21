<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
global $db;
global $amp_conf;

// For translation only
if (false) {
	_("Queue Toggle");
	_("Queue Pause Toggle");
	_("Queue Callers");
}

// Add Feature Codes for Toggle Queues - Using *45
$fcc = new featurecode('queues', 'que_toggle');
$fcc->setDescription(_('Allow Dynamic Members of a Queue to login or logout. See the Queues Module for how to assign a Dynamic Member to a Queue.'));
$fcc->setDefault('*45');
$fcc->update();
unset($fcc);

// Add Feature Codes for Toggle Queue Pause- Using *46
$fcc = new featurecode('queues', 'que_pause_toggle');
$fcc->setDescription(_('Queue Pause Toggle'));
$fcc->setDefault('*46');
$fcc->update();
unset($fcc);

// Add Feature Codes for Queue Callers - Using *47
$fcc = new featurecode('queues', 'que_callers');
$fcc->setDescription(_('Playback Queue Caller Count'));
$fcc->setDefault('*47');
$fcc->update();
unset($fcc);


$freepbx_conf =& freepbx_conf::create();

// QUEUES_PESISTENTMEMBERS
//
$set['value'] = true;
$set['defaultval'] =& $set['value'];
$set['readonly'] = 1;
$set['hidden'] = 0;
$set['level'] = 0;
$set['module'] = 'queues';
$set['category'] = 'Queues Module';
$set['emptyok'] = 0;
$set['sortorder'] = 10;
$set['name'] = 'Persistent Members';
$set['description'] = 'Queues: persistentmembers. Store each dynamic member in each queue in the astdb so that when asterisk is restarted, each member will be automatically read into their recorded queues.';
$set['type'] = CONF_TYPE_BOOL;
$freepbx_conf->define_conf_setting('QUEUES_PESISTENTMEMBERS',$set);

// QUEUES_SHARED_LASTCALL
//
$set['value'] = true;
$set['defaultval'] =& $set['value'];
$set['readonly'] = 1;
$set['hidden'] = 0;
$set['level'] = 0;
$set['module'] = 'queues';
$set['category'] = 'Queues Module';
$set['emptyok'] = 0;
$set['sortorder'] = 20;
$set['name'] = 'Honor Wrapup Time Across Queues';
$set['description'] = 'Queues: shared_lastcall, only valid with Asterisk 1.6+. This will make the lastcall and calls received be the same in members logged in more than one queue. This is useful to make the queue respect the wrapuptime of another queue for a shared member.';
$set['type'] = CONF_TYPE_BOOL;
$freepbx_conf->define_conf_setting('QUEUES_SHARED_LASTCALL',$set);

$set['value'] = false;
$set['defaultval'] =& $set['value'];
$set['readonly'] = 0;
$set['hidden'] = 0;
$set['level'] = 0;
$set['module'] = 'queues';
$set['category'] = 'Queues Module';
$set['emptyok'] = 0;
$set['sortorder'] = 30;
$set['name'] = 'Set Agent Name in CDR dstchannel';
$set['description'] = 'Queues: updatecdr, only valid with Asterisk 1.6+. This option is implemented to mimic chan_agents behavior of populating CDR dstchannel field of a call with an agent name, which is set if available at the login time with AddQueueMember membername parameter, or with static members.';
$set['type'] = CONF_TYPE_BOOL;
$freepbx_conf->define_conf_setting('QUEUES_UPDATECDR',$set);

// QUEUES_MIX_MONITOR
//
$set['value'] = true;
$set['defaultval'] =& $set['value'];
$set['readonly'] = 0;
$set['hidden'] = 0;
$set['level'] = 0;
$set['module'] = 'queues';
$set['category'] = 'Queues Module';
$set['emptyok'] = 0;
$set['sortorder'] = 40;
$set['name'] = 'Use MixMonitor for Recordings';
$set['description'] = "Queues: monitor-type = MixMonitor. Setting true will use the MixMonitor application instead of Monitor so the concept of 'joining/mixing' the in/out files now goes away when this is enabled.";
$set['type'] = CONF_TYPE_BOOL;
$freepbx_conf->define_conf_setting('QUEUES_MIX_MONITOR',$set);

if($freepbx_conf->conf_setting_exists('QUEUES_HIDE_NOANSWER')) {
	$freepbx_conf->remove_conf_setting('QUEUES_HIDE_NOANSWER');
}

if($freepbx_conf->conf_setting_exists('GENERATE_LEGACY_QUEUE_CODES')) {
	$freepbx_conf->remove_conf_setting('GENERATE_LEGACY_QUEUE_CODES');
}

// QUEUES_EVENTS_WHEN_CALLED_DEFAULT
$set['value'] = false;
$set['defaultval'] =& $set['value'];
$set['readonly'] = 0;
$set['hidden'] = 0;
$set['level'] = 3;
$set['module'] = 'queues';
$set['category'] = 'Queues Module';
$set['emptyok'] = 0;
$set['sortorder'] = 120;
$set['name'] = 'Agent Called Events Default';
$set['description'] = 'Default state for AMI emit events related to an agent\'s call. This setting will only affect the default for NEW queues, it won\'t change existing queues or enfore the option on in new ones.';
$set['type'] = CONF_TYPE_BOOL;
$freepbx_conf->define_conf_setting('QUEUES_EVENTS_WHEN_CALLED_DEFAULT', $set, true);


// QUEUES_EVENTS_MEMEBER_STATUS_DEFAULT
$set['value'] = false;
$set['defaultval'] =& $set['value'];
$set['readonly'] = 0;
$set['hidden'] = 0;
$set['level'] = 3;
$set['module'] = 'queues';
$set['category'] = 'Queues Module';
$set['emptyok'] = 0;
$set['sortorder'] = 120;
$set['name'] = 'Member Status Event Default';
$set['description'] = 'Default state for AMI to emit the QueueMemberStatus event. This setting will only affect the default for NEW queues, it won\'t change existing queues or enfore the option on in new ones.';
$set['type'] = CONF_TYPE_BOOL;
$freepbx_conf->define_conf_setting('QUEUES_EVENTS_MEMEBER_STATUS_DEFAULT', $set, true);
