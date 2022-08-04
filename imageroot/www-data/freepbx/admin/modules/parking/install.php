<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
global $db;
//for translation only
if (false) {
  _("Pickup ParkedCall Any");
  _("Park Prefix");
  _("Pickup ParkedCall Prefix");
  _("Defines the Feature Code to use for Direct Call Pickup");
  _('Parks to your Assigned Lot if using Park Pro. If using standard parking this parks to the default lot');
}

$fcc = new featurecode('parking', 'parkedcall');
$fcc->setDescription('Pickup ParkedCall Prefix');
$fcc->setHelpText(_('Defines the Feature Code to use to force pickup a call that is parked in a private lot that the extension picking up the call does not have permissions for.  Example if a caller is parked in slot 81 and extension 8001 does not have permission to that private lot they could dial *8581 to pickup the parked call.'));
$fcc->setDefault('*85');
$fcc->setProvideDest();
$fcc->update();
unset($fcc);

$fcc = new featurecode('parking', 'parkto');
$fcc->setDescription(_('Park to your Assigned Lot'));
$fcc->setHelpText(_('Parks to your Assigned Lot if using Park Pro. If using standard parking this parks to the default lot'));
$fcc->setDefault('*88');
$fcc->setProvideDest();
$fcc->update();
unset($fcc);

$table = \FreePBX::Database()->migrate("parkplus");
$cols = array (
  'id' =>
  array (
    'type' => 'bigint',
    'primaryKey' => true,
    'autoincrement' => true,
  ),
  'defaultlot' =>
  array (
    'type' => 'string',
    'length' => '10',
    'default' => 'no',
  ),
  'type' =>
  array (
    'type' => 'string',
    'length' => '10',
    'default' => 'public',
  ),
  'name' =>
  array (
    'type' => 'string',
    'length' => '40',
    'default' => '',
  ),
  'parkext' =>
  array (
    'type' => 'string',
    'length' => '40',
    'default' => '',
  ),
  'parkpos' =>
  array (
    'type' => 'string',
    'length' => '40',
    'default' => '',
  ),
  'numslots' =>
  array (
    'type' => 'integer',
    'default' => '4',
  ),
  'parkingtime' =>
  array (
    'type' => 'integer',
    'default' => '45',
  ),
  'parkedmusicclass' =>
  array (
    'type' => 'string',
    'length' => '100',
    'notnull' => false,
    'default' => 'default',
  ),
  'generatefc' =>
  array (
    'type' => 'string',
    'length' => '10',
    'default' => 'yes',
  ),
  'findslot' =>
  array (
    'type' => 'string',
    'length' => '10',
    'default' => 'first',
  ),
  'parkedplay' =>
  array (
    'type' => 'string',
    'length' => '10',
    'default' => 'both',
  ),
  'parkedcalltransfers' =>
  array (
    'type' => 'string',
    'length' => '10',
    'default' => 'caller',
  ),
  'parkedcallreparking' =>
  array (
    'type' => 'string',
    'length' => '10',
    'default' => 'caller',
  ),
  'alertinfo' =>
  array (
    'type' => 'string',
    'length' => '254',
    'default' => '',
  ),
	'rvolume' =>
	array (
		'type' => 'string',
		'length' => '2',
		'default' => '',
	),
  'cidpp' =>
  array (
    'type' => 'string',
    'length' => '100',
    'default' => '',
  ),
  'autocidpp' =>
  array (
    'type' => 'string',
    'length' => '10',
    'default' => 'none',
  ),
  'announcement_id' =>
  array (
    'type' => 'integer',
    'notnull' => false,
  ),
  'comebacktoorigin' =>
  array (
    'type' => 'string',
    'length' => '10',
    'default' => 'yes',
  ),
  'dest' =>
  array (
    'type' => 'string',
    'length' => '100',
    'default' => 'app-blackhole,hangup,1',
  ),
);


$indexes = array (
);
$table->modify($cols, $indexes);
unset($table);

$sql = "SELECT * FROM parkplus WHERE defaultlot = 'yes'";
$default_lot = sql($sql,"getAll",DB_FETCHMODE_ASSOC);

// There should never be more than a single default lot so just blow them
// all away if we or esomeone did something dumb.
if (count($default_lot) > 1) {
	out(_("ERROR: too many default lots detected, deleting and reinitializing"));
	$sql = "DELETE FROM parkplus WHERE defaultlot = 'yes'";
	sql($sql);
	//We deleted all default lots to we need to trick the system into reinstalling the default lot!
	$default_lot = 0;
}

//If we have a default parking lot and we are within the new verion then we should check to make sure destination isn't blank
if(count($default_lot) == 1 && empty($default_lot[0]['dest'])) {
	$sql = "UPDATE parkplus SET dest = 'app-blackhole,hangup,1' WHERE defaultlot = 'yes'";
	sql($sql);
}

//Add default parking lot or try to migrate the old one.
if (count($default_lot) == 0) {

	outn(_("Initializing default parkinglot.."));
	$sql = "INSERT INTO parkplus (id, defaultlot, name, parkext, parkpos, numslots) VALUES (1, 'yes', '"._('Default Lot')."', '70', '71', 8)";
	sql($sql);
	out(_("done"));

	$sql = "SELECT keyword,data FROM parkinglot WHERE id = '1'";
	$results = $db->getAssoc($sql);
	if (!DB::IsError($results)) {

		out(_("migrating old parkinglot data"));

		$var['name'] = "Default Lot";
		$var['type'] = 'public';
		$var['parkext'] = '';
		$var['parkpos'] = '';
		$var['numslots'] = 4;
		$var['parkingtime'] = 45;
		$var['parkedmusicclass'] = 'default';
		$var['generatehints'] = 'yes';
		$var['generatefc'] = 'yes';
		$var['findslot'] = 'first';
		$var['parkedplay'] = 'both';
		$var['parkedcalltransfers'] = 'caller';
		$var['parkedcallreparking'] = 'caller';
		$var['alertinfo'] = '';
		$var['cidpp'] = '';
		$var['autocidpp'] = 'none';
		$var['announcement_id'] = null;
		$var['comebacktoorigin'] = 'yes';
		$var['dest'] = '';

		foreach ($results as $set => $val) {
			switch($set) {
			case 'numslots':
			case 'parkingtime':
			case 'parkedplay':
			case 'parkedcalltransfers':
			case 'parkedcallreparking':
			case 'parkedmusicclass':
			case 'findslot':
				$var[$set] = $val;
				break;
			case 'parkext':
				$var[$set] = $val;
				$var['parkpos'] = $val + 1;
				break;
			case 'parkalertinfo':
				$var['alertinfo'] = $val;
				break;
			case 'parkcid':
				$var['cidpp'] = $val;
				break;
			case 'parkingannmsg_id':
				$var['announcement_id'] = $val;
				break;
			case 'goto':
				$var['dest'] = $val;
				break;
			case 'parkinghints':
				$var['generatehints'] = $val;
				break;
			case 'parking_dest':
				$var['comebacktoorigin'] = ($val == 'device' ? 'yes' : 'no');
				break;
			default:
				/* parkedcallhangup
					 parkedcallrecording
					 adsipark
					 parkingcontext
				 */
				out(sprintf(_("%s no longer supported"),$set));
				break;
			}
		}

		foreach ($var as $key => $value) {
			$sql = "UPDATE parkplus SET `$key` = " . q($value) . " WHERE defaultlot = 'yes'";
			sql($sql);
		}

		out(_("migrated ... dropping old table parkinglot"));
		sql('DROP TABLE IF EXISTS parkinglot');
		unset($var);
		unset($results);
	}
}
