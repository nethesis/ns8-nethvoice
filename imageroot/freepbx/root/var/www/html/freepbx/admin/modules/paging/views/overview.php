<?php
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
//
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
$helptext = _("This module is for specific phones that are capable of Paging or Intercom. This section is for configuring group paging, intercom is configured through <strong>Feature Codes</strong>. Intercom must be enabled on a handset before it will allow incoming calls. It is possible to restrict incoming intercom calls to specific extensions only, or to allow intercom calls from all extensions but explicitly deny from specific extensions.<br /><br />This module should work with Aastra, Grandstream, Linksys/Sipura, Mitel, Polycom, SNOM , and possibly other SIP phones (not ATAs). Any phone that is always set to auto-answer should also work (such as the console extension if configured).");
$title = _("Paging and Intercom");
$request = $_REQUEST;
?>
<div class="container-fluid">
	<h1><?php echo $title ?></h1>
	<div class="well well-info">
		<?php echo $helptext?>
	</div>
	<div class = "display full-border">
		<div class="row">
			<div class="col-sm-12">
				<div class="fpbx-container">
						<ul class="nav nav-tabs" role="tablist">
							<li role="presentation" data-name="groups" class="active">
								<a href="#groups" aria-controls="groups" role="tab" data-toggle="tab">
									<?php echo _("Paging Groups")?>
								</a>
							</li>
							<li role="presentation" data-name="tab2" class="change-tab">
								<a href="#settings" aria-controls="settings" role="tab" data-toggle="tab">
									<?php echo _("Settings")?>
								</a>
							</li>
						</ul>
						<div class="tab-content display">
							<div role="tabpanel" id="groups" class="tab-pane active">
								<?php echo load_view(__DIR__.'/grid.php', array('request' => $request ))?>
							</div>
							<div role="tabpanel" id="settings" class="tab-pane">
								<?php echo load_view(__DIR__.'/settings.php', array('request' => $request ))?>
							</div>
						</div>
				</div>
			</div>
		</div>
	</div>
</div>
