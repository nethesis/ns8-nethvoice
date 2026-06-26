<form action="" method="post" class="fpbx-submit" id="hwform" name="hwform" data-fpbx-delete="config.php?display=returnontransfer">
  <input type="hidden" name='action' value="save">

  <!--enabled-->
  <div class="element-container">
    <div class="row">
      <div class="form-group">
        <div class="col-md-3">
          <label class="control-label" for="enabled"><?php echo _("Enabled") ?></label>
          <i class="fa fa-question-circle fpbx-help-icon" data-for="enabled"></i>
        </div>
        <div class="col-md-9 radioset">
          <input type="radio" name="enabled" id="enabledyes" value="1" <?php echo ($settings['enabled'])?"CHECKED":""?>>
          <label for="enabledyes"><?php echo _("Yes");?></label>
          <input type="radio" name="enabled" id="enabledno" value="" <?php echo ($settings['enabled'])?"":"CHECKED"?>>
          <label for="enabledno"><?php echo _("No");?></label>
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col-md-12">
        <span id="enabled-help" class="help-block fpbx-help-block"><?php echo _("Enable or disable blind transfer callback")?></span>
      </div>
    </div>
  </div>
  <!--enabled end-->
  <!--timeout-->
  <div class="element-container">
    <div class="row">
      <div class="form-group">
        <div class="col-md-3">
          <label class="control-label" for="timeout"><?php echo _("Timeout") ?></label>
          <i class="fa fa-question-circle fpbx-help-icon" data-for="timeout"></i>
        </div>
        <div class="col-md-9">
          <input type="number" min="5" max="60" class="form-control" id="timeout" name="timeout" value="<?php echo $settings['timeout'];?>">
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col-md-12">
        <span id="timeout-help" class="help-block fpbx-help-block"><?php echo _("Timeout for blind transfered calls before they are returned to transferer")?></span>
      </div>
    </div>
  </div>
  <!--timeout end-->
  <!--prefix-->
  <div class="element-container">
    <div class="row">
      <div class="form-group">
        <div class="col-md-3">
          <label class="control-label" for="prefix"><?php echo _("Caller ID") ?></label>
          <i class="fa fa-question-circle fpbx-help-icon" data-for="prefix"></i>
        </div>
        <div class="col-md-9">
          <input type="text" class="form-control" id="prefix" name="prefix" value="<?php echo $settings['prefix'];?>">
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col-md-12">
        <span id="prefix-help" class="help-block fpbx-help-block"><?php echo _('String to use as Caller ID for calls that return to transferer. ${xfer_exten} and ${CALLERID(name)} are variables replaced with extension returning the call and caller name')?></span>
      </div>
    </div>
  </div>
  <!--prefix end-->
  <!--alertinfo-->
  <div class="element-container">
    <div class="row">
      <div class="form-group">
        <div class="col-md-3">
          <label class="control-label" for="alertinfo"><?php echo _("Alertinfo") ?></label>
          <i class="fa fa-question-circle fpbx-help-icon" data-for="alertinfo"></i>
        </div>
        <div class="col-md-9">
          <input type="text" class="form-control" id="alertinfo" name="alertinfo" value="<?php echo $settings['alertinfo'];?>">
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col-md-12">
        <span id="alertinfo-help" class="help-block fpbx-help-block"><?php echo _("Use a different alertinfo for calls that return to transferer")?></span>
      </div>
    </div>
  </div>
</form>
<!--alertinfo end-->
