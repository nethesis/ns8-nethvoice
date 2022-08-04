 <?php /* $Id */
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2013-2015 Sangoma Technologies.
$view = isset($_REQUEST['view'])?$_REQUEST['view']:'';
switch ($view) {
  case 'form':
    $content = load_view(__DIR__.'/views/form.php');
    $bootnav = load_view(__DIR__.'/views/bootnav.php', array('view'=>$view));
  break;

  default:
    $content = load_view(__DIR__.'/views/grid.php');
    $bootnav = '';
  break;
}

$helptext = _('DISA is used to allow people from the outside world to call into your PBX and then be able to dial out of the PBX so it appears that their call is coming from the office which can be handy when traveling. You can set a destination in an IVR that points to the DISA or set a DID. Make sure you password protect this to keep people from dialing in and using your PBX to make calls out.');
?>
<div class="container-fluid">
	<h1><?php echo _('DISA')?></h1>
	<div class="alert alert-info">
		<?php echo $helptext?>
	</div>
	<div class = "display full-border">
		<div class="row">
			<div class="col-sm-12">
				<div class="fpbx-container">
					<div class="display full-border">
						<?php echo $content?>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
