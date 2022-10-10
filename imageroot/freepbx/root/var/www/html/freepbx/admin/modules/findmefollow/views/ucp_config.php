<div class="element-container">
        <div class="row">
                <div class="col-md-12">
                        <div class="row">
                                <div class="form-group">
                                        <div class="col-md-3">
                                                <label class="control-label" for="findmefollow_enable"><?php echo _("Enable Findme Follow")?></label>
                                                <i class="fa fa-question-circle fpbx-help-icon" data-for="findmefollow_enable"></i>
                                        </div>
                                        <div class="col-md-9">
                                                <span class="radioset">
                                                        <input type="radio" name="findmefollow_enable" id="findmefollow_enable_yes" value="yes" <?php echo ($enabled == 'yes') ? 'checked' : ''?>>
                                                        <label for="findmefollow_enable_yes"><?php echo _('Yes')?></label>
                                                        <input type="radio" name="findmefollow_enable" id="findmefollow_enable_no" value="no" <?php echo (!is_null($enabled) && ($enabled == 'no')) ? 'checked' : ''?>>
                                                        <label for="findmefollow_enable_no"><?php echo _('No')?></label>
                                                        <?php if($mode == "user") {?>
                                                                <input type="radio" id="findmefollow_enable_inherit" name="findmefollow_enable" value='inherit' <?php echo (empty($enabled)) ? 'checked' : ''?>>
                                                                <label for="findmefollow_enable_inherit"><?php echo _('Inherit')?></label>
                                                        <?php } ?>
                                                </span>
                                        </div>
                                </div>
                        </div>
                </div>
        </div>
        <div class="row">
                <div class="col-md-12">
                        <span id="findmefollow_enable-help" class="help-block fpbx-help-block"><?php echo _("Enable the Findmefollow access in UCP for this user")?></span>
                </div>
        </div>
</div>

<div class="element-container">
        <div class="row">
                <div class="col-md-12">
                        <div class="row">
                                <div class="form-group">
                                        <div class="col-md-3">
                                                <label class="control-label" for="followme_ext"><?php echo _("Allowed Extensions")?></label>
                                                <i class="fa fa-question-circle fpbx-help-icon" data-for="followme_ext"></i>
                                        </div>
                                        <div class="col-md-9">
                                                <select data-placeholder="Extensions" id="followme_ext" class="form-control chosenmultiselect followme_ext" name="followme_ext[]" multiple="multiple" <?php echo (!is_null($enabled) && ($enabled == 'no')) ? "disabled" : ""?>>
                                                        <?php foreach($ausers as $key => $value) {?>
                                                                <option value="<?php echo $key?>" <?php echo in_array($key,$fmassigned) ? 'selected' : '' ?>><?php echo $value?></option>
                                                        <?php } ?>
                                                </select>
                                        </div>
                                </div>
                        </div>
                </div>
        </div>
        <div class="row">
                <div class="col-md-12">
                        <span id="followme_ext-help" class="help-block fpbx-help-block"><?php echo _("These are the assigned and active extensions which will show up for this user to control and edit in UCP")?></span>
                </div>
        </div>
</div>


 <div class="element-container">
                <div class="row">
                        <div class="col-md-12">
                                <div class="row">
                                        <div class="form-group">
                                                <div class="col-md-3">
                                                        <label class="control-label" for="fmr_settings"><?php echo _("Followme Ring Strategy Settings")?></label>
                                                        <i class="fa fa-question-circle fpbx-help-icon" data-for="fmr_settings"></i>
                                                </div>
                                                <div class="col-md-9 radioset">
                                                        <input type="radio" id="fmryes" name="fmr" value="enable" <?php echo ($fmr === 'enable') ? 'checked' : ''?> >
                                                                <label for="fmryes"><?php echo _("Enable")?></label>
                                                                <input type="radio" id="fmrno" name="fmr" value="disable" <?php echo ($fmr === 'disable') ? 'checked' : ''?>>
								<label for="fmrno"><?php echo _("Disable")?></label>
								<?php if($mode == 'user'){ ?>
								 <input type="radio" id="fmrinherit" name="fmr" value='inherit' <?php echo (empty($fmr)) ? 'checked' : ''; ?>>
								 <label for="fmrinherit"><?php echo _('Inherit')?></label>
								<?php } ?>

</div>
                                                </div>
                                        </div>
                                </div>
                        </div>
                        <div class="row">
                                <div class="col-md-12">
                                        <span id="fmr_settings-help" class="help-block fpbx-help-block"><?php echo _("User will have the Option to select followme ring Strategy in UCP")?></span>
                                </div>
                        </div>
                </div>
<script>
        $("input[name=findmefollow_enable]").change(function() {
          if($(this).val() == "yes" || $(this).val() == "inherit") {
           $(".followme_ext").prop("disabled",false).trigger("chosen:updated");;
         } else {
             $(".followme_ext").prop("disabled",true).trigger("chosen:updated");;
          }
        });
</script>

