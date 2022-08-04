<?php
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2013 Schmooze Com Inc.
//
$cel = FreePBX::Cel();

if(empty($_REQUEST['action']) || $_REQUEST['action'] != 'getJSON'){
?>
<div class="container-fluid">
	<h1><?php echo _("Call Event Logging")?></h1>
	<div class="well well-info">
		<?php echo _("You may search by any or all of the fields below. The more fields you fill in the more refined the report.")?>
	</div>
	<div class = "display full-border">
		<div class="row">
			<div class="col-sm-12">
				<div class="fpbx-container">
					<div class="display full-border">
<?php } ?>
						<?php echo $cel->myShowPage(); ?>
<?php if(empty($_REQUEST['action']) || $_REQUEST['action'] != 'getJSON'){?>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
<?php }
