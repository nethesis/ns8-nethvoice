<!--
#
#    Copyright (C) 2018 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of RapidCode FreePBX module.
#
#    RapidCode module is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any
#    later version.
#
#    RapidCode module is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with RapidCode module.  If not, see <http://www.gnu.org/licenses/>.
#
-->

<form action="config.php?display=rapidcode" method="post" class="fpbx-submit" id="hwform" name="hwform" data-fpbx-delete="config.php?display=rapidcode&action=delete&id=<?php echo $_REQUEST['id']?>">
<input type="hidden" name='action' value="<?php echo $_REQUEST['id']?'edit':'add' ?>">

<?php
if (isset($_REQUEST['id'])) {
    $data = \FreePBX::Rapidcode()->getOne($_REQUEST['id']);
    echo("<input type='hidden' name='id' value='".$_REQUEST['id']."'>");
} else {
    $data['label'] = '';
    $data['code'] = '';
    $data['number'] = '';
}
?>

<div class="element-container">
<!--NAME-->
        <div class="row">
                <div class="form-group">
                        <div class="col-md-3">
                                <label class="control-label" for="label"><?php echo _("Label") ?></label>
                                <i class="fa fa-question-circle fpbx-help-icon" data-for="label"></i>
                        </div>
                        <div class="col-md-9">
                                <input type="text" class="form-control" id="label" name="label" value="<?php echo $data['label'];?>">
                        </div>
                </div>
        </div>
        <div class="row">
                <div class="col-md-12">
                        <span id="label-help" class="help-block fpbx-help-block"><?php echo _("Label for the rapid code")?></span>
                </div>
        </div>
<!--END NAME-->

<!--NUMBER-->
	<div class="row">
		<div class="form-group">
			<div class="col-md-3">
				<label class="control-label" for=""><?php echo _("Phone Number") ?></label>
				<i class="fa fa-question-circle fpbx-help-icon" data-for="number"></i>
			</div>
			<div class="col-md-9">
				<input type="text" class="form-control" id="number" name="number" value="<?php echo $data['number'];?>">
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="number-help" class="help-block fpbx-help-block"><?php echo _("Phone number to call with this rapid code")?></span>
		</div>
	</div>
<!--END NUMBER-->

<!--CODE-->
	<div class="row">
		<div class="form-group">
			<div class="col-md-3">
				<label class="control-label" for=""><?php echo _("Rapid Code") ?></label>
				<i class="fa fa-question-circle fpbx-help-icon" data-for="code"></i>
			</div>
			<div class="col-md-9">
				<input type="text" class="form-control" id="code" name="code" value="<?php echo $data['code'];?>">
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="code-help" class="help-block fpbx-help-block"><?php echo _("Rapid code to call this number")?></span>
		</div>
	</div>
<!--END CODE-->
</div>

</form>
