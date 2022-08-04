<?php
$rshelp =    '<b>' . _("ringallv2").            '</b>: ' . _("ring Extension for duration set in Initial Ring Time, and then, while continuing call to extension (only if extension is in the Group List), ring Follow-Me List for duration set in Ring Time.")
                        .'<br>'
                        .'<b>' . _("ringall").                  '</b>: ' . _("ring Extension for duration set in Initial Ring Time, and then terminate call to Extension and ring Follow-Me List for duration set in Ring Time.")
                        .'<br>'
                        .'<b>' . _("hunt").                     '</b>: ' . _("take turns ringing each available extension")
                        .'<br>'
                        .'<b>' . _("memoryhunt").               '</b>: ' . _("ring first extension in the list, then ring the 1st and 2nd extension, then ring 1st 2nd and 3rd extension in the list.... etc.")
                        .'<br>'
                        .'<b>' . _("*-prim").                   '</b>: ' . _("these modes act as described above. However, if the primary extension (first in list) is occupied, the other extensions will not be rung. If the primary is FreePBX DND, it won't be rung. If the primary is FreePBX CF unconditional, then all will be rung")
                        .'<br>'
                        .'<b>' . _("firstavailable").   '</b>: ' . _("ring only the first available channel")
                        .'<br>'
                        .'<b>' . _("firstnotonphone").  '</b>: ' . _("ring only the first channel which is not off hook - ignore CW")
			.'<br>';
//Ring Strategy Select Options
$default = (isset($strategy) ? $strategy : 'ringall');
$items = array('ringallv2','ringallv2-prim','ringall','ringall-prim','hunt','hunt-prim','memoryhunt','memoryhunt-prim','firstavailable','firstnotonphone');
$rsrows = '';
foreach ($items as $item) {
        $rsrows .= '<option value="'.$item.'" '.($default == $item ? 'SELECTED' : '').'>'._($item).'</option>';
}
?>
<div class="message alert" style="display:none;"></div>
<form role="form">
	<div class="form-group">
		<label for="grplist" class="help"><?php echo _('Follow Me List')?> <i class="fa fa-question-circle"></i></label>
		<textarea id="grplist" name="grplist" class="form-control" rows="<?php echo count($list) < 3 ? 3 : count($list)?>"><?php echo implode("\n",$list)?></textarea>
		<span class="help-block help-hidden" data-for="grplist"><?php echo _('List extensions to ring, one per line. You can include an extension on a remote system, or an external number by suffixing a number with a pound (#).  ex:  2448089# would dial 2448089.')?><br><br><?php echo _("Note: Any local extension added will skip that local extension's FindMe/FollowMe, if you wish the system to use another extension's FindMe/FollowMe append a # onto that extension, eg 105#")?></span>
	</div>
<!-- ring strategy-->
<?php if($fmr == 'enable'){ ?>
	 <div class="form-group">
                <label for="rstrategy" class="help"><?php echo _('Ring Strategy') ?> <i class="fa fa-question-circle"></i></label><br/>
		<select name="strategy" id="strategy" class="form-control" data-toggle="select">
			<?php echo $rsrows ?>
                </select>
                <span class="help-block help-hidden" data-for="rstrategy"><?php echo _($rshelp)?></span>
	</div>
<?php } ?>
	<div class="form-group">
		<label for="pre_ring" class="help"><?php echo sprintf(_('Ring %s First For'),$extension) ?> <i class="fa fa-question-circle"></i></label><br/>
		<select name="pre_ring" id="pre_ring" class="form-control" data-toggle="select">
			<?php foreach($prering_time as $key => $value) { ?>
				<option value="<?php echo $key?>" <?php echo ($prering == $key) ? 'selected' : ''?>><?php echo $value?> <?php echo _('Seconds')?></option>
			<?php } ?>
		</select>
		<span class="help-block help-hidden" data-for="pre_ring"><?php echo _('This is the number of seconds to ring the primary extension prior to proceeding to the follow-me list. The extension can also be included in the follow-me list. A 0 setting will bypass this.')?></span>
	</div>
	<div class="form-group">
		<label for="grptime" class="help"><?php echo _('Ring Followme List For') ?> <i class="fa fa-question-circle"></i></label><br/>
		<select name="grptime" id="grptime" class="form-control" data-toggle="select">
			<?php foreach($listring_time as $key => $value) { ?>
				<option value="<?php echo $key?>" <?php echo ($ringtime == $key) ? 'selected' : ''?>><?php echo $value?> <?php echo _('Seconds')?></option>
			<?php } ?>
		</select>
		<span class="help-block help-hidden" data-for="grptime"><?php echo _('Time in seconds that the phones will ring')?></span>
	</div>
	<div class="form-group">
		<label class="help" for="needsconf-h"><?php echo _('Use Confirmation')?> <i class="fa fa-question-circle"></i></label><br/>
		<input type="checkbox" name="needsconf" data-size="small" data-toggle="toggle" id="needsconf" <?php echo ($confirm) ? 'checked' : ''?>>
		<span class="help-block help-hidden" data-for="needsconf-h"><?php echo _("Enable this if you're calling external numbers that need confirmation - eg, a mobile phone may go to voicemail which will pick up the call. Enabling this requires the remote side push 1 on their phone before the call is put through.")?></span>
	</div>
</form>
