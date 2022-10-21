<!--
#
#    Copyright (C) 2018 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of GoogleTTS FreePBX module.
#
#    GoogleTTS module is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any 
#    later version.
#
#    GoogleTTS module is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with GoogleTTS module.  If not, see <http://www.gnu.org/licenses/>.
#
-->

<?php
?>


<form action="config.php?display=recallonbusy" method="post" class="fpbx-submit" id="hwform" name="hwform">
<input type="hidden" name="display" value="recallonbusy">
<input type="hidden" name="action" value="save">


<div class="fpbx-container">
<div class="col-sm-12"> 
<div class="element-container">
<!--DEFAULT-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="default"><?php echo _("Default behaviour") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="default"></i>
            </div>
            <div class="col-md-7 radioset">
		<input type="radio" name="default" id="defaultenabled" value="enabled" <?php echo ($settings['default'] != 'disabled') ? "CHECKED" : "" ?> >
		<label for="defaultenabled"><?php echo _("Enabled");?></label>
		<input type="radio" name="default" id="defaultdisabled" value="disabled" <?php echo ($settings['default'] != 'disabled') ? "" : "CHECKED" ?>>
		<label for="defaultdisabled"><?php echo _("Disabled");?></label>
            </div>
        </div>
        <div class="col-md-12">
            <span id="default_enabled-help" class="help-block fpbx-help-block"><?php echo _('Set default Recall on Busy behaviour for extension that doesn\'t have it explicitly configured')?></span>
        </div>
    </div>
<!--END DEFAULT-->
<!--DIGIT-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="digit"><?php echo _("Book digit") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="digit"></i>
            </div>
            <div class="col-md-7">
		<select class="form-control" id="digit" name="digit">
			<?php for($i = 1; $i <= 9; $i++) { ?>
				<option value="<?php echo $i?>" <?php echo ($settings['digit'] == $i) ? 'selected' : ''?>><?php echo $i?></option>
			<?php } ?>
		</select>
            </div>
        </div>
        <div class="col-md-12">
            <span id="default_enabled-help" class="help-block fpbx-help-block"><?php echo _('Digit the user is asked to press to book the callback. Default is 5.')?></span>
        </div>
    </div>
<!--END DIGIT-->
   
</div>
</div>
</div>

</form>
