<?php
	if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
	//http://issues.freepbx.org/browse/FREEPBX-12816
?>

<nav class="navbar navbar-default">
	<div class="container-fluid">
    	<div class="navbar-header">
        	<a class="navbar-brand" href="#"><i class="fa fa-file-archive-o"></i></a>
		</div>
        
        <button type="button" class="navbar-btn btn btn-default" id="button_check_for_updates" name="button_check_for_updates" disabled="false"><i class="fa fa-refresh"></i> <?php echo _("Check for Update"); ?></button>
        
        <form class="nav navbar-form navbar-right" role="search">
            <div class="form-group">
                <input id="search" type="text" class="form-control" placeholder="<?php echo _("Search Model..."); ?>" />
            </div>
            <button class="btn btn-info btn-lg" type="button"><i class="fa fa-search" aria-hidden="true"></i></button>
        </form>
	</div>
</nav>
