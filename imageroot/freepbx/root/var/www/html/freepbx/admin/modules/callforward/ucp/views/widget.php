<div class="text-center">
	<div class="cf parent">
		<div><?php echo _('Unconditional')?></div>
		<div class="display <?php echo (trim($CF) != "") ? '' : 'hidden'?>"><small>(<span class="text"><?php echo (trim($CF) != "") ? $CF : ''?></span>)</small></div>
		<input type="checkbox" name="cf" data-type="CF" data-nice="<?php echo _('Unconditional')?>" data-toggle="toggle" <?php echo (trim($CF) != "") ? 'checked' : ''?> data-on="<?php echo _("Enabled")?>" data-off="<?php echo _("Disabled")?>">
	</div>
	<div class="cfu parent">
		<div><?php echo _('Unavailable')?></div>
		<div class="display <?php echo (trim($CFU) != "") ? '' : 'hidden'?>"><small>(<span class="text"><?php echo (trim($CFU) != "") ? $CFU : ''?></span>)</small></div>
		<input type="checkbox" name="cfu" data-type="CFU" data-nice="<?php echo _('Unavailable')?>" data-toggle="toggle" <?php echo (trim($CFU) != "") ? 'checked' : ''?> data-on="<?php echo _("Enabled")?>" data-off="<?php echo _("Disabled")?>">
	</div>
	<div class="cfb parent">
		<div><?php echo _('Busy')?></div>
		<div class="display <?php echo (trim($CFB) != "") ? '' : 'hidden'?>"><small>(<span class="text"><?php echo (trim($CFB) != "") ? $CFB : ''?></span>)</small></div>
		<input type="checkbox" name="cfb" data-type="CFB" data-nice="<?php echo _('Busy')?>" data-toggle="toggle" <?php echo (trim($CFB) != "") ? 'checked' : ''?> data-on="<?php echo _("Enabled")?>" data-off="<?php echo _("Disabled")?>">
	</div>
</div>
