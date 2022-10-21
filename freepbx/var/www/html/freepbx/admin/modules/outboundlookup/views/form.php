<?php
//Copyright (C) nethesis srl. (info@nethesis.it)
//
//This program is free software; you can redistribute it and/or
//modify it under the terms of the GNU General Public License
//as published by the Free Software Foundation; either version 2
//of the License, or (at your option) any later version.
//
//This program is distributed in the hope that it will be useful,
//but WITHOUT ANY WARRANTY; without even the implied warranty of
//MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//GNU General Public License for more details.

$thisItem = outboundlookup_get();

?>

<form autocomplete="off" class="fpbx-submit" name="edit" id="edit" action="<?php $_SERVER['PHP_SELF'] ?>" method="post" onsubmit="return edit_onsubmit();" data-fpbx-delete="config.php?display=outboundlookup&view=form&amp;itemid=<?php echo $itemid?>&amp;action=delete">
<input type="hidden" name="display" value="outboundlookup">
<input type="hidden" name="action" value="<?php echo ($itemid ? 'edit' : 'add') ?>">

<!--MySQL Elements -->
<div id="mysql">
<!--Host-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="mysql_host"><?php echo _("Host") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="mysql_host"></i>
					</div>
					<div class="col-md-9">
						<input type="text" class="form-control" id="mysql_host" name="mysql_host" value="<?php echo (isset($thisItem['mysql_host']) ? $thisItem['mysql_host'] : ''); ?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="mysql_host-help" class="help-block fpbx-help-block"><?php echo _("MySQL Host")?></span>
		</div>
	</div>
</div>
<!--END Host-->
<!--Database-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="mysql_dbname"><?php echo _("Database") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="mysql_dbname"></i>
					</div>
					<div class="col-md-9">
						<input type="text" class="form-control" id="mysql_dbname" name="mysql_dbname" value="<?php echo (isset($thisItem['mysql_dbname']) ? $thisItem['mysql_dbname'] : ''); ?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="mysql_dbname-help" class="help-block fpbx-help-block"><?php echo _("Database Name")?></span>
		</div>
	</div>
</div>
<!--END Database-->
<!--Query-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="mysql_query"><?php echo _("Query") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="mysql_query"></i>
					</div>
					<div class="col-md-9">
						<input type="text" class="form-control" id="mysql_query" name="mysql_query" value="<?php echo (isset($thisItem['mysql_query']) ? $thisItem['mysql_query'] : ''); ?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="mysql_query-help" class="help-block fpbx-help-block"><?php echo _("Query, special token '[NUMBER]' will be replaced with caller number<br/>e.g.: SELECT name FROM phonebook WHERE number LIKE '%[NUMBER]%'")?></span>
		</div>
	</div>
</div>
<!--END Query-->
<!--Username-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="mysql_username"><?php echo _("Username") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="mysql_username"></i>
					</div>
					<div class="col-md-9">
						<input type="text" class="form-control" id="mysql_username" name="mysql_username" value="<?php echo (isset($thisItem['mysql_username']) ? $thisItem['mysql_username'] : ''); ?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="mysql_username-help" class="help-block fpbx-help-block"><?php echo _("MySQL Username")?></span>
		</div>
	</div>
</div>
<!--END Username-->
<!--Password-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="mysql_password"><?php echo _("Password") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="mysql_password"></i>
					</div>
					<div class="col-md-9">
						<input type="password" class="form-control" id="mysql_password" name="mysql_password" value="<?php echo (isset($thisItem['mysql_password']) ? $thisItem['mysql_password'] : ''); ?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="mysql_password-help" class="help-block fpbx-help-block"><?php echo _("MySQL Password")?></span>
		</div>
	</div>
</div>
<!--END Password-->
<!--Character Set-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="mysql_charset"><?php echo _("Character Set") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="mysql_charset"></i>
					</div>
					<div class="col-md-9">
						<input type="text" class="form-control" id="mysql_charset" name="mysql_charset" value="<?php echo (isset($thisItem['mysql_charset']) ? $thisItem['mysql_charset'] : ''); ?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="mysql_charset-help" class="help-block fpbx-help-block"><?php echo _("MySQL Character Set. Leave blank for MySQL default latin1")?></span>
		</div>
	</div>
</div>
<!--END Character Set-->
</div>
<!--END MySQL Elements -->
<div id="sugarcrm" style="display: none">
	<div class = "well">
		<p><?php echo _("Not yet implemented")?></p>
	</div>
</div>
<div id="superfecta" style="display: none">
		<div class = "well">
		<p><?php echo _("Not yet implemented")?></p>
	</div>
</div>

</form>
