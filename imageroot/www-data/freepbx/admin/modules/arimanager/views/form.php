<?php
$password_type = isset($user['password_format'])?$user['password_format']:'plain';
$readonly = isset($user['read_only'])?$user['read_only']:'1';
?>

<h2> <?php echo (isset($user['id']) ? _("Edit Asterisk REST Interface User") : _("Add Asterisk REST Interface User")) ?> </h2>

<form class="fpbx-submit" autocomplete="off" name="ariform" id="ariform" method="post" action="?display=arimanager" <?php if(isset($user['id'])) { ?>data-fpbx-delete="?display=arimanager&amp;user=<?php echo $user['id']?>&amp;action=delete<?php } ?>">
	<input type="hidden" name="id" value="<?php echo (isset($user['id']) ? $user['id'] : ''); ?>">
  <!--REST Interface User Name-->
  <div class="element-container">
    <div class="row">
      <div class="col-md-12">
        <div class="row">
          <div class="form-group">
            <div class="col-md-3">
              <label class="control-label" for="name"><?php echo _("REST Interface User Name") ?></label>
              <i class="fa fa-question-circle fpbx-help-icon" data-for="name"></i>
            </div>
            <div class="col-md-9">
              <input type="text" class="form-control" id="name" name="name" value="<?php echo isset($user['name'])?$user['name']:''?>">
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col-md-12">
        <span id="name-help" class="help-block fpbx-help-block"><?php echo _("Asterisk REST Interface User Name")?></span>
      </div>
    </div>
  </div>
  <!--END REST Interface User Name-->
  <!--REST Interface User Password-->
  <div class="element-container">
    <div class="row">
      <div class="col-md-12">
        <div class="row">
          <div class="form-group">
            <div class="col-md-3">
              <label class="control-label" for="password"><?php echo _("REST Interface User Password") ?></label>
              <i class="fa fa-question-circle fpbx-help-icon" data-for="password"></i>
            </div>
            <div class="col-md-9">
              <input type="<?php echo ($password != '******') ? 'text' : 'password'?>" class="form-control" id="password" name="password" value="<?php echo isset($password)?$password:''?>">
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col-md-12">
        <span id="password-help" class="help-block fpbx-help-block"><?php echo _("Asterisk REST Inferface Password.")?></span>
      </div>
    </div>
  </div>
  <!--END REST Interface User Password-->
  <!--Password Type-->
  <div class="element-container">
    <div class="row">
      <div class="col-md-12">
        <div class="row">
          <div class="form-group">
            <div class="col-md-3">
              <label class="control-label" for="password_type"><?php echo _("Password Type") ?></label>
              <i class="fa fa-question-circle fpbx-help-icon" data-for="password_type"></i>
            </div>
            <div class="col-md-9 radioset">
              <input type="radio" name="password_type" id="password_typecrypt" value="crypt" <?php echo ($password_type == "crypt"?"CHECKED":"") ?>>
              <label for="password_typecrypt"><?php echo _("Crypt");?></label>
              <input type="radio" name="password_type" id="password_typeplain" value="plain" <?php echo ($password_type == "plain"?"CHECKED":"") ?>>
              <label for="password_typeplain"><?php echo _("Plain Text");?></label>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col-md-12">
        <span id="password_type-help" class="help-block fpbx-help-block"><?php echo _("For the security consious, you probably don't want to put plaintext passwords in the configuration file. ARI supports the use of crypt(3) for password storage.")?></span>
      </div>
    </div>
  </div>
  <!--END Password Type-->
  <!--Read Only-->
  <div class="element-container">
    <div class="row">
      <div class="col-md-12">
        <div class="row">
          <div class="form-group">
            <div class="col-md-3">
              <label class="control-label" for="readonly"><?php echo _("Read Only") ?></label>
              <i class="fa fa-question-circle fpbx-help-icon" data-for="readonly"></i>
            </div>
            <div class="col-md-9 radioset">
              <input type="radio" name="readonly" id="readonlyyes" value="yes" <?php echo ($readonly == "1"?"CHECKED":"") ?>>
              <label for="readonlyyes"><?php echo _("Yes");?></label>
              <input type="radio" name="readonly" id="readonlyno" value="no" <?php echo ($readonly == "1"?"":"CHECKED") ?>>
              <label for="readonlyno"><?php echo _("No");?></label>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col-md-12">
        <span id="readonly-help" class="help-block fpbx-help-block"><?php echo _("Set to Yes for read-only applications.")?></span>
      </div>
    </div>
  </div>
  <!--END Read Only-->
</form>
<script>var users = <?php echo json_encode($usernames)?>; var freepbxuser = <?php echo json_encode($freepbxuser)?>;</script>
